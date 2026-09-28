// Hello World
import crypto from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError, dbError } from "@/lib/partners/errors";
import { isUuid } from "@/lib/partners/catalog";
import { processPartnerPixTransfer, type PartnerPixResult } from "@/lib/points/service";

/**
 * Entrada de produção do motor de compras em parceiros: o banco parceiro
 * (BaaS) avisa por webhook quando um Pix enviado por uma conta PRX é
 * liquidado no SPI. A assinatura HMAC-SHA256 do corpo, com o segredo
 * combinado (PRX_BAAS_WEBHOOK_SECRET), é obrigatória.
 */

export const pixSettledSchema = z.object({
  event: z.literal("pix.out.settled"),
  endToEndId: z.string().trim().regex(/^E[0-9A-Za-z]{31}$/, "E2E inválido."),
  userId: z.string().trim().min(1).max(64),
  amount: z.coerce.number().positive().max(1_000_000),
  key: z.string().trim().min(1).max(140),
  recipientName: z.string().trim().max(140).nullish(),
  description: z.string().trim().max(140).nullish(),
  settledAt: z.string().datetime().optional(),
});

export type PixSettledEvent = z.output<typeof pixSettledSchema>;

export function webhookSecret(): string | null {
  const secret = process.env.PRX_BAAS_WEBHOOK_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/** Compara a assinatura em tempo constante. Aceita "sha256=<hex>" ou só o hex. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const received = header.replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (received.length !== expected.length || !/^[0-9a-f]+$/i.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Registra o lançamento no extrato (idempotente pelo E2E, guardado em
 * provider_ref), roda o motor de parceiros e marca o nicho do gasto.
 */
export async function handlePixSettled(event: PixSettledEvent): Promise<PartnerPixResult | null> {
  if (supabaseAdmin && isUuid(event.userId)) {
    const { error } = await supabaseAdmin.from("bank_transactions").upsert(
      {
        user_id: event.userId,
        kind: "pix_out",
        direction: "out",
        amount: Math.round(event.amount * 100) / 100,
        counterparty: event.recipientName || event.key,
        description: event.description || "Pix enviado",
        status: "settled",
        provider_ref: event.endToEndId,
        created_at: event.settledAt ?? new Date().toISOString(),
      },
      { onConflict: "provider_ref", ignoreDuplicates: true }
    );
    if (error) throw dbError(error, "Não foi possível registrar o Pix no extrato");
  } else if (supabaseAdmin) {
    throw new PartnerError("Conta PRX não encontrada.", 404);
  }

  const result = await processPartnerPixTransfer(event.userId, {
    endToEndId: event.endToEndId,
    key: event.key,
    recipientName: event.recipientName,
    amount: event.amount,
    source: "baas_webhook",
  });

  if (result && supabaseAdmin && isUuid(event.userId)) {
    const { error } = await supabaseAdmin
      .from("bank_transactions")
      .update({ category_id: result.purchase.categoryId, partner_id: result.purchase.partnerId, counterparty: result.purchase.partnerName })
      .eq("provider_ref", event.endToEndId);
    if (error) console.warn("[bank] nicho do Pix não gravado:", error.code, error.message);
  }
  return result;
}
