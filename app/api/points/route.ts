// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { claimCheckin, getWallet } from "@/lib/points/service";

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

const schema = z.object({ action: z.literal("checkin"), ruleId: z.string().trim().min(1).max(100) });

/** POST /api/points — check-in de bom comportamento. Coins e XP vêm da regra, nunca do cliente. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    const limit = checkRateLimit(`points:${user.id}`, 20, 60);
    if (!limit.allowed) throw new PartnerError(`Muitas tentativas. Aguarde ${limit.resetInSeconds}s.`, 429);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const result = await claimCheckin(user.id, parsed.data.ruleId);
    return NextResponse.json(
      { success: true, earned: { coins: result.transaction.coinsDelta, xp: result.transaction.xpDelta }, wallet: await getWallet(user.id) },
      { headers: NO_STORE }
    );
  } catch (error) {
    return errorResponse(error, "Erro ao registrar o check-in.");
  }
}
