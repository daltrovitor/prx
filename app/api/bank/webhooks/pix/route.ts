// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { handlePixSettled, pixSettledSchema, verifySignature, webhookSecret } from "@/lib/bank/pix-events";

/**
 * POST /api/bank/webhooks/pix — Pix enviado e liquidado (evento do BaaS).
 * Header x-prx-signature: HMAC-SHA256 do corpo com PRX_BAAS_WEBHOOK_SECRET.
 * Responde 200 também para eventos repetidos (idempotente pelo E2E).
 */
// nosemgrep: prx-mutation-route-without-auth — webhook do banco parceiro autenticado por assinatura HMAC, não por sessão
export async function POST(req: NextRequest) {
  try {
    const secret = webhookSecret();
    if (!secret) throw new PartnerError("Webhook do banco parceiro não configurado.", 503);
    const raw = await req.text();
    if (raw.length > 20_000) throw new PartnerError("Corpo grande demais.", 422);
    if (!verifySignature(raw, req.headers.get("x-prx-signature"), secret)) throw new PartnerError("Assinatura inválida.", 401);

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new PartnerError("Corpo da requisição inválido.", 400);
    }
    const parsed = pixSettledSchema.safeParse(json);
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 422);

    const result = await handlePixSettled(parsed.data);
    return NextResponse.json({
      received: true,
      partnerPurchase: result ? { partnerId: result.purchase.partnerId, coins: result.purchase.coins, xp: result.purchase.xp, duplicate: result.duplicate } : null,
    });
  } catch (error) {
    return errorResponse(error, "Erro ao processar o evento Pix.");
  }
}
