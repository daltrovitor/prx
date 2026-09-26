// Hello World
import { PartnerError } from "@/lib/partners/errors";
import { getLiveRepository } from "@/lib/live/repository";
import { doorName } from "@/lib/live/service";
import { canValidateEvent, checkinVerdict, checkinWindowIssue, parseTicketCode, VALIDATOR_LABEL, type CheckinActor } from "@/lib/live/rules";
import { SERIES_LABEL, TICKET_STATUS_LABEL, type LiveEvent, type LiveTicket, type TicketStatus } from "@/lib/live/types";
import { displayDate } from "@/lib/validation/vouchers";
import type { Validator } from "@/lib/validation/actor";

/**
 * Portaria do PRX LIVE. Admin valida qualquer evento; parceiro, só os eventos
 * ligados a ele; equipe PRX, os eventos com "equipe na portaria" ligado.
 */

export function checkinActor(validator: Validator): CheckinActor {
  if (validator.role === "admin") return { role: "admin" };
  if (validator.role === "partner") return { role: "partner", partnerId: validator.partner.id };
  return { role: "staff", canValidateTickets: validator.canValidateTickets };
}

export interface DoorTicket {
  id: string;
  code: string;
  eventId: string;
  eventTitle: string;
  seriesLabel: string;
  eventStartsAt: string | null;
  venue: string;
  batchName: string;
  holderName: string;
  status: TicketStatus;
  statusLabel: string;
  source: LiveTicket["source"];
  checkedInAt: string | null;
  checkedInAtIso: string | null;
  checkedInBy: string | null;
  run: { modality: string; category: string; shirtSize: string } | null;
}

/** Parceiro vê primeiro nome + inicial (LGPD); equipe e admin veem o nome completo para conferir documento. */
export function doorView(ticket: LiveTicket, event: LiveEvent, validator: Validator): DoorTicket {
  return {
    id: ticket.id,
    code: ticket.code,
    eventId: event.id,
    eventTitle: event.title,
    seriesLabel: SERIES_LABEL[event.series],
    eventStartsAt: displayDate(event.startsAt),
    venue: event.venue,
    batchName: ticket.batchName,
    holderName: validator.role === "partner" ? doorName(ticket.holderName) : ticket.holderName,
    status: ticket.status,
    statusLabel: TICKET_STATUS_LABEL[ticket.status],
    source: ticket.source,
    checkedInAt: displayDate(ticket.checkedInAt),
    checkedInAtIso: ticket.checkedInAt,
    checkedInBy: ticket.checkedInByRole ? (ticket.checkedInByName ? `${ticket.checkedInByName} (${VALIDATOR_LABEL[ticket.checkedInByRole]})` : VALIDATOR_LABEL[ticket.checkedInByRole]) : null,
    run: ticket.runDetails ? { modality: ticket.runDetails.modality, category: ticket.runDetails.category, shirtSize: ticket.runDetails.shirtSize } : null,
  };
}

export type TicketOutcome =
  | { ok: true; canCheckin: boolean; warning: string | null; message?: string; ticket: DoorTicket }
  | { ok: false; status: 400 | 409; error: string; ticket: DoorTicket };

async function locate(validator: Validator, raw: string): Promise<{ ticket: LiveTicket; event: LiveEvent }> {
  if (validator.role === "staff" && !validator.canValidateTickets) throw new PartnerError("Seu acesso da equipe não inclui validação de ingressos.", 403);
  const code = parseTicketCode(raw);
  if (!code) throw new PartnerError("Código de ingresso inválido. O formato é UP-0000-0000 ou RUN-0000-0000.", 400);
  const repo = getLiveRepository();
  const ticket = await repo.getTicketByCode(code);
  if (!ticket) throw new PartnerError(`Ingresso '${code}' não encontrado.`, 404);
  const event = await repo.getEvent(ticket.eventId);
  if (!event) throw new PartnerError("O evento deste ingresso não existe mais.", 404);

  if (!canValidateEvent(checkinActor(validator), event)) {
    throw new PartnerError(
      validator.role === "partner"
        ? "Este ingresso é de um evento que não está ligado ao seu estabelecimento."
        : "Este evento não aceita validação pela equipe PRX. Peça ao admin para liberar.",
      403
    );
  }
  return { ticket, event };
}

function blockingIssue(ticket: LiveTicket, event: LiveEvent): string | null {
  const verdict = checkinVerdict(ticket, event);
  if (!verdict.ok) return verdict.reason;
  return checkinWindowIssue(event);
}

export async function lookupTicket(validator: Validator, raw: string): Promise<TicketOutcome> {
  const { ticket, event } = await locate(validator, raw);
  const issue = blockingIssue(ticket, event);
  const warning =
    ticket.status === "used" && ticket.checkedInAt ? `Este ingresso já entrou em ${displayDate(ticket.checkedInAt)}.` : issue;
  return { ok: true, canCheckin: !issue, warning, ticket: doorView(ticket, event, validator) };
}

export async function checkinTicket(validator: Validator, raw: string): Promise<TicketOutcome> {
  const { ticket, event } = await locate(validator, raw);
  const issue = blockingIssue(ticket, event);
  if (issue) return { ok: false, status: ticket.status === "used" ? 400 : 409, error: issue, ticket: doorView(ticket, event, validator) };

  // Baixa condicional: duas portarias lendo o mesmo QR não passam as duas.
  const updated = await getLiveRepository().updateTicket(
    ticket.id,
    { status: "used", checkedInAt: new Date().toISOString(), checkedInBy: validator.userId, checkedInByRole: validator.role, checkedInByName: validator.name.slice(0, 120) },
    ["valid"]
  );
  if (!updated) {
    const fresh = (await getLiveRepository().getTicket(ticket.id)) ?? ticket;
    return { ok: false, status: 409, error: "Este ingresso acabou de ser validado em outra portaria.", ticket: doorView(fresh, event, validator) };
  }
  return { ok: true, canCheckin: false, warning: null, message: "Entrada liberada.", ticket: doorView(updated, event, validator) };
}

/** Entradas registradas por este validador (parceiro: todas dos eventos dele). */
export async function ticketHistory(validator: Validator, limit = 20): Promise<DoorTicket[]> {
  const repo = getLiveRepository();
  const tickets =
    validator.role === "partner"
      ? await (async () => {
          const events = await repo.listEvents({ partnerId: validator.partner.id });
          return repo.listTickets({ eventIds: events.map((e) => e.id) });
        })()
      : await repo.listTickets({ checkedInBy: validator.userId, limit: 500 });
  const used = tickets
    .filter((t) => t.status === "used" && t.checkedInAt)
    .sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""))
    .slice(0, limit);
  const events = new Map<string, LiveEvent | null>();
  const views: DoorTicket[] = [];
  for (const ticket of used) {
    if (!events.has(ticket.eventId)) events.set(ticket.eventId, await repo.getEvent(ticket.eventId));
    const event = events.get(ticket.eventId);
    if (event) views.push(doorView(ticket, event, validator));
  }
  return views;
}
