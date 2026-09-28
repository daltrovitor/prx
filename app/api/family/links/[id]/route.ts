// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/partners/http";
import { guardianConsentSchema } from "@/lib/family/types";
import { respondLink } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("reject") }),
  // Aceitar o vínculo é o consentimento parental: parentesco, tutela declarada e termo aceito (LGPD, Art. 14).
  z.object({ decision: z.literal("approve") }).extend(guardianConsentSchema.shape),
]);

/** O responsável aceita (ou recusa) o pedido de vínculo de um menor que informou o e-mail dele. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    const input = parsed.data;
    const link =
      input.decision === "approve"
        ? await respondLink(parent, id, "approve", { relationship: input.relationship, guardianshipDeclared: input.guardianshipDeclared, consentAccepted: input.consentAccepted }, clientIp(req))
        : await respondLink(parent, id, "reject");
    return NextResponse.json({ success: true, link });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível responder ao pedido.");
  }
}
