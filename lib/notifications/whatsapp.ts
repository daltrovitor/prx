// Hello World
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { canSimulateDelivery, whatsappConfig } from "@/lib/notifications/config";
import type { Fetcher } from "@/lib/notifications/email";
import type { DeliveryResult } from "@/lib/notifications/types";

/*
 * Código de verificação pelo WhatsApp Cloud API (Meta). A Meta só permite
 * iniciar conversa com template aprovado: usamos um template da categoria
 * AUTHENTICATION com botão "Copiar código" (docs/NOTIFICACOES.md). O código vai
 * no corpo ({{1}}) e no parâmetro do botão.
 */

const TIMEOUT_MS = 10_000;

const graphResponse = z
  .object({
    messages: z.array(z.object({ id: z.string() })).optional(),
    error: z.object({ message: z.string().optional(), code: z.number().optional() }).optional(),
  })
  .passthrough();

/** Celular brasileiro (DDD + 9 dígitos) no formato internacional sem "+": 5511988887777. */
export function toWhatsAppNumber(brDigits: string): string {
  return `55${brDigits.replace(/\D/g, "")}`;
}

export function whatsappCodePayload(brDigits: string, code: string) {
  const config = whatsappConfig();
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppNumber(brDigits),
    type: "template",
    template: {
      name: config.otpTemplate,
      language: { code: config.language },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  } as const;
}

export async function sendWhatsAppCode(brDigits: string, code: string, fetcher: Fetcher = fetch): Promise<DeliveryResult> {
  if (!/^\d{11}$/.test(brDigits)) return { status: "skipped", reason: "Celular inválido." };
  if (!/^\d{6}$/.test(code)) return { status: "skipped", reason: "Código inválido." };

  const config = whatsappConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    return canSimulateDelivery() ? { status: "simulated" } : { status: "skipped", reason: "WhatsApp Cloud API não configurada." };
  }

  const endpoint = `https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  try {
    const res = await fetcher(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(whatsappCodePayload(brDigits, code)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = graphResponse.safeParse(await res.json().catch(() => ({})));
    const body = json.success ? json.data : {};
    if (!res.ok || body.error) {
      const detail = body.error ? `${body.error.code ?? ""} ${body.error.message ?? ""}` : "";
      return { status: "failed", provider: "whatsapp_cloud", error: `${res.status} ${detail}`.trim().slice(0, 300) };
    }
    return { status: "sent", provider: "whatsapp_cloud", providerId: body.messages?.[0]?.id ?? null };
  } catch (error) {
    return { status: "failed", provider: "whatsapp_cloud", error: errorMessage(error, "Sem resposta do WhatsApp.").slice(0, 300) };
  }
}
