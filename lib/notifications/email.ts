// Hello World
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { canSimulateDelivery, emailConfig } from "@/lib/notifications/config";
import type { DeliveryResult, EmailMessage } from "@/lib/notifications/types";

/*
 * Envio de e-mail transacional pelo Resend (API HTTP, sem SDK). Sem
 * RESEND_API_KEY: simula no desenvolvimento e pula em produção.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

const recipientSchema = z.string().trim().toLowerCase().email().max(160);
const resendResponse = z.object({ id: z.string().optional(), message: z.string().optional(), name: z.string().optional() }).passthrough();

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export async function sendEmail(message: EmailMessage, fetcher: Fetcher = fetch): Promise<DeliveryResult> {
  const to = recipientSchema.safeParse(message.to);
  if (!to.success) return { status: "skipped", reason: "E-mail do destinatário inválido." };

  const config = emailConfig();
  if (!config.apiKey) {
    return canSimulateDelivery() ? { status: "simulated" } : { status: "skipped", reason: "RESEND_API_KEY não configurada." };
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);

  try {
    const res = await fetcher(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.from,
        to: [to.data],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        tags: [{ name: "template", value: message.template }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = resendResponse.safeParse(await res.json().catch(() => ({})));
    const body = json.success ? json.data : {};
    if (!res.ok) return { status: "failed", provider: "resend", error: `${res.status} ${body.name ?? ""} ${body.message ?? ""}`.trim().slice(0, 300) };
    return { status: "sent", provider: "resend", providerId: body.id ?? null };
  } catch (error) {
    return { status: "failed", provider: "resend", error: errorMessage(error, "Sem resposta do provedor de e-mail.").slice(0, 300) };
  }
}
