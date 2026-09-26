// Hello World
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/partners/http";
import { requirePartnerValidator } from "@/lib/validation/actor";
import { lookupVoucher, redeemVoucher, voucherHistory } from "@/lib/validation/vouchers";

/**
 * POST /api/partner/validate
 * body: { code: string, action?: 'lookup' | 'redeem' }
 * Só o parceiro dono do benefício consulta ou dá baixa no voucher.
 * (Rota legada só de vouchers; o portal usa /api/validate, que também aceita ingressos.)
 */
export async function POST(req: NextRequest) {
  try {
    const validator = await requirePartnerValidator(req);
    const body = (await readJson(req)) as { code?: unknown; payload?: unknown; action?: unknown };
    const rawInput = String(body.code || body.payload || "").slice(0, 300);
    const outcome = body.action === "redeem" ? await redeemVoucher(validator, rawInput) : await lookupVoucher(validator, rawInput);

    if (!outcome.ok) return NextResponse.json({ success: false, error: outcome.error, voucher: outcome.voucher }, { status: outcome.status });
    return NextResponse.json({
      success: true,
      canRedeem: outcome.canRedeem,
      warning: outcome.warning,
      ...(outcome.message ? { message: outcome.message } : {}),
      voucher: outcome.voucher,
    });
  } catch (error) {
    return errorResponse(error, "Erro ao processar validação do voucher.");
  }
}

/**
 * GET /api/partner/validate
 * Últimos vouchers dos benefícios deste parceiro (nunca de outros).
 */
export async function GET(req: NextRequest) {
  try {
    const validator = await requirePartnerValidator(req);
    return NextResponse.json({ success: true, vouchers: await voucherHistory(validator, 20) });
  } catch (error) {
    return errorResponse(error, "Erro ao consultar histórico.");
  }
}
