// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { getWallet, submitClaim } from "@/lib/points/service";
import { claimInputSchema } from "@/lib/points/types";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/points — carteira PRX Coins, XP, nível, extrato, regras e compras em parceiros. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    return NextResponse.json({ success: true, wallet: await getWallet(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar seus pontos.");
  }
}

/**
 * POST /api/points — envia um bom comportamento para análise. Nada é
 * creditado aqui: coins e XP só entram quando a equipe aprova no Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    const limit = checkRateLimit(`points:${user.id}`, 20, 60);
    if (!limit.allowed) throw new PartnerError(`Muitas tentativas. Aguarde ${limit.resetInSeconds}s.`, 429);
    const parsed = claimInputSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const claim = await submitClaim({ id: user.id, name: user.fullName, email: user.email }, parsed.data.ruleId, parsed.data.evidence);
    return NextResponse.json({ success: true, claim, wallet: await getWallet(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao enviar para análise.");
  }
}
