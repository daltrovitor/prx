// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { foundersInputSchema } from "@/lib/live/types";
import { DECK_MAX_BYTES, memberWallet, submitFounders } from "@/lib/live/service";

/**
 * POST /api/live/founders (multipart/form-data)
 *   startupName, oneLiner, stage, videoUrl?, deck? (PDF até 10 MB)
 * O PDF vai para o storage privado; só o admin abre, por link assinado.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Faça login para enviar sua startup.", 401);
    const limit = checkRateLimit(`founders:${user.id}`, 5, 600);
    if (!limit.allowed) throw new PartnerError(`Muitos envios. Aguarde ${Math.ceil(limit.resetInSeconds / 60)} min.`, 429);

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > DECK_MAX_BYTES + 256 * 1024) throw new PartnerError("O PDF pode ter até 10 MB.", 422);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new PartnerError("Envio inválido. Tente de novo.", 400);
    }
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" ? value : "";
    };
    const parsed = foundersInputSchema.safeParse({ startupName: text("startupName"), oneLiner: text("oneLiner"), stage: text("stage"), videoUrl: text("videoUrl") });
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 422);

    const file = form.get("deck");
    let deck: { name: string; bytes: Uint8Array; contentType: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > DECK_MAX_BYTES) throw new PartnerError("O PDF pode ter até 10 MB.", 422);
      deck = { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type };
    }

    const submission = await submitFounders(user, parsed.data, deck);
    return NextResponse.json({ success: true, submission, wallet: await memberWallet(user) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Não foi possível enviar sua startup.");
  }
}
