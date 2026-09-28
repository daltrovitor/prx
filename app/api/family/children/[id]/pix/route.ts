// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { transferSchema } from "@/lib/family/types";
import { sendToChild } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

/** Pix do responsável para o filho: sai do banco do responsável e cai direto na conta do filho. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const rate = checkRateLimit(`family_pix_${parent.id}`, 10, 60);
    if (!rate.allowed) throw new PartnerError(`Muitas tentativas. Tente em ${rate.resetInSeconds}s.`, 429);
    const { id } = await params;
    const parsed = transferSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    const transaction = await sendToChild(parent, id, parsed.data);
    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível enviar o Pix.");
  }
}
