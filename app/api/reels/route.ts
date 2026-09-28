// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { engage, memberFeed } from "@/lib/reels/service";
import { REEL_ACTIONS } from "@/lib/reels/types";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/reels — feed vertical de vídeos dos parceiros. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    return NextResponse.json({ success: true, reels: await memberFeed(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar os Destaques.");
  }
}

const schema = z.object({ action: z.enum(REEL_ACTIONS), reelId: z.string().trim().min(1).max(100) });

/** POST /api/reels — visualização, curtir/descurtir, salvar e clique no botão do vídeo. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const { action, reelId } = parsed.data;

    // Visualização conta uma vez a cada 30 min por membro e vídeo; o resto tem limite geral.
    if (action === "view" && !checkRateLimit(`reel-view:${user.id}:${reelId}`, 1, 1800).allowed) {
      return NextResponse.json({ success: true, counted: false }, { headers: NO_STORE });
    }
    const limit = checkRateLimit(`reels:${user.id}`, 120, 60);
    if (!limit.allowed) throw new PartnerError(`Muitas ações seguidas. Aguarde ${limit.resetInSeconds}s.`, 429);

    return NextResponse.json({ success: true, counted: true, state: await engage(user.id, reelId, action) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao registrar a interação.");
  }
}
