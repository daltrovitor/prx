// Hello World
"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import type { User } from "@/hooks/use-auth";
import { useAppNav } from "@/components/app/app-nav";
import { useLiveData, type ActionResult } from "@/components/app/use-prx-stores";
import { EventDate } from "@/components/app/shared";
import { CopyButton, useQrDataUrl } from "@/components/app/pass/voucher-sheet";
import { Button, EmptyState, Field, Input, Notice, Segmented, Select, Sheet, Tag, Textarea, formatBRL } from "@/components/app/ui";
import { IconCheck, IconUpload } from "@/components/icons/prx-icons";
import type { MemberSubmission, MemberTicket, PublicBatch, PublicEvent } from "@/lib/live/service";
import { FOUNDERS_PIPELINE, FOUNDERS_STATUS_LABEL, SERIES_LABEL, SHIRT_SIZES, TICKET_STATUS_LABEL, type EventSeries, type ShirtSize } from "@/lib/live/types";
import { formatDateTime } from "@/lib/live/format";
import { cn } from "@/lib/utils";

type LiveSection = "eventos" | "ingressos" | "run" | "founders";
const SECTIONS: ReadonlyArray<LiveSection> = ["eventos", "ingressos", "run", "founders"];

const isOpenTicket = (t: MemberTicket) => t.status === "valid" || t.status === "pending_payment";

export function LiveScreen({ member }: { member: User }) {
  const { sub, go } = useAppNav();
  const section: LiveSection = SECTIONS.includes(sub as LiveSection) ? (sub as LiveSection) : "eventos";
  const live = useLiveData(member.id);
  const events = live.data?.events ?? [];
  const wallet = live.data?.wallet ?? { tickets: [], submissions: [] };
  const agenda = events.filter((e) => e.series !== "run" && e.status === "published" && !e.ended);

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">PRX LIVE</h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-[15px]">Eventos, corridas e o palco das startups. Ingresso na carteira, QR na portaria.</p>
      </header>

      <Segmented
        label="Seções do PRX LIVE"
        value={section}
        onChange={(value) => go("live", value === "eventos" ? null : value)}
        options={[
          { value: "eventos", label: "Agenda", count: agenda.length },
          { value: "ingressos", label: "Meus ingressos", count: wallet.tickets.filter(isOpenTicket).length },
          { value: "run", label: "PRX RUN" },
          { value: "founders", label: "Founders" },
        ]}
      />

      {!live.data ? (
        live.loading ? (
          <div role="status" aria-label="Carregando eventos" className="h-48 rounded-3xl bg-surface" />
        ) : (
          <EmptyState title="Não foi possível carregar o PRX LIVE" body={live.error ?? undefined} action={<Button onClick={() => void live.reload()}>Tentar de novo</Button>} />
        )
      ) : (
        <>
          {section === "eventos" && <EventsPanel events={agenda} member={member} reserve={live.reserve} onDone={() => go("live", "ingressos")} />}
          {section === "ingressos" && <TicketsPanel tickets={wallet.tickets} cancel={live.cancel} onBrowse={() => go("live")} />}
          {section === "run" && <RunPanel events={events.filter((e) => e.series === "run")} tickets={wallet.tickets} member={member} reserve={live.reserve} cancel={live.cancel} />}
          {section === "founders" && <FoundersPanel submissions={wallet.submissions} submit={live.submitFounders} />}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function priceLabel(event: PublicEvent): string {
  const open = event.batches.filter((b) => b.available);
  if (open.length === 0) return event.salesOpen ? "Esgotado" : "Vendas encerradas";
  const from = Math.min(...open.map((b) => b.price));
  return from === 0 ? "Gratuito" : `a partir de ${formatBRL(from)}`;
}

function batchNote(b: PublicBatch): string | null {
  if (!b.available) return b.remaining === 0 ? "Esgotado" : "Encerrado";
  if (b.remaining !== null && b.remaining <= 20) return `Restam ${b.remaining}`;
  return null;
}

type Reserve = (input: { eventId: string; batchId: string; run?: unknown }) => Promise<ActionResult>;
type Cancel = (ticketId: string) => Promise<ActionResult>;

function EventsPanel({ events, member, reserve, onDone }: { events: PublicEvent[]; member: User; reserve: Reserve; onDone: () => void }) {
  const [series, setSeries] = useState<EventSeries | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"free" | "reserved" | null>(null);

  const seriesPresent = useMemo(() => [...new Set(events.map((e) => e.series))], [events]);
  const list = useMemo(() => events.filter((e) => series === "all" || e.series === series), [events, series]);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const batch = selected?.batches.find((b) => b.id === batchId);
  const levelLocked = selected ? (member.prxLevel || 1) < selected.minPrxLevel : false;

  function open(event: PublicEvent) {
    setSelectedId(event.id);
    setBatchId(event.batches.find((b) => b.available)?.id ?? "");
    setError(null);
  }

  async function confirm() {
    if (!selected || !batch) return;
    setBusy(true);
    setError(null);
    const result = await reserve({ eventId: selected.id, batchId: batch.id });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSelectedId(null);
    setDone(batch.price === 0 ? "free" : "reserved");
  }

  if (events.length === 0) {
    return <EmptyState title="Nenhum evento aberto agora" body="Novos eventos PRX LIVE aparecem aqui assim que forem publicados." />;
  }

  return (
    <section aria-label="Agenda de eventos" className="space-y-6">
      {seriesPresent.length > 1 && (
        <div role="group" aria-label="Séries" className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none touch-pan-x overscroll-x-contain sm:mx-0 sm:flex-wrap sm:px-0">
          {(["all", ...seriesPresent] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={series === value}
              onClick={() => setSeries(value)}
              className={cn(
                "min-h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
                series === value ? "bg-ink text-background" : "bg-surface text-muted-foreground hover:bg-line hover:text-ink"
              )}
            >
              {value === "all" ? "Todos" : SERIES_LABEL[value]}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {list.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => open(event)}
              className="group grid w-full cursor-pointer grid-cols-[auto_1fr] items-start gap-4 rounded-3xl bg-surface p-5 text-left transition-colors hover:bg-line sm:grid-cols-[110px_1fr_auto] sm:items-center sm:gap-8 sm:p-6"
            >
              <EventDate iso={event.startsAt} />
              <div className="min-w-0 space-y-1.5 sm:space-y-2">
                <span className="inline-flex rounded-full bg-primary/[0.09] px-2.5 py-0.5 text-[12px] font-semibold text-primary">{event.seriesLabel}</span>
                <p className="text-lg font-semibold leading-snug tracking-[-0.02em] text-ink sm:text-xl">{event.title}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {event.venue} · {event.city}
                  {event.partnerName ? ` · com ${event.partnerName}` : ""}
                </p>
              </div>
              <p className="col-span-2 text-sm text-ink sm:col-span-1 sm:text-right">{priceLabel(event)}</p>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? "Evento"}
        description={selected ? `${selected.seriesLabel} · ${selected.venue}, ${selected.city}` : undefined}
        footer={
          <Button block onClick={() => void confirm()} disabled={busy || !batch || !batch.available || levelLocked}>
            {busy ? "Processando…" : !batch ? "Escolha um lote" : batch.price === 0 ? "Garantir ingresso gratuito" : `Reservar · ${formatBRL(batch.price)}`}
          </Button>
        }
      >
        {selected && (
          <div className="space-y-7">
            <div className="flex items-start justify-between gap-6">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{selected.summary}</p>
              <EventDate iso={selected.startsAt} />
            </div>

            {(selected.address || selected.partnerName) && (
              <dl className="space-y-2 rounded-3xl bg-surface p-4 text-sm">
                {selected.address && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Endereço</dt>
                    <dd className="text-right text-ink">{selected.address}</dd>
                  </div>
                )}
                {selected.partnerName && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Parceiro</dt>
                    <dd className="text-right text-ink">{selected.partnerName}</dd>
                  </div>
                )}
              </dl>
            )}

            <fieldset>
              <legend className="text-[13px] font-semibold text-ink">Lote</legend>
              <div className="mt-3 divide-y divide-line rounded-3xl bg-surface px-4">
                {selected.batches.map((b) => {
                  const note = batchNote(b);
                  return (
                    <label key={b.id} className={cn("flex min-h-14 items-center justify-between gap-4 py-2", b.available ? "cursor-pointer" : "cursor-not-allowed opacity-50")}>
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="batch"
                          value={b.id}
                          disabled={!b.available}
                          checked={batchId === b.id}
                          onChange={() => setBatchId(b.id)}
                          className="h-4 w-4 cursor-pointer accent-[#6c0cf0]"
                        />
                        <span className="text-[15px] text-ink">{b.name}</span>
                        {note && <Tag>{note}</Tag>}
                      </span>
                      <span className="text-[15px] font-medium tabular-nums text-ink">{b.price === 0 ? "Grátis" : formatBRL(b.price)}</span>
                    </label>
                  );
                })}
              </div>
              {selected.perUserLimit > 1 && <p className="mt-2 text-[13px] text-muted-foreground">Até {selected.perUserLimit} ingressos por pessoa.</p>}
            </fieldset>

            {levelLocked && <Notice tone="warning">Este evento é para membros a partir do nível {selected.minPrxLevel}. Complete missões no PASS para subir de nível.</Notice>}

            {batch && batch.price > 0 && (
              <p className="rounded-2xl bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                O pagamento online chega em breve. A reserva segura seu lugar por até 72 h (ou até o início do evento). Quando a equipe PRX confirmar o
                pagamento, o QR Code do ingresso aparece em Meus ingressos.
              </p>
            )}

            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}
      </Sheet>

      <Sheet
        open={done !== null}
        onClose={() => {
          setDone(null);
          onDone();
        }}
        title={done === "free" ? "Ingresso garantido" : "Reserva feita"}
        footer={
          <Button
            block
            variant="ink"
            onClick={() => {
              setDone(null);
              onDone();
            }}
          >
            Ver meus ingressos
          </Button>
        }
      >
        <div className="space-y-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
            <IconCheck size={24} />
          </span>
          <p className="text-[15px] leading-relaxed text-ink">
            {done === "free"
              ? "Seu ingresso já está na carteira com o QR Code para a portaria."
              : "Seu lugar está reservado. Assim que o pagamento for confirmado pela equipe PRX, o QR Code do ingresso é liberado."}
          </p>
        </div>
      </Sheet>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function statusTone(status: MemberTicket["status"]): "success" | "warning" | "neutral" | "accent" {
  if (status === "valid") return "success";
  if (status === "pending_payment") return "warning";
  return "neutral";
}

function TicketSheet({ ticket, onClose, cancel }: { ticket: MemberTicket | null; onClose: () => void; cancel: Cancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qr = useQrDataUrl(ticket?.status === "valid" ? ticket.qrPayload : null);
  const event = ticket?.event ?? null;
  const cancellable = ticket && (ticket.status === "pending_payment" || (ticket.status === "valid" && ticket.price === 0 && ticket.source !== "invite" && event?.salesOpen));

  async function doCancel() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    const result = await cancel(ticket.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
  }

  return (
    <Sheet
      open={Boolean(ticket)}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={event?.title ?? "Ingresso"}
      description={event ? `${event.venue} · ${event.city}` : undefined}
      footer={
        cancellable ? (
          <Button block variant="secondary" onClick={() => void doCancel()} disabled={busy}>
            {busy ? "Cancelando…" : ticket?.status === "pending_payment" ? "Cancelar reserva" : "Liberar meu ingresso"}
          </Button>
        ) : undefined
      }
    >
      {ticket && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Tag tone={statusTone(ticket.status)}>{TICKET_STATUS_LABEL[ticket.status]}</Tag>
              <p className="text-sm text-muted-foreground">
                {ticket.batchName} · {ticket.holderName}
              </p>
              {ticket.runDetails && (
                <p className="text-sm text-muted-foreground">
                  {ticket.runDetails.modality.toUpperCase()} · {ticket.runDetails.category} · camiseta {ticket.runDetails.shirtSize}
                </p>
              )}
            </div>
            {event && <EventDate iso={event.startsAt} />}
          </div>

          {ticket.status === "valid" && (
            <>
              <div className="mx-auto w-full max-w-[280px] rounded-3xl bg-white p-4 ring-1 ring-line">
                {qr ? <Image src={qr} alt={`QR Code do ingresso ${ticket.code}`} width={280} height={280} unoptimized className="h-auto w-full" /> : <div className="aspect-square bg-surface" />}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-3xl bg-surface p-4">
                <div>
                  <p className="text-[13px] text-muted-foreground">Código do ingresso</p>
                  <p className="font-mono text-lg tracking-[0.12em] text-ink">{ticket.code}</p>
                </div>
                <CopyButton value={ticket.code} />
              </div>
              <p className="text-sm text-muted-foreground">
                {ticket.runDetails ? "Mostre este QR na retirada do kit e na largada." : "Na portaria, mostre o QR Code. Cada ingresso vale uma entrada e é validado na hora."}
              </p>
            </>
          )}

          {ticket.status === "pending_payment" && (
            <Notice tone="warning">
              Reserva de {formatBRL(ticket.price)} aguardando pagamento{ticket.holdUntil ? `, garantida até ${formatDateTime(ticket.holdUntil)}` : ""}. A equipe PRX
              confirma o pagamento e o QR Code aparece aqui.
            </Notice>
          )}
          {ticket.status === "used" && <Notice tone="success">Entrada registrada em {formatDateTime(ticket.checkedInAt)}.</Notice>}
          {ticket.status === "cancelled" && <Notice>Este ingresso foi cancelado.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </Sheet>
  );
}

function TicketCard({ ticket, onOpen }: { ticket: MemberTicket; onOpen: () => void }) {
  const event = ticket.event;
  return (
    <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-stretch overflow-hidden rounded-3xl bg-surface text-left transition-colors hover:bg-line">
      <div className={cn("flex flex-col justify-between rounded-3xl p-5", ticket.status === "valid" ? "bg-primary" : "bg-ink/80")}>
        {event ? <EventDate iso={event.startsAt} tone="dark" /> : <span className="text-white">—</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
        <div>
          <Tag tone={statusTone(ticket.status)}>{TICKET_STATUS_LABEL[ticket.status]}</Tag>
          <p className="mt-1.5 truncate text-[17px] font-semibold text-ink">{event?.title ?? "Evento indisponível"}</p>
        </div>
        <p className="font-mono text-[13px] text-muted-foreground">{ticket.status === "valid" || ticket.status === "used" ? ticket.code : ticket.batchName}</p>
      </div>
    </button>
  );
}

function TicketsPanel({ tickets, cancel, onBrowse }: { tickets: MemberTicket[]; cancel: Cancel; onBrowse: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tickets.find((t) => t.id === openId) ?? null;
  const current = tickets.filter(isOpenTicket);
  const history = tickets.filter((t) => !isOpenTicket(t));

  if (tickets.length === 0) {
    return <EmptyState title="Sua carteira de ingressos está vazia" body="Escolha um evento na agenda para garantir o seu." action={<Button onClick={onBrowse}>Ver agenda</Button>} />;
  }

  return (
    <section aria-label="Meus ingressos" className="space-y-10">
      {current.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {current.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} onOpen={() => setOpenId(ticket.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum ingresso ativo" body="Os próximos eventos estão na agenda." action={<Button onClick={onBrowse}>Ver agenda</Button>} />
      )}
      {history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-[13px] font-semibold text-muted-foreground">Histórico</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {history.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} onOpen={() => setOpenId(ticket.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <TicketSheet ticket={open} onClose={() => setOpenId(null)} cancel={cancel} />
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function RunPanel({ events, tickets, member, reserve, cancel }: { events: PublicEvent[]; tickets: MemberTicket[]; member: User; reserve: Reserve; cancel: Cancel }) {
  const upcoming = events.filter((e) => e.status === "published" && !e.ended).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = events.filter((e) => e.ended && (e.run?.results.length ?? 0) > 0).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const [stageId, setStageId] = useState<string | null>(null);
  const stage = upcoming.find((e) => e.id === stageId) ?? upcoming[0];

  if (upcoming.length === 0 && past.length === 0) {
    return <EmptyState title="Nenhuma etapa da PRX RUN aberta" body="As próximas etapas aparecem aqui assim que as inscrições abrirem." />;
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        {upcoming.length > 1 && (
          <Segmented
            label="Etapas"
            value={stage?.id ?? ""}
            onChange={setStageId}
            options={upcoming.map((e) => ({ value: e.id, label: e.title.length > 22 ? `${e.title.slice(0, 21)}…` : e.title }))}
          />
        )}
        {stage ? (
          <RunStage key={stage.id} stage={stage} ticket={tickets.find((t) => t.eventId === stage.id && isOpenTicket(t)) ?? null} member={member} reserve={reserve} cancel={cancel} />
        ) : (
          <EmptyState title="Inscrições encerradas" body="A próxima etapa aparece aqui quando abrir." />
        )}
      </div>
      {past.length > 0 && (
        <div className="space-y-10 lg:col-span-5">
          {past.map((event) => (
            <RunResults key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunStage({ stage, ticket, member, reserve, cancel }: { stage: PublicEvent; ticket: MemberTicket | null; member: User; reserve: Reserve; cancel: Cancel }) {
  const run = stage.run;
  const [modality, setModality] = useState(run?.modalities[0] ?? "5k");
  const [category, setCategory] = useState(run?.categories[0] ?? "Geral");
  const [shirt, setShirt] = useState<ShirtSize>("M");
  const [batchId, setBatchId] = useState(stage.batches.find((b) => b.available)?.id ?? "");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openTicket, setOpenTicket] = useState(false);
  const batch = stage.batches.find((b) => b.id === batchId);
  const levelLocked = (member.prxLevel || 1) < stage.minPrxLevel;

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!batch) return setError("Escolha o lote da inscrição.");
    if (!accepted) return setError("Aceite o termo de responsabilidade para concluir a inscrição.");
    setBusy(true);
    setError(null);
    const result = await reserve({ eventId: stage.id, batchId: batch.id, run: { modality, category, shirtSize: shirt, acceptedTerms: true } });
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <section aria-labelledby={`run-${stage.id}`} className="space-y-6">
      <div className="flex items-start justify-between gap-4 rounded-3xl bg-surface p-5 sm:gap-6 sm:p-6">
        <div>
          <h2 id={`run-${stage.id}`} className="text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            {stage.title}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
            {stage.venue} · {stage.city}
          </p>
          {run?.kitPickup && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Retirada do kit: {run.kitPickup}</p>}
        </div>
        <EventDate iso={stage.startsAt} />
      </div>

      {ticket ? (
        <div className="space-y-4 rounded-3xl bg-surface p-5 sm:p-6">
          <Tag tone={statusTone(ticket.status)}>{ticket.status === "valid" ? "Inscrição confirmada" : TICKET_STATUS_LABEL[ticket.status]}</Tag>
          {ticket.runDetails && (
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Distância</dt>
                <dd className="text-2xl font-semibold uppercase text-ink">{ticket.runDetails.modality}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Categoria</dt>
                <dd className="font-medium text-ink">{ticket.runDetails.category}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Camiseta</dt>
                <dd className="font-medium text-ink">{ticket.runDetails.shirtSize}</dd>
              </div>
            </dl>
          )}
          <Button variant="ink" onClick={() => setOpenTicket(true)}>
            {ticket.status === "valid" ? "Mostrar QR do kit" : "Ver reserva"}
          </Button>
          <TicketSheet ticket={openTicket ? ticket : null} onClose={() => setOpenTicket(false)} cancel={cancel} />
        </div>
      ) : !stage.salesOpen || !run ? (
        <EmptyState title="Inscrições encerradas" body="Acompanhe os resultados quando a etapa terminar." />
      ) : (
        <form onSubmit={(e) => void register(e)} className="space-y-6">
          <fieldset>
            <legend className="text-[13px] font-semibold text-ink">Distância</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {run.modalities.map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center justify-center rounded-2xl text-2xl font-semibold uppercase tracking-[-0.02em] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    modality === m ? "bg-primary text-white" : "bg-surface text-ink hover:bg-line"
                  )}
                >
                  <input type="radio" name="modality" value={m} checked={modality === m} onChange={() => setModality(m)} className="sr-only" />
                  {m}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              {(id) => (
                <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {run.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tamanho da camiseta">
              {(id) => (
                <Select id={id} value={shirt} onChange={(e) => setShirt(e.target.value as ShirtSize)}>
                  {SHIRT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {stage.batches.length > 1 && (
            <Field label="Lote">
              {(id) => (
                <Select id={id} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  {stage.batches.map((b) => (
                    <option key={b.id} value={b.id} disabled={!b.available}>
                      {b.name} · {b.price === 0 ? "Grátis" : formatBRL(b.price)}
                      {batchNote(b) ? ` · ${batchNote(b)}` : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <label className="flex cursor-pointer gap-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#6c0cf0]" />
            <span>
              Declaro estar em condições de saúde para participar da prova, conheço o percurso e assumo a responsabilidade pela minha participação, conforme o
              regulamento da etapa.
            </span>
          </label>
          {batch && batch.price > 0 && (
            <p className="text-[13px] text-muted-foreground">A inscrição fica reservada por até 72 h. Com o pagamento confirmado pela equipe PRX, o QR do kit é liberado.</p>
          )}
          {levelLocked && <Notice tone="warning">Etapa para membros a partir do nível {stage.minPrxLevel}.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" block disabled={busy || !batch?.available || levelLocked}>
            {busy ? "Enviando…" : batch ? `Inscrever-se · ${batch.price === 0 ? "grátis" : formatBRL(batch.price)}` : "Inscrições esgotadas"}
          </Button>
        </form>
      )}
    </section>
  );
}

function RunResults({ event }: { event: PublicEvent }) {
  const results = event.run?.results ?? [];
  const modalities = [...new Set(results.map((r) => r.modality).filter(Boolean))];
  const [filter, setFilter] = useState(modalities[0] ?? "");
  const shown = results.filter((r) => !filter || r.modality === filter).sort((a, b) => a.position - b.position);
  return (
    <section aria-labelledby={`res-${event.id}`} className="space-y-5">
      <h2 id={`res-${event.id}`} className="text-xl font-semibold tracking-[-0.02em] text-ink">
        Resultados · {event.title}
      </h2>
      {modalities.length > 1 && <Segmented label="Distância" value={filter} onChange={setFilter} options={modalities.map((m) => ({ value: m, label: m.toUpperCase() }))} />}
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Classificação {filter}</caption>
        <thead>
          <tr className="border-b border-line text-[13px] text-muted-foreground">
            <th scope="col" className="py-2 font-medium">
              #
            </th>
            <th scope="col" className="py-2 font-medium">
              Atleta
            </th>
            <th scope="col" className="py-2 font-medium">
              Cat.
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Tempo
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((r) => (
            <tr key={`${r.modality}-${r.position}-${r.name}`}>
              <td className="py-3 font-mono text-ink">{r.position}</td>
              <td className="py-3 text-ink">{r.name}</td>
              <td className="py-3 text-muted-foreground">{r.category}</td>
              <td className="py-3 text-right font-mono text-ink">{r.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const MAX_DECK_MB = 10;
const EMPTY_FORM = { startupName: "", oneLiner: "", stage: "ideia" as "ideia" | "mvp" | "tracao", videoUrl: "" };

function FoundersPanel({ submissions, submit }: { submissions: MemberSubmission[]; submit: (form: FormData) => Promise<ActionResult> }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [deck, setDeck] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const inReview = submissions.some((s) => s.status === "sent" || s.status === "review");

  async function send(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    if (form.startupName.trim().length < 2) return setError("Informe o nome da startup.");
    if (form.oneLiner.trim().length < 20) return setError("Descreva a startup em pelo menos 20 caracteres.");
    if (!deck && !form.videoUrl.trim()) return setError("Anexe o pitch deck em PDF ou informe o link do vídeo.");
    if (form.videoUrl && !/^https:\/\/\S+\.\S+/.test(form.videoUrl.trim())) return setError("O link do vídeo precisa começar com https://");
    const data = new FormData();
    data.set("startupName", form.startupName.trim());
    data.set("oneLiner", form.oneLiner.trim());
    data.set("stage", form.stage);
    data.set("videoUrl", form.videoUrl.trim());
    if (deck) data.set("deck", deck);
    setBusy(true);
    const result = await submit(data);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setForm(EMPTY_FORM);
    setDeck(null);
    setFileKey((k) => k + 1);
    setSent(true);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section aria-labelledby="founders-form" className="space-y-6 lg:col-span-7">
        <div>
          <h2 id="founders-form" className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            Submeta sua startup
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            O time de Rafael Molina avalia cada projeto. Selecionados sobem ao palco do Founders Demo Day e ganham mentoria.
          </p>
        </div>
        {inReview ? (
          <Notice>Sua startup está em análise. Você pode enviar outra depois do retorno.</Notice>
        ) : (
          <form onSubmit={(e) => void send(e)} className="space-y-5">
            <Field label="Nome da startup">{(id) => <Input id={id} value={form.startupName} maxLength={80} onChange={(e) => setForm({ ...form, startupName: e.target.value })} />}</Field>
            <Field label="Em uma frase, o que ela resolve?">
              {(id) => <Textarea id={id} value={form.oneLiner} maxLength={280} onChange={(e) => setForm({ ...form, oneLiner: e.target.value })} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estágio">
                {(id) => (
                  <Select id={id} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as typeof form.stage })}>
                    <option value="ideia">Ideia</option>
                    <option value="mvp">MVP no ar</option>
                    <option value="tracao">Com tração</option>
                  </Select>
                )}
              </Field>
              <Field label="Link do vídeo (opcional)" hint="YouTube, Loom ou Drive, até 60s.">
                {(id, describedBy) => (
                  <Input id={id} aria-describedby={describedBy} type="url" inputMode="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
                )}
              </Field>
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink">Pitch deck (PDF)</p>
              <label className="mt-1.5 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface px-4 transition-colors hover:bg-line has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                <span className="truncate text-sm text-muted-foreground">{deck ? deck.name : `Selecionar arquivo · até ${MAX_DECK_MB} MB`}</span>
                <IconUpload size={18} className="shrink-0 text-ink" />
                <input
                  key={fileKey}
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > MAX_DECK_MB * 1024 * 1024) {
                      setError(`O arquivo passa de ${MAX_DECK_MB} MB.`);
                      return;
                    }
                    setError(null);
                    setDeck(file);
                  }}
                />
              </label>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" block disabled={busy}>
              {busy ? "Enviando…" : "Enviar para análise"}
            </Button>
          </form>
        )}
        {sent && <Notice tone="success">Startup enviada. Acompanhe o status ao lado.</Notice>}
      </section>

      <section aria-labelledby="founders-status" className="space-y-5 lg:col-span-5">
        <h2 id="founders-status" className="text-xl font-semibold tracking-[-0.02em] text-ink">
          Suas submissões
        </h2>
        {submissions.length === 0 ? (
          <EmptyState title="Nada enviado ainda" body="Depois de enviar, o status aparece aqui." />
        ) : (
          <ul className="space-y-6">
            {submissions.map((submission) => {
              const stepIndex = FOUNDERS_PIPELINE.findIndex((p) => p.status === submission.status);
              return (
                <li key={submission.id} className="rounded-3xl bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[17px] font-semibold text-ink">{submission.startupName}</p>
                    {submission.status === "not_selected" && <Tag>{FOUNDERS_STATUS_LABEL.not_selected}</Tag>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{submission.oneLiner}</p>
                  {submission.status !== "not_selected" && (
                    <>
                      <ol className="mt-5 grid grid-cols-3 gap-2">
                        {FOUNDERS_PIPELINE.map((step, index) => (
                          <li key={step.status}>
                            <span aria-hidden className={cn("block h-1.5 rounded-full", index <= stepIndex ? "bg-primary" : "bg-line")} />
                            <span className={cn("mt-2 block text-[13px]", index <= stepIndex ? "font-medium text-ink" : "text-muted-foreground")}>{step.label}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-[13px] text-muted-foreground">{FOUNDERS_PIPELINE[stepIndex]?.detail}</p>
                    </>
                  )}
                  {submission.adminNote && <p className="mt-3 rounded-2xl bg-card px-4 py-3 text-[13px] text-ink">{submission.adminNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
