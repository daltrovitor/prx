// Hello World
"use client";

import { useState, type KeyboardEvent } from "react";
import { Button, Field, Input, Tag, Textarea } from "@/components/app/ui";
import { cn } from "@/lib/utils";
import { LEGAL_STATUSES, MODULE_LABEL, PRIORITY_LABEL, STATUS_LABEL, type LegalChecklistItem, type LegalPriority, type LegalStatus } from "@/lib/legal/checklist-data";

/*
 * Um item do Checklist Jurídico: status com um toque (salva na hora), responsável
 * e parecer com "Salvar" (ou Ctrl+Enter). Três formatos: item completo da matriz e
 * das frentes, documento pré-lançamento e pergunta do Mapa do Dinheiro.
 */

export type LegalPatchInput = Partial<Pick<LegalChecklistItem, "status" | "responsible" | "notes">>;
export type LegalCardVariant = "item" | "document" | "question";

const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const STATUS_STYLE: Record<LegalStatus, string> = {
  pending: "bg-surface text-muted-foreground",
  in_review: "bg-warning/[0.12] text-warning",
  done: "bg-success/[0.12] text-success",
  blocker: "bg-destructive/[0.1] text-destructive",
};

const PRIORITY_TONE: Record<LegalPriority, "ink" | "accent" | "neutral"> = { CRITICA: "ink", ALTA: "accent", MEDIA: "neutral" };

/** Seletor de status em quatro botões (radiogroup): o escolhido ganha a cor do status. */
function StatusPicker({ value, onChange, disabled, label, compact }: { value: LegalStatus; onChange: (s: LegalStatus) => void; disabled: boolean; label: string; compact: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-1.5", !compact && "sm:grid-cols-4")}>
      {LEGAL_STATUSES.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(s)}
            className={cn(
              "min-h-12 cursor-pointer rounded-2xl px-3 text-[13px] font-medium transition-colors disabled:cursor-wait",
              active ? cn(STATUS_STYLE[s], "font-semibold ring-1 ring-current/25") : "text-muted-foreground hover:bg-surface hover:text-ink"
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export function LegalItemCard({
  item,
  variant = "item",
  onPatch,
}: {
  item: LegalChecklistItem;
  variant?: LegalCardVariant;
  onPatch: (id: string, patch: LegalPatchInput) => Promise<boolean>;
}) {
  const [responsible, setResponsible] = useState(item.responsible);
  const [notes, setNotes] = useState(item.notes);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(variant === "question" || Boolean(item.notes));
  const dirty = responsible.trim() !== item.responsible || notes !== item.notes;
  const notesLabel = variant === "question" ? "Resposta (por operação: PASS, LIVE, BANK, INVEST, Coins)" : "Parecer jurídico / anotações";

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    await onPatch(item.id, { responsible: responsible.trim(), notes });
    setBusy(false);
  }

  async function setStatus(status: LegalStatus) {
    setBusy(true);
    await onPatch(item.id, { status });
    setBusy(false);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void save();
    }
  }

  const headingId = `legal-${item.id}`;
  return (
    <article aria-labelledby={headingId} className={cn("glass-soft space-y-4 rounded-3xl p-4 sm:p-5", item.status === "blocker" && "ring-1 ring-destructive/40")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABEL[item.priority]}</Tag>
        <Tag>{MODULE_LABEL[item.module]}</Tag>
        {item.authority && <Tag tone="accent">{item.authority}</Tag>}
        {variant === "document" && (
          <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5", item.status === "done" ? STATUS_STYLE.done : STATUS_STYLE.pending)}>
            {item.status === "done" ? "Pronto" : "Pendente"}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h4 id={headingId} className="text-pretty break-words text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {variant === "question" && <span className="mr-2 text-primary tabular-nums">{item.id.replace("q-", "")}.</span>}
          {item.title}
        </h4>
        {variant !== "document" && <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-muted-foreground">{item.description}</p>}
        {item.suggestedResponsible && variant === "item" && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Responsável ideal no documento: <span className="font-medium text-ink">{item.suggestedResponsible}</span>
          </p>
        )}
      </div>

      <StatusPicker value={item.status} onChange={(s) => void setStatus(s)} disabled={busy} label={`Status: ${item.title}`} compact={variant === "document"} />

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-12 cursor-pointer text-[14px] font-medium text-primary hover:underline">
          {variant === "document" ? "Responsável e anotações" : "Adicionar responsável e parecer"}
        </button>
      ) : (
        <div className="space-y-3">
          <Field label="Responsável">
            {(id) => <Input id={id} value={responsible} maxLength={120} placeholder={item.suggestedResponsible || "Quem conduz este item"} onChange={(e) => setResponsible(e.target.value)} />}
          </Field>
          <Field label={notesLabel} hint="Ctrl+Enter salva.">
            {(id, describedBy) => <Textarea id={id} aria-describedby={describedBy} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} onKeyDown={onKey} />}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              {item.updatedAt ? `Atualizado ${when.format(new Date(item.updatedAt))}${item.updatedBy ? ` por ${item.updatedBy}` : ""}` : "Sem alterações registradas"}
            </p>
            <Button size="sm" onClick={() => void save()} disabled={!dirty || busy}>
              {busy ? "Salvando…" : dirty ? "Salvar" : "Salvo"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
