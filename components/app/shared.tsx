// Hello World
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/components/app/ui";
import { TRANSACTION_LABEL, type BankTransaction } from "@/lib/prx/bank";
import { formatEventDate } from "@/lib/prx/live";

const txDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Linha do extrato: contraparte, tipo e valor com sinal. */
export function TransactionRow({ tx, hidden = false }: { tx: BankTransaction; hidden?: boolean }) {
  const incoming = tx.direction === "in";
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center font-mono text-[13px] font-semibold",
            incoming ? "bg-primary/[0.08] text-primary" : "bg-surface text-ink"
          )}
        >
          {incoming ? "+" : "−"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{tx.counterparty}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {TRANSACTION_LABEL[tx.kind]} · {txDate.format(new Date(tx.createdAt)).replace(".", "")}
          </p>
        </div>
      </div>
      <p className={cn("shrink-0 text-[15px] font-medium tabular-nums", incoming ? "text-primary" : "text-ink")}>
        {hidden ? "••••" : `${incoming ? "+" : "−"} ${formatBRL(tx.amount)}`}
      </p>
    </li>
  );
}

/** Data do evento em bloco tipográfico (dia grande, mês e dia da semana). */
export function EventDate({ iso, tone = "light", size = "md" }: { iso: string; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const date = formatEventDate(iso);
  return (
    <div className={cn("flex shrink-0 flex-col items-start leading-none", tone === "dark" ? "text-white" : "text-ink")}>
      <span className={cn("font-display font-semibold tracking-[-0.04em]", size === "lg" ? "text-6xl" : "text-4xl")}>{date.day}</span>
      <span className={cn("mt-1.5 font-mono text-[12px] leading-tight tracking-[0.08em]", tone === "dark" ? "text-white/70" : "text-muted-foreground")}>
        {date.month} · {date.weekday.toUpperCase()}
        <span className="block">{date.time}</span>
      </span>
    </div>
  );
}

/** Célula de métrica usada na grade de KPIs. */
export function StatCell({ label, value, children, className }: { label: string; value: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 bg-card p-5 sm:p-6", className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div>
        <p className="font-display text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">{value}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/** Link de texto com seta, para "ver tudo". */
export function TextLink({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline",
        className
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
        →
      </span>
    </button>
  );
}

/** Aviso fixo do modo demonstração (nenhum dinheiro real é movimentado). */
export function SandboxNotice({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-warning bg-warning/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-warning">{children}</p>
  );
}
