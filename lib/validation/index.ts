// Hello World
import { parseTicketCode } from "@/lib/live/rules";
import type { Validator } from "@/lib/validation/actor";
import { checkinTicket, lookupTicket, ticketHistory, type DoorTicket, type TicketOutcome } from "@/lib/validation/tickets";
import { lookupVoucher, redeemVoucher, voucherHistory, type CounterVoucher, type VoucherOutcome } from "@/lib/validation/vouchers";

/**
 * Validação universal de QR: decide pelo formato se é ingresso do PRX LIVE
 * (PRX_LIVE::, UP-…, RUN-…) ou voucher do PRX PASS e aplica a regra de cada um.
 */

export type ValidationKind = "ticket" | "voucher";

export function detectKind(raw: string): ValidationKind {
  return parseTicketCode(raw) ? "ticket" : "voucher";
}

export type ValidationResult = ({ kind: "ticket" } & TicketOutcome) | ({ kind: "voucher" } & VoucherOutcome);

export async function validateCode(validator: Validator, raw: string, action: "lookup" | "confirm"): Promise<ValidationResult> {
  if (detectKind(raw) === "ticket") {
    const outcome = action === "confirm" ? await checkinTicket(validator, raw) : await lookupTicket(validator, raw);
    return { kind: "ticket", ...outcome };
  }
  const outcome = action === "confirm" ? await redeemVoucher(validator, raw) : await lookupVoucher(validator, raw);
  return { kind: "voucher", ...outcome };
}

export type HistoryEntry =
  | { kind: "ticket"; key: string; at: string | null; ticket: DoorTicket }
  | { kind: "voucher"; key: string; at: string | null; voucher: CounterVoucher };

/** Últimas validações (ingressos e vouchers), mais recentes primeiro. */
export async function validationHistory(validator: Validator, limit = 20): Promise<HistoryEntry[]> {
  const canTickets = validator.role !== "staff" || validator.canValidateTickets;
  const canVouchers = validator.role !== "staff" || validator.canValidateBenefits;
  const [tickets, vouchers] = await Promise.all([canTickets ? ticketHistory(validator, limit) : [], canVouchers ? voucherHistory(validator, limit) : []]);
  const entries: HistoryEntry[] = [
    ...tickets.map((ticket) => ({ kind: "ticket" as const, key: `t-${ticket.id}`, at: ticket.checkedInAtIso, ticket })),
    ...vouchers.map((voucher) => ({ kind: "voucher" as const, key: `v-${voucher.id || voucher.code}`, at: voucher.validatedAtIso, voucher })),
  ];
  return entries.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, limit);
}
