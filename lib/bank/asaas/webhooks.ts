// Hello World
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import type { AsaasDeps } from "@/lib/bank/asaas/deps";
import { applyGeneralApproval } from "@/lib/bank/asaas/onboarding";
import { ensureDefaultPixKey, handlePaymentEvent } from "@/lib/bank/asaas/cash-in";
import type { Subaccount } from "@/lib/bank/asaas/types";

/**
 * Eventos do Asaas (POST /api/bank/webhooks/asaas). Cada evento é registrado
 * em bank_webhooks_log antes de qualquer efeito: repetido e já processado
 * volta 200 sem mexer em nada; falha no meio deixa o evento "pendente" para a
 * próxima tentativa do Asaas. Os efeitos são idempotentes (provider_ref único).
 */

const looseObject = z.record(z.string(), z.unknown());

export const asaasEventSchema = z.object({
  id: z.string().trim().min(1).max(200),
  event: z.string().trim().min(1).max(80),
  dateCreated: z.string().optional(),
  account: z.object({ id: z.string().nullish(), ownerId: z.string().nullish() }).nullish(),
  payment: looseObject.nullish(),
  transfer: looseObject.nullish(),
  bill: looseObject.nullish(),
  accountStatus: looseObject.nullish(),
});
export type AsaasEvent = z.output<typeof asaasEventSchema>;

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/** Motivo de reprovação, quando o Asaas manda junto do evento. */
function rejectReason(event: AsaasEvent): string | null {
  return text(event.accountStatus?.rejectReason) ?? text(event.accountStatus?.observations) ?? null;
}

async function handleAccountStatus(event: AsaasEvent, sub: Subaccount, deps: AsaasDeps): Promise<WebhookOutcome> {
  switch (event.event) {
    case "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED":
      await applyGeneralApproval(sub, "APPROVED", null, deps);
      // Conta nova já nasce com uma chave aleatória para receber Pix.
      await ensureDefaultPixKey(sub.userId, deps);
      return "processed";
    case "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED":
    case "ACCOUNT_STATUS_DOCUMENT_REJECTED":
      await applyGeneralApproval(sub, "REJECTED", rejectReason(event), deps);
      return "processed";
    case "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL":
      await applyGeneralApproval(sub, "AWAITING_APPROVAL", null, deps);
      return "processed";
    default:
      return "ignored";
  }
}

type EventHandler = (event: AsaasEvent, sub: Subaccount, deps: AsaasDeps) => Promise<WebhookOutcome>;

/** Manipuladores por família de evento. */
const handlers: ReadonlyArray<{ match: (event: string) => boolean; handle: EventHandler }> = [
  { match: (e) => e.startsWith("ACCOUNT_STATUS_"), handle: handleAccountStatus },
  { match: (e) => e.startsWith("PAYMENT_"), handle: handlePaymentEvent },
];

async function dispatch(event: AsaasEvent, deps: AsaasDeps): Promise<WebhookOutcome> {
  const accountId = event.account?.id ?? null;
  // Eventos da conta mãe (ou de contas que o PRX não conhece) não mexem em correntista nenhum.
  const sub = accountId ? await deps.store.findSubaccountByAsaasId(accountId) : null;
  if (!sub) return "ignored";
  const handler = handlers.find((h) => h.match(event.event));
  return handler ? handler.handle(event, sub, deps) : "ignored";
}

export async function handleAsaasEvent(event: AsaasEvent, deps: AsaasDeps): Promise<WebhookOutcome> {
  const recorded = await deps.store.recordWebhook({ eventId: event.id, eventType: event.event, asaasAccountId: event.account?.id ?? null, payload: event });
  if (recorded === "duplicate") return "duplicate";
  try {
    const outcome = await dispatch(event, deps);
    await deps.store.finishWebhook(event.id, null);
    return outcome;
  } catch (err) {
    await deps.store.finishWebhook(event.id, errorMessage(err, "falha ao processar")).catch(() => undefined);
    throw err;
  }
}
