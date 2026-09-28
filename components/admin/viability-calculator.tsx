// Hello World
"use client";

import type { ChangeEvent } from "react";
import { Button, Field, Input } from "@/components/app/ui";
import { MIN_PROFIT_MARGIN_PCT, assessBenefitViability, type ViabilityResult } from "@/lib/points/economics";
import { cn } from "@/lib/utils";

export interface ViabilityValues {
  costPrice: string;
  revenuePerRedemption: string;
  partnerFeePct: string;
  minMarginPct: string;
  pointsCost: string;
}

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const num = (text: string) => {
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};

/** Avalia os valores digitados com a mesma função que o servidor usa para bloquear a publicação. */
export function evaluateViability(values: ViabilityValues, coinsPerReal: number, behaviorCoinsPerMonth: number): ViabilityResult {
  return assessBenefitViability({
    costPrice: num(values.costPrice),
    revenuePerRedemption: num(values.revenuePerRedemption),
    partnerFeePct: num(values.partnerFeePct),
    minMarginPct: num(values.minMarginPct),
    coinsPerReal,
    pointsCost: values.pointsCost.trim() === "" ? null : Math.floor(num(values.pointsCost)),
    behaviorCoinsPerMonth,
  });
}

const STATUS_STYLE = {
  ok: { tone: "bg-success/[0.08] text-success", label: "Viável" },
  below_min: { tone: "bg-warning/[0.1] text-warning", label: "Margem abaixo do mínimo" },
  loss: { tone: "bg-destructive/[0.07] text-destructive", label: "Prejuízo" },
} as const;

/**
 * Calculadora de viabilidade de benefícios (prevenção de prejuízo).
 * Sugere o preço em PRX Coins que garante lucro mínimo de 30% sobre o custo,
 * considerando a comissão por resgate e o lastro de receita de cada coin.
 */
export function ViabilityCalculator({
  values,
  onChange,
  coinsPerReal,
  behaviorCoinsPerMonth,
  showPoints = true,
  className,
}: {
  values: ViabilityValues;
  onChange: (next: ViabilityValues) => void;
  coinsPerReal: number;
  behaviorCoinsPerMonth: number;
  /** Mostra o campo do preço em coins (no modal do benefício ele é o próprio campo do formulário). */
  showPoints?: boolean;
  className?: string;
}) {
  const result = evaluateViability(values, coinsPerReal, behaviorCoinsPerMonth);
  const status = STATUS_STYLE[result.status];
  const set = (key: keyof ViabilityValues) => (event: ChangeEvent<HTMLInputElement>) => onChange({ ...values, [key]: event.target.value });

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Custo unitário para a PRX (R$)" hint="Subsídio pago por resgate.">
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.costPrice} onChange={set("costPrice")} placeholder="0,00" />}
        </Field>
        <Field label="Receita do parceiro por resgate (R$)" hint="Comissão direta que a PRX recebe.">
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.revenuePerRedemption} onChange={set("revenuePerRedemption")} placeholder="0,00" />}
        </Field>
        <Field label="Comissão sobre compras no parceiro (%)" hint="Padrão de mercado da PRX: 8%.">
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.partnerFeePct} onChange={set("partnerFeePct")} />}
        </Field>
        <Field label="Margem mínima de lucro (%)" hint={`Nunca abaixo de ${MIN_PROFIT_MARGIN_PCT}% sobre os custos.`}>
          {(id, describedBy) => <Input id={id} aria-describedby={describedBy} inputMode="decimal" value={values.minMarginPct} onChange={set("minMarginPct")} />}
        </Field>
        {showPoints && (
          <Field label="Preço em PRX Coins (opcional)" hint="Vazio avalia o preço sugerido." className="sm:col-span-2">
            {(id, describedBy) => <Input id={id} aria-describedby={describedBy} inputMode="numeric" value={values.pointsCost} onChange={set("pointsCost")} />}
          </Field>
        )}
      </div>

      <div className="space-y-4 rounded-2xl bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted-foreground">Preço sugerido</p>
            <p className="text-[30px] font-light leading-none tracking-[-0.035em] text-ink tabular-nums">
              {result.suggestedPoints === null ? "Sem preço viável" : `${result.suggestedPoints.toLocaleString("pt-BR")} coins`}
            </p>
          </div>
          {result.suggestedPoints !== null && String(result.suggestedPoints) !== values.pointsCost.trim() && (
            <Button size="sm" variant="secondary" onClick={() => onChange({ ...values, pointsCost: String(result.suggestedPoints) })}>
              Aplicar sugestão
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label="Preço avaliado" value={`${result.evaluatedPoints.toLocaleString("pt-BR")} coins`} />
          <Stat label="Gasto em parceiros para juntar" value={brl(result.requiredSpend)} />
          <Stat label="Ou meses de uso ativo" value={result.monthsOfActiveUse === null ? "—" : `${result.monthsOfActiveUse.toLocaleString("pt-BR")} meses`} />
          <Stat label="Lastro por coin" value={brl(result.revenuePerCoin)} />
          <Stat label="Receita por resgate" value={brl(result.revenue)} />
          <Stat label="Lucro por resgate" value={brl(result.profit)} />
          <Stat label="Margem sobre o custo" value={pct(result.marginOnCostPct)} />
          <Stat label="Margem sobre a receita" value={pct(result.marginOnRevenuePct)} />
        </dl>

        <p role="status" className={cn("rounded-xl px-3.5 py-2.5 text-[13px] font-medium", status.tone)}>
          {status.label}: {result.message}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
