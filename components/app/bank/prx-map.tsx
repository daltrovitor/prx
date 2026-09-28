// Hello World
"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { EmptyState, Segmented, formatBRL } from "@/components/app/ui";
import { MAP_PERIODS, filterTransactions, spendingByCategory, summarize, type BankTransaction, type SpendingSlice, type StatementPeriod } from "@/lib/prx/bank";
import { cn } from "@/lib/utils";

/*
 * PRX Map: para onde foi o dinheiro, por nicho (BITE, STYLE, GEAR…).
 * Rosca de parte-do-todo com no máximo 5 fatias (o resto vira "Outros"),
 * rampa de um só violeta em que a cor acompanha o tamanho da fatia, 2px de
 * respiro entre fatias e a legenda sempre visível (a legenda é a tabela).
 * Passar o mouse ou focar uma linha destaca a fatia e mostra o valor no centro.
 */

const MAX_SLICES = 5;
const SIZE = 184;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

type MapPeriod = (typeof MAP_PERIODS)[number]["value"];

/** Até 5 fatias: as 4 maiores e o restante somado em "Outros". */
function fold(slices: SpendingSlice[]): SpendingSlice[] {
  if (slices.length <= MAX_SLICES) return slices;
  const head = slices.slice(0, MAX_SLICES - 1);
  const tail = slices.slice(MAX_SLICES - 1);
  const others = tail.reduce((acc, s) => ({ ...acc, amount: acc.amount + s.amount, pct: acc.pct + s.pct }), { id: "outros-agrupado", name: "Outros", code: `${tail.length} nichos`, amount: 0, pct: 0 });
  return [...head, { ...others, amount: Math.round(others.amount * 100) / 100 }];
}

export function PrxMap({ transactions, hidden }: { transactions: BankTransaction[]; hidden: boolean }) {
  const [period, setPeriod] = useState<MapPeriod>(30);
  const [focused, setFocused] = useState<string | null>(null);

  const { totals, slices } = useMemo(() => {
    const list = filterTransactions(transactions, period as StatementPeriod, "all");
    return { totals: summarize(list), slices: fold(spendingByCategory(list)) };
  }, [transactions, period]);

  const current = MAP_PERIODS.find((p) => p.value === period) ?? MAP_PERIODS[0];
  const active = slices.find((s) => s.id === focused) ?? null;
  const money = (value: number) => (hidden ? "••••" : formatBRL(value));

  const arcs = slices.map((slice, index) => {
    const length = (slice.pct / 100) * CIRCUMFERENCE;
    const offset = slices.slice(0, index).reduce((sum, s) => sum + (s.pct / 100) * CIRCUMFERENCE, 0);
    return { slice, index, dash: Math.max(0, slices.length > 1 ? length - GAP : length), offset };
  });

  return (
    <section aria-labelledby="prx-map-title" className="space-y-5 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="prx-map-title" className="text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
            PRX Map
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Seus gastos por nicho · {current.long.toLowerCase()}</p>
        </div>
        <Segmented
          label="Período do PRX Map"
          value={String(period)}
          onChange={(value) => {
            setPeriod(Number(value) as MapPeriod);
            setFocused(null);
          }}
          options={MAP_PERIODS.map((p) => ({ value: String(p.value), label: p.label }))}
        />
      </div>

      {/* Resumo comparativo do período */}
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-2xl bg-surface p-4">
          <dt className="text-[13px] text-muted-foreground">Entradas</dt>
          <dd className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-success tabular-nums sm:text-2xl">{money(totals.income)}</dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-surface p-4">
          <dt className="text-[13px] text-muted-foreground">Saídas</dt>
          <dd className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] text-ink tabular-nums sm:text-2xl">{money(totals.outcome)}</dd>
        </div>
      </dl>

      {slices.length === 0 ? (
        <EmptyState title="Seu mapa aparece com os primeiros gastos" body="Pix para parceiros PRX entram no nicho certo sozinhos: Gastronomia, Moda, Tecnologia, Bem-estar, Eventos." />
      ) : (
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={SIZE}
              height={SIZE}
              role="img"
              aria-label={`Gastos por nicho: ${slices.map((s) => `${s.name} ${s.pct}%`).join(", ")}`}
              className="-rotate-90"
            >
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--surface)" strokeWidth={STROKE} />
              {arcs.map(({ slice, index, dash, offset: start }) => (
                <motion.circle
                  key={slice.id}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={`var(--map-${index + 1})`}
                  strokeWidth={focused === slice.id ? STROKE + 4 : STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-start}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: focused && focused !== slice.id ? 0.35 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  onPointerEnter={() => setFocused(slice.id)}
                  onPointerLeave={() => setFocused(null)}
                  className="cursor-pointer"
                />
              ))}
            </svg>
            <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="text-[12px] font-medium text-muted-foreground">{active ? active.name : "Saídas"}</span>
              <span className="mt-0.5 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink tabular-nums">{money(active ? active.amount : totals.outcome)}</span>
              {active && <span className="text-[12px] text-muted-foreground">{active.pct}% do total</span>}
            </div>
          </div>

          <ul className="min-w-0 divide-y divide-line">
            {slices.map((slice, index) => (
              <li key={slice.id}>
                <button
                  type="button"
                  onPointerEnter={() => setFocused(slice.id)}
                  onPointerLeave={() => setFocused(null)}
                  onFocus={() => setFocused(slice.id)}
                  onBlur={() => setFocused(null)}
                  onClick={() => setFocused((f) => (f === slice.id ? null : slice.id))}
                  aria-pressed={focused === slice.id}
                  className={cn("flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg py-2 text-left transition-colors", focused === slice.id && "bg-surface")}
                >
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: `var(--map-${index + 1})` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{slice.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{slice.code}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[14px] font-medium text-ink tabular-nums">{money(slice.amount)}</span>
                    <span className="block text-[12px] text-muted-foreground tabular-nums">{slice.pct}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
