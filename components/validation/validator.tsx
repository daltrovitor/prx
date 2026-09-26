// Hello World
"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { QrScanner } from "@/components/app/qr-scanner";
import { Button, EmptyState, Field, Input, Notice, Segmented, Sheet, Tag } from "@/components/app/ui";
import { IconCheck, IconClose, IconRefresh } from "@/components/icons/prx-icons";
import type { HistoryEntry } from "@/lib/validation";
import type { DoorTicket } from "@/lib/validation/tickets";
import type { CounterVoucher } from "@/lib/validation/vouchers";

/**
 * Validador universal da portaria e do balcão (parceiro e Equipe PRX).
 * O servidor decide pelo formato se é ingresso (check-in) ou voucher (baixa)
 * e se quem está logado pode validá-lo.
 */

type Result =
  | { kind: "ticket"; ticket: DoorTicket; canConfirm: boolean; warning: string | null }
  | { kind: "voucher"; voucher: CounterVoucher; canConfirm: boolean; warning: string | null };

interface ValidateResponse {
  success?: boolean;
  kind?: "ticket" | "voucher";
  canCheckin?: boolean;
  canRedeem?: boolean;
  warning?: string | null;
  error?: string;
  ticket?: DoorTicket;
  voucher?: CounterVoucher;
}

function toResult(data: ValidateResponse): Result | null {
  if (data.kind === "ticket" && data.ticket) return { kind: "ticket", ticket: data.ticket, canConfirm: Boolean(data.canCheckin), warning: data.warning ?? null };
  if (data.kind === "voucher" && data.voucher) return { kind: "voucher", voucher: data.voucher, canConfirm: Boolean(data.canRedeem), warning: data.warning ?? null };
  return null;
}

async function post(code: string, action: "lookup" | "confirm"): Promise<{ ok: boolean; data: ValidateResponse }> {
  try {
    const res = await fetch("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action }) });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as ValidateResponse };
  } catch {
    return { ok: false, data: { error: "Sem conexão com o servidor." } };
  }
}

export function useValidation() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [version, setVersion] = useState(0);
  const [scanKey, setScanKey] = useState(0);

  const lookup = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await post(raw, "lookup");
    setBusy(false);
    const next = toResult(data);
    if (!ok || !next) {
      setError(data.error || "Código não encontrado. Confira e tente de novo.");
      setScanKey((k) => k + 1);
      return;
    }
    setConfirmed(false);
    setResult(next);
  }, []);

  const confirm = useCallback(async () => {
    if (!result) return;
    const code = result.kind === "ticket" ? result.ticket.code : result.voucher.code;
    setBusy(true);
    const { ok, data } = await post(code, "confirm");
    setBusy(false);
    const next = toResult(data);
    if (!ok || !data.success) {
      setResult((current) => (next ? { ...next, canConfirm: false, warning: data.error || "Não foi possível confirmar." } : current && { ...current, canConfirm: false, warning: data.error || "Não foi possível confirmar." }));
      return;
    }
    if (typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: ["#6c0cf0", "#0b0b10", "#0f7b4f"] });
    }
    if (next) setResult({ ...next, canConfirm: false, warning: null });
    setConfirmed(true);
    setVersion((v) => v + 1);
  }, [result]);

  const close = useCallback(() => {
    setResult(null);
    setConfirmed(false);
    setScanKey((k) => k + 1);
  }, []);

  return { result, busy, error, setError, confirmed, version, scanKey, lookup, confirm, close };
}

export type Validation = ReturnType<typeof useValidation>;

/* -------------------------------------------------------------------------- */

type Mode = "scanner" | "manual";

async function fetchHistory(): Promise<HistoryEntry[] | null> {
  try {
    const res = await fetch("/api/validate", { cache: "no-store" });
    const data = (await res.json()) as { history?: HistoryEntry[] };
    return res.ok && Array.isArray(data.history) ? data.history : null;
  } catch {
    return null;
  }
}

export function ValidatorPanel({ validation, hint }: { validation: Validation; hint: string }) {
  const [mode, setMode] = useState<Mode>("scanner");
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { lookup, busy, error, setError, result, scanKey, version } = validation;

  const loadHistory = useCallback(async () => {
    const list = await fetchHistory();
    if (list) setHistory(list);
  }, []);

  useEffect(() => {
    let active = true;
    fetchHistory().then((list) => {
      if (active && list) setHistory(list);
    });
    return () => {
      active = false;
    };
  }, [version]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    void lookup(code);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section aria-labelledby="validate-title" className="space-y-6 lg:col-span-7">
        <div>
          <h2 id="validate-title" className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
            Validar
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">{hint}</p>
        </div>

        <Segmented
          label="Forma de validação"
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError(null);
          }}
          options={[
            { value: "scanner", label: "Câmera" },
            { value: "manual", label: "Código" },
          ]}
        />

        {mode === "scanner" ? (
          <QrScanner key={scanKey} onScan={(text) => void lookup(text)} active={!result && !busy} />
        ) : (
          <form onSubmit={submitManual} className="space-y-4">
            <Field label="Código" hint="Ingresso: UP-0000-0000 ou RUN-0000-0000 · Voucher: PRX-0000-0000.">
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-lg tracking-[0.12em]"
                />
              )}
            </Field>
            <Button type="submit" block disabled={busy || !code.trim()}>
              {busy ? "Consultando…" : "Consultar"}
            </Button>
          </form>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </section>

      <section aria-labelledby="history-title" className="space-y-4 lg:col-span-5">
        <div className="flex items-end justify-between gap-4">
          <h2 id="history-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Últimas validações
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void loadHistory()} aria-label="Atualizar histórico">
            <IconRefresh size={16} />
          </Button>
        </div>
        {history.length === 0 ? (
          <EmptyState title="Nada validado ainda" body="Entradas e baixas registradas por você aparecem aqui." />
        ) : (
          <ul className="space-y-2">
            {history.map((entry) =>
              entry.kind === "ticket" ? (
                <li key={entry.key} className="flex items-center justify-between gap-4 rounded-3xl bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-ink">{entry.ticket.code}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {entry.ticket.eventTitle} · {entry.ticket.holderName}
                    </p>
                  </div>
                  <Tag tone="accent">Entrada</Tag>
                </li>
              ) : (
                <li key={entry.key} className="flex items-center justify-between gap-4 rounded-3xl bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-ink">{entry.voucher.code}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {entry.voucher.benefitTitle || entry.voucher.discountLabel} · {entry.voucher.userName}
                    </p>
                  </div>
                  <Tag tone={entry.voucher.status === "used" ? "neutral" : "accent"}>{entry.voucher.status === "used" ? "Baixado" : "Pendente"}</Tag>
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

export function ValidationSheet({ validation }: { validation: Validation }) {
  const { result, confirmed, busy, confirm, close } = validation;
  const failed = !confirmed && Boolean(result) && !result?.canConfirm;

  let title = "Consulta";
  if (result?.kind === "ticket") {
    title = confirmed ? "Entrada liberada" : result.ticket.status === "used" ? "Ingresso já utilizado" : result.canConfirm ? "Ingresso válido" : "Entrada não liberada";
  } else if (result?.kind === "voucher") {
    title = confirmed ? "Baixa registrada" : result.voucher.status === "used" ? "Voucher já utilizado" : result.voucher.expired ? "Voucher expirado" : result.canConfirm ? "Voucher válido" : "Voucher não aceito";
  }

  return (
    <Sheet
      open={Boolean(result)}
      onClose={close}
      title={title}
      description={result?.kind === "ticket" ? result.ticket.eventTitle : result?.voucher.benefitTitle}
      footer={
        result?.canConfirm && !confirmed ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Registrando…" : result.kind === "ticket" ? "Liberar entrada" : "Confirmar uso e dar baixa"}
            </Button>
          </div>
        ) : (
          <Button block variant="ink" onClick={close}>
            Validar outro
          </Button>
        )
      }
    >
      {result && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${failed ? "bg-destructive" : "bg-success"}`}>
              {failed ? <IconClose size={22} /> : <IconCheck size={24} />}
            </span>
            <p className="min-w-0 break-words text-3xl font-semibold tracking-[-0.035em] text-ink">
              {result.kind === "ticket" ? result.ticket.holderName : result.voucher.discountLabel}
            </p>
          </div>

          {result.kind === "ticket" ? (
            <dl className="divide-y divide-line rounded-3xl bg-surface px-4 text-[15px]">
              <Row label="Código">
                <span className="font-mono">{result.ticket.code}</span>
              </Row>
              <Row label="Evento">{result.ticket.eventTitle}</Row>
              {result.ticket.eventStartsAt && <Row label="Início">{result.ticket.eventStartsAt}</Row>}
              <Row label="Lote">
                {result.ticket.batchName}
                {result.ticket.source === "invite" ? " · convite" : ""}
              </Row>
              {result.ticket.run && (
                <Row label="Inscrição">
                  {result.ticket.run.modality.toUpperCase()} · {result.ticket.run.category} · camiseta {result.ticket.run.shirtSize}
                </Row>
              )}
              <Row label="Situação">{result.ticket.statusLabel}</Row>
              {result.ticket.checkedInAt && (
                <Row label="Entrada">
                  {result.ticket.checkedInAt}
                  {result.ticket.checkedInBy ? ` · ${result.ticket.checkedInBy}` : ""}
                </Row>
              )}
            </dl>
          ) : (
            <>
              <dl className="divide-y divide-line rounded-3xl bg-surface px-4 text-[15px]">
                <Row label="Código">
                  <span className="font-mono">{result.voucher.code}</span>
                </Row>
                {result.voucher.partnerName && <Row label="Parceiro">{result.voucher.partnerName}</Row>}
                <Row label="Cliente">{result.voucher.userName || "Membro PRX"}</Row>
                <Row label="Resgatado">{result.voucher.redeemedAt}</Row>
                {result.voucher.expiresAt && <Row label="Usar até">{result.voucher.expiresAt}</Row>}
                {result.voucher.validatedAt && <Row label="Baixa">{result.voucher.validatedAt}</Row>}
              </dl>
              {result.voucher.terms && <p className="text-sm text-muted-foreground">Regra: {result.voucher.terms}</p>}
            </>
          )}

          {result.warning && <Notice tone="warning">{result.warning}</Notice>}
        </div>
      )}
    </Sheet>
  );
}
