// Hello World
"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import type { User } from "@/hooks/use-auth";
import { useAppNav } from "@/components/app/app-nav";
import { useBank, useLiveWallet } from "@/components/app/use-prx-stores";
import { EventDate, SandboxNotice } from "@/components/app/shared";
import { CopyButton, useQrDataUrl } from "@/components/app/pass/voucher-sheet";
import { Button, EmptyState, Field, Input, Notice, Segmented, Select, Sheet, Tag, Textarea, formatBRL } from "@/components/app/ui";
import { IconCheck, IconUpload } from "@/components/icons/prx-icons";
import { BankError, debitBalance } from "@/lib/prx/bank";
import {
  FOUNDERS_PIPELINE,
  LIVE_EVENTS,
  RUN_CATEGORIES,
  RUN_RESULTS,
  RUN_STAGES,
  SERIES_LABEL,
  SHIRT_SIZES,
  issueTicket,
  registerForRun,
  submitToFounders,
  ticketQrPayload,
  type EventSeries,
  type LiveEvent,
  type RunCategory,
  type RunModality,
  type ShirtSize,
  type Ticket,
} from "@/lib/prx/live";
import { cn } from "@/lib/utils";

type LiveSection = "eventos" | "ingressos" | "run" | "founders";
const SECTIONS: ReadonlyArray<LiveSection> = ["eventos", "ingressos", "run", "founders"];

export function LiveScreen({ member }: { member: User }) {
  const { sub, go } = useAppNav();
  const section: LiveSection = SECTIONS.includes(sub as LiveSection) ? (sub as LiveSection) : "eventos";
  const [wallet] = useLiveWallet(member.id);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="font-display text-4xl min-[380px]:text-5xl sm:text-6xl font-semibold leading-[0.95] tracking-[-0.045em] text-ink">PRX LIVE</h1>
        <p className="max-w-md text-sm sm:text-[15px] text-muted-foreground">Eventos, corridas e o palco das startups. Ingresso na carteira, QR na portaria.</p>
      </header>

      <Segmented
        label="Seções do PRX LIVE"
        value={section}
        onChange={(value) => go("live", value === "eventos" ? null : value)}
        options={[
          { value: "eventos", label: "Agenda", count: LIVE_EVENTS.length },
          { value: "ingressos", label: "Meus ingressos", count: wallet.tickets.length },
          { value: "run", label: "PRX RUN" },
          { value: "founders", label: "Founders" },
        ]}
      />

      {section === "eventos" && <EventsPanel member={member} onBought={() => go("live", "ingressos")} />}
      {section === "ingressos" && <TicketsPanel member={member} onBrowse={() => go("live")} />}
      {section === "run" && <RunPanel member={member} />}
      {section === "founders" && <FoundersPanel member={member} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

type PayMethod = "saldo" | "pix" | "card";

function EventsPanel({ member, onBought }: { member: User; onBought: () => void }) {
  const [series, setSeries] = useState<EventSeries | "all">("all");
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const [batchId, setBatchId] = useState<string>("");
  const [method, setMethod] = useState<PayMethod>("saldo");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Ticket | null>(null);
  const [, setWallet] = useLiveWallet(member.id);
  const [bank, setBank] = useBank(member.id);

  const events = useMemo(
    () => LIVE_EVENTS.filter((e) => series === "all" || e.series === series).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [series]
  );

  function open(event: LiveEvent) {
    setSelected(event);
    setBatchId(event.batches.find((b) => !b.closed)?.id ?? "");
    setError(null);
  }

  const batch = selected?.batches.find((b) => b.id === batchId);

  function checkout() {
    if (!selected || !batch) return;
    setError(null);
    if (batch.closed) {
      setError("Este lote está encerrado.");
      return;
    }
    if (batch.price > 0 && method === "saldo" && batch.price > bank.balance) {
      setError("Saldo PRX BANK insuficiente. Escolha Pix ou cartão.");
      return;
    }
    try {
      if (batch.price > 0 && method === "saldo") {
        setBank((state) =>
          debitBalance(state, { amount: batch.price, kind: "ticket", counterparty: `PRX UP · ${selected.title}`, description: `${batch.name}` })
        );
      }
      let ticket: Ticket | null = null;
      setWallet((current) => {
        const result = issueTicket(current, {
          event: selected,
          batch,
          holderName: member.name || "Membro PRX",
          paymentMethod: method === "card" ? "card" : "pix",
        });
        ticket = result.ticket;
        return result.wallet;
      });
      setSelected(null);
      setIssued(ticket);
    } catch (err) {
      setError(err instanceof BankError || err instanceof Error ? err.message : "Não foi possível concluir a compra.");
    }
  }

  return (
    <section aria-label="Agenda de eventos" className="space-y-6">
      <div role="group" aria-label="Séries" className="-mx-3.5 px-3.5 min-[380px]:-mx-4 min-[380px]:px-4 flex gap-2 overflow-x-auto scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0 touch-pan-x overscroll-x-contain">
        {(["all", "founders", "session", "ctrl", "talks"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={series === value}
            onClick={() => setSeries(value)}
            className={cn(
              "min-h-10 shrink-0 cursor-pointer rounded-[2px] border px-3 sm:px-3.5 text-xs sm:text-sm whitespace-nowrap transition-colors",
              series === value ? "border-primary bg-primary text-white" : "border-line text-muted-foreground hover:border-ink hover:text-ink"
            )}
          >
            {value === "all" ? "Todos" : SERIES_LABEL[value]}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {events.map((event) => {
          const open_ = event.batches.filter((b) => !b.closed);
          const from = open_.length ? Math.min(...open_.map((b) => b.price)) : null;
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => open(event)}
                className="group grid w-full cursor-pointer grid-cols-[auto_1fr] items-start gap-4 py-5 text-left sm:grid-cols-[120px_1fr_auto] sm:items-center sm:gap-8 sm:py-6"
              >
                <EventDate iso={event.startsAt} />
                <div className="min-w-0 space-y-1.5 sm:space-y-2">
                  <p className="font-mono text-[11px] sm:text-[12px] tracking-[0.08em] text-primary">{SERIES_LABEL[event.series].toUpperCase()}</p>
                  <p className="font-display text-xl sm:text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink group-hover:underline group-hover:underline-offset-4">
                    {event.title}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {event.venue} · {event.city}
                  </p>
                </div>
                <p className="col-span-2 text-sm text-ink sm:col-span-1 sm:text-right">
                  {from === null ? "Esgotado" : from === 0 ? "Gratuito" : <>a partir de <span className="font-medium tabular-nums">{formatBRL(from)}</span></>}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Evento"}
        description={selected ? `${SERIES_LABEL[selected.series]} · ${selected.venue}, ${selected.city}` : undefined}
        footer={
          <Button block onClick={checkout} disabled={!batch || batch.closed}>
            {batch ? (batch.price === 0 ? "Garantir ingresso gratuito" : `Pagar ${formatBRL(batch.price)}`) : "Escolha um lote"}
          </Button>
        }
      >
        {selected && (
          <div className="space-y-7">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[15px] leading-relaxed text-ink">{selected.summary}</p>
              <EventDate iso={selected.startsAt} />
            </div>

            <fieldset>
              <legend className="text-[13px] font-semibold text-ink">Lote</legend>
              <div className="mt-3 divide-y divide-line border-y border-line">
                {selected.batches.map((b) => (
                  <label
                    key={b.id}
                    className={cn("flex min-h-14 items-center justify-between gap-4 py-2", b.closed ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="batch"
                        value={b.id}
                        disabled={b.closed}
                        checked={batchId === b.id}
                        onChange={() => setBatchId(b.id)}
                        className="h-4 w-4 cursor-pointer accent-[#6c0cf0]"
                      />
                      <span className="text-[15px] text-ink">{b.name}</span>
                      {b.closed && <Tag>Encerrado</Tag>}
                    </span>
                    <span className="text-[15px] font-medium tabular-nums text-ink">{b.price === 0 ? "Grátis" : formatBRL(b.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {batch && batch.price > 0 && (
              <fieldset>
                <legend className="text-[13px] font-semibold text-ink">Pagamento</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["saldo", "Saldo PRX", formatBRL(bank.balance)],
                      ["pix", "Pix", "na hora"],
                      ["card", "Cartão", "crédito"],
                    ] as const
                  ).map(([value, label, detail]) => (
                    <label
                      key={value}
                      className={cn(
                        "flex min-h-16 cursor-pointer flex-col justify-center border px-3 py-2 transition-colors",
                        method === value ? "border-primary bg-primary text-white" : "border-line text-ink hover:border-ink"
                      )}
                    >
                      <input type="radio" name="pay" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                      <span className="text-sm font-medium">{label}</span>
                      <span className={cn("text-[12px]", method === value ? "text-white/80" : "text-muted-foreground")}>{detail}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Pagamento simulado no modo demonstração. Na versão final o checkout passa pelo orquestrador (Pix, cartão e split com o organizador).
                </p>
              </fieldset>
            )}

            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}
      </Sheet>

      <TicketSheet
        ticket={issued}
        onClose={() => {
          setIssued(null);
          onBought();
        }}
        title="Ingresso garantido"
      />
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function TicketSheet({ ticket, onClose, title }: { ticket: Ticket | null; onClose: () => void; title?: string }) {
  const event = ticket ? LIVE_EVENTS.find((e) => e.id === ticket.eventId) : undefined;
  const batch = event?.batches.find((b) => b.id === ticket?.batchId);
  const qr = useQrDataUrl(ticket ? ticketQrPayload(ticket) : null);
  return (
    <Sheet open={Boolean(ticket)} onClose={onClose} title={title ?? event?.title ?? "Ingresso"} description={event ? `${event.venue} · ${event.city}` : undefined}>
      {ticket && event && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{event.title}</p>
              <p className="text-sm text-muted-foreground">
                {batch?.name} · {ticket.holderName}
              </p>
            </div>
            <EventDate iso={event.startsAt} />
          </div>
          <div className="mx-auto w-full max-w-[280px] border border-line p-3">
            {qr ? <Image src={qr} alt={`QR Code do ingresso ${ticket.code}`} width={280} height={280} unoptimized className="h-auto w-full" /> : <div className="aspect-square bg-surface" />}
          </div>
          <div className="flex items-center justify-between gap-4 border-y border-line py-4">
            <div>
              <p className="text-[13px] text-muted-foreground">Código do ingresso</p>
              <p className="font-mono text-lg tracking-[0.12em] text-ink">{ticket.code}</p>
            </div>
            <CopyButton value={ticket.code} />
          </div>
          <p className="text-sm text-muted-foreground">Na portaria, mostre o QR Code. Cada ingresso vale uma entrada e é validado na hora.</p>
        </div>
      )}
    </Sheet>
  );
}

function TicketsPanel({ member, onBrowse }: { member: User; onBrowse: () => void }) {
  const [wallet] = useLiveWallet(member.id);
  const [open, setOpen] = useState<Ticket | null>(null);

  if (wallet.tickets.length === 0) {
    return <EmptyState title="Sua carteira de ingressos está vazia" body="Escolha um evento na agenda para garantir o seu." action={<Button onClick={onBrowse}>Ver agenda</Button>} />;
  }

  return (
    <section aria-label="Meus ingressos">
      <ul className="grid gap-4 sm:grid-cols-2">
        {wallet.tickets.map((ticket) => {
          const event = LIVE_EVENTS.find((e) => e.id === ticket.eventId);
          if (!event) return null;
          return (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => setOpen(ticket)}
                className="flex w-full cursor-pointer items-stretch border border-line text-left transition-colors hover:border-ink"
              >
                <div className="flex flex-col justify-between bg-[#0b0b10] dark:bg-[#12121c] p-5">
                  <EventDate iso={event.startsAt} tone="dark" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
                  <div>
                    <p className="font-mono text-[12px] tracking-[0.08em] text-primary">{SERIES_LABEL[event.series].toUpperCase()}</p>
                    <p className="mt-1 truncate text-[17px] font-semibold text-ink">{event.title}</p>
                  </div>
                  <p className="font-mono text-[13px] text-muted-foreground">{ticket.code}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <TicketSheet ticket={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function RunPanel({ member }: { member: User }) {
  const [wallet, setWallet] = useLiveWallet(member.id);
  const upcoming = RUN_STAGES.find((s) => !s.finished);
  const past = RUN_STAGES.filter((s) => s.finished);
  const registration = upcoming ? wallet.runRegistrations.find((r) => r.stageId === upcoming.id) : undefined;

  const [modality, setModality] = useState<RunModality>(upcoming?.modalities[0] ?? "5k");
  const [category, setCategory] = useState<RunCategory>("Geral");
  const [shirt, setShirt] = useState<ShirtSize>("M");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsFilter, setResultsFilter] = useState<RunModality>("10k");
  const kitQr = useQrDataUrl(registration ? `PRX_RUN::${registration.kitCode}::${registration.stageId}` : null);

  function register(event: FormEvent) {
    event.preventDefault();
    if (!upcoming) return;
    if (!accepted) {
      setError("Aceite o termo de responsabilidade para concluir a inscrição.");
      return;
    }
    try {
      setWallet((current) => registerForRun(current, { stageId: upcoming.id, modality, category, shirtSize: shirt }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a inscrição.");
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      {upcoming && (
        <section aria-labelledby="run-next" className="space-y-6 lg:col-span-7">
          <div className="flex items-start justify-between gap-4 sm:gap-6 border-b border-line pb-6">
            <div>
              <h2 id="run-next" className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-ink">
                {upcoming.title}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">{upcoming.location}</p>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Retirada do kit: {upcoming.kitPickup}</p>
            </div>
            <EventDate iso={upcoming.startsAt} />
          </div>

          {registration ? (
            <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
              <div className="border border-line p-2 max-w-[220px] sm:max-w-none mx-auto sm:mx-0 w-full">
                {kitQr ? <Image src={kitQr} alt={`QR Code de retirada do kit ${registration.kitCode}`} width={280} height={280} unoptimized className="h-auto w-full" /> : <div className="aspect-square bg-surface" />}
              </div>
              <div className="space-y-4">
                <Tag tone="success">
                  <IconCheck size={14} /> Inscrição confirmada
                </Tag>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Distância</dt>
                    <dd className="font-display text-2xl font-semibold uppercase text-ink">{registration.modality}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Categoria</dt>
                    <dd className="font-medium text-ink">{registration.category}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Camiseta</dt>
                    <dd className="font-medium text-ink">{registration.shirtSize}</dd>
                  </div>
                </dl>
                <p className="text-sm text-muted-foreground">
                  Apresente este QR na retirada do kit. Código <span className="font-mono text-ink">{registration.kitCode}</span>.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={register} className="space-y-6">
              <fieldset>
                <legend className="text-[13px] font-semibold text-ink">Distância</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {upcoming.modalities.map((m) => (
                    <label
                      key={m}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center justify-center border font-display text-2xl font-semibold uppercase tracking-[-0.02em] transition-colors",
                        modality === m ? "border-primary bg-primary text-white" : "border-line text-ink hover:border-ink"
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
                    <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as RunCategory)}>
                      {RUN_CATEGORIES.map((c) => (
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
              <label className="flex cursor-pointer gap-3 border border-line p-4 text-sm leading-relaxed text-muted-foreground">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#6c0cf0]" />
                <span>
                  Declaro estar em condições de saúde para participar da prova, conheço o percurso e assumo a responsabilidade pela minha
                  participação, conforme o regulamento da etapa.
                </span>
              </label>
              {error && <Notice tone="error">{error}</Notice>}
              <Button type="submit" block>
                Inscrever-se · {formatBRL(upcoming.fee)}
              </Button>
            </form>
          )}
        </section>
      )}

      {past.map((stage) => {
        const results = (RUN_RESULTS[stage.id] ?? []).filter((r) => r.modality === resultsFilter);
        return (
          <section key={stage.id} aria-labelledby={`res-${stage.id}`} className="space-y-5 lg:col-span-5">
            <h2 id={`res-${stage.id}`} className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
              Resultados · {stage.title}
            </h2>
            <Segmented
              label="Distância"
              value={resultsFilter}
              onChange={setResultsFilter}
              options={stage.modalities.map((m) => ({ value: m, label: m.toUpperCase() }))}
            />
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Classificação {resultsFilter}</caption>
              <thead>
                <tr className="border-b border-line text-[13px] text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">#</th>
                  <th scope="col" className="py-2 font-medium">Atleta</th>
                  <th scope="col" className="py-2 font-medium">Cat.</th>
                  <th scope="col" className="py-2 text-right font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((r) => (
                  <tr key={`${r.modality}-${r.position}`}>
                    <td className="py-3 font-mono text-ink">{r.position}</td>
                    <td className="py-3 text-ink">{r.name}</td>
                    <td className="py-3 text-muted-foreground">{r.category}</td>
                    <td className="py-3 text-right font-mono text-ink">{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13px] text-muted-foreground">Dados de exemplo até a integração com a cronometragem oficial.</p>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const MAX_DECK_MB = 20;

function FoundersPanel({ member }: { member: User }) {
  const [wallet, setWallet] = useLiveWallet(member.id);
  const [form, setForm] = useState({ startupName: "", oneLiner: "", stage: "ideia" as "ideia" | "mvp" | "tracao", videoUrl: "" });
  const [deck, setDeck] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.startupName.trim().length < 2) return setError("Informe o nome da startup.");
    if (form.oneLiner.trim().length < 20) return setError("Descreva a startup em pelo menos 20 caracteres.");
    if (!deck) return setError("Anexe o pitch deck em PDF.");
    if (form.videoUrl && !/^https?:\/\/\S+\.\S+/.test(form.videoUrl)) return setError("O link do vídeo precisa começar com https://");
    setWallet((current) =>
      submitToFounders(current, {
        startupName: form.startupName.trim(),
        oneLiner: form.oneLiner.trim(),
        stage: form.stage,
        deckFileName: deck.name,
        videoUrl: form.videoUrl.trim(),
      })
    );
    setForm({ startupName: "", oneLiner: "", stage: "ideia", videoUrl: "" });
    setDeck(null);
    setSent(true);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section aria-labelledby="founders-form" className="space-y-6 lg:col-span-7">
        <div>
          <h2 id="founders-form" className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">
            Submeta sua startup
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            O time de Rafael Molina avalia cada projeto. Selecionados sobem ao palco do Founders Demo Day e ganham mentoria.
          </p>
        </div>
        <SandboxNotice>
          Nesta versão a submissão fica salva no seu aparelho e o arquivo não é enviado. O envio para a esteira de análise entra junto com o painel do
          organizador.
        </SandboxNotice>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Nome da startup">
            {(id) => <Input id={id} value={form.startupName} onChange={(e) => setForm({ ...form, startupName: e.target.value })} />}
          </Field>
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
            <label className="mt-1.5 flex min-h-14 cursor-pointer items-center justify-between gap-4 border border-dashed border-input px-4 transition-colors hover:border-ink">
              <span className="truncate text-sm text-muted-foreground">{deck ? deck.name : `Selecionar arquivo · até ${MAX_DECK_MB} MB`}</span>
              <IconUpload size={18} className="shrink-0 text-ink" />
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > MAX_DECK_MB * 1024 * 1024) {
                    setError(`O arquivo passa de ${MAX_DECK_MB} MB.`);
                    return;
                  }
                  setDeck(file);
                }}
              />
            </label>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {sent && <Notice tone="success">Startup enviada. Acompanhe o status ao lado.</Notice>}
          <Button type="submit" block>
            Enviar para análise
          </Button>
        </form>
      </section>

      <section aria-labelledby="founders-status" className="space-y-5 lg:col-span-5">
        <h2 id="founders-status" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
          Suas submissões
        </h2>
        {wallet.foundersSubmissions.length === 0 ? (
          <EmptyState title="Nada enviado ainda" body="Depois de enviar, o status aparece aqui." />
        ) : (
          <ul className="space-y-6">
            {wallet.foundersSubmissions.map((submission) => {
              const stepIndex = FOUNDERS_PIPELINE.findIndex((p) => p.status === submission.status);
              return (
                <li key={submission.id} className="border border-line p-5">
                  <p className="text-[17px] font-semibold text-ink">{submission.startupName}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{submission.oneLiner}</p>
                  <ol className="mt-5 grid grid-cols-3 gap-2">
                    {FOUNDERS_PIPELINE.map((step, index) => (
                      <li key={step.status}>
                        <span aria-hidden className={cn("block h-1", index <= stepIndex ? "bg-ink" : "bg-line")} />
                        <span className={cn("mt-2 block text-[13px]", index <= stepIndex ? "font-medium text-ink" : "text-muted-foreground")}>
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[13px] text-muted-foreground">{FOUNDERS_PIPELINE[stepIndex]?.detail}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
