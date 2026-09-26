// Hello World
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/components/app/ui";
import { IconReceive, IconSend } from "@/components/icons/prx-icons";
import { TRANSACTION_LABEL, type BankTransaction } from "@/lib/prx/bank";
import { formatEventDate } from "@/lib/live/format";

const txDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Linha de atividade: ícone em círculo, tipo da movimentação, contraparte e valor com sinal. */
export function TransactionRow({ tx, hidden = false }: { tx: BankTransaction; hidden?: boolean }) {
  const incoming = tx.direction === "in";
  const Icon = incoming ? IconReceive : IconSend;
  return (
    <li className="flex items-center gap-3.5 py-3">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[15px] font-medium text-ink">{TRANSACTION_LABEL[tx.kind]}</p>
          <p className={cn("shrink-0 text-[15px] font-medium tabular-nums", incoming ? "text-success" : "text-ink")}>
            {hidden ? "••••" : `${incoming ? "+" : "-"} ${formatBRL(tx.amount)}`}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {tx.counterparty} · {txDate.format(new Date(tx.createdAt)).replace(".", "")}
        </p>
      </div>
    </li>
  );
}

/** Data do evento em bloco tipográfico (dia grande, mês e dia da semana). */
export function EventDate({ iso, tone = "light", size = "md" }: { iso: string; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const date = formatEventDate(iso);
  return (
    <div className={cn("flex shrink-0 flex-col items-start leading-none", tone === "dark" ? "text-white" : "text-ink")}>
      <span className={cn("font-semibold tracking-[-0.04em]", size === "lg" ? "text-6xl" : "text-4xl")}>{date.day}</span>
      <span className={cn("mt-1.5 text-[12px] font-medium leading-tight", tone === "dark" ? "text-white/70" : "text-muted-foreground")}>
        {date.month} · {date.weekday}
        <span className="block">{date.time}</span>
      </span>
    </div>
  );
}

/** Cartão de métrica: rótulo, número e complemento opcional. */
export function StatCell({ label, value, children, className }: { label: string; value: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 rounded-3xl bg-surface p-5 sm:p-6", className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div>
        <p className="text-[30px] font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums">{value}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/** Ação secundária em pílula ("Ver todas", "Agenda"…). */
export function TextLink({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-line active:scale-[0.98] in-[.bg-surface]:bg-card",
        className
      )}
    >
      {children}
    </button>
  );
}
