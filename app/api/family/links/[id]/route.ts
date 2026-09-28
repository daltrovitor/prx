// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respondLink } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

const schema = z.object({ decision: z.enum(["approve", "reject"]) });

/** O responsável aceita (ou recusa) a Conta Filho de um jovem de 16–17 que informou o e-mail dele. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    return NextResponse.json({ success: true, link: await respondLink(parent, id, parsed.data.decision) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível responder ao pedido.");
  }
}
