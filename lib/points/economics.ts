// Hello World
import type { PointRule } from "@/lib/points/types";

/**
 * Matemática da economia PRX. Módulo puro (cliente e servidor).
 *
 * Regra de negócio fundamental: a PRX ganha com a comissão de cada resgate (R)
 * e com a porcentagem das compras em parceiros (Tc). Um coin só nasce de uma
 * compra que já pagou comissão, então cada coin carrega um lastro de receita:
 *
 *   v = Tc / k        (R$ de comissão por coin; k = coins emitidos por R$ gasto)
 *
 * Para um benefício de custo C ser resgatado com lucro mínimo m sobre o custo:
 *
 *   R + pontos · v ≥ C · (1 + m)   ⇒   pontos ≥ (C · (1 + m) − R) / v
 *
 * Assim, quem tem pontos para resgatar já gerou a receita que paga o benefício.
 * Essa conta nunca aparece para o membro; ele só vê o preço em coins.
 */

export const DEFAULT_PARTNER_FEE_PCT = 8;
/** Recomendação obrigatória: lucro líquido de pelo menos 30% sobre os custos. */
export const MIN_PROFIT_MARGIN_PCT = 30;
/** Taxa padrão de emissão: 1 coin por real gasto (10 coins a cada R$ 10). */
export const DEFAULT_COINS_PER_REAL = 1;
/** Preços em coins andam de 10 em 10 e nunca ficam abaixo disto. */
export const POINTS_STEP = 10;
export const MIN_POINTS_COST = 10;

const round2 = (value: number) => Math.round(value * 100) / 100;
const safe = (value: number | null | undefined, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/** Coins por real a partir da regra de compra ativa (coins são "a cada R$ 10"). */
export function coinsPerRealFromRules(rules: ReadonlyArray<Pick<PointRule, "trigger" | "coins" | "active">>): number {
  const purchase = rules.find((rule) => rule.trigger === "partner_purchase" && rule.active && rule.coins > 0);
  return purchase ? purchase.coins / 10 : DEFAULT_COINS_PER_REAL;
}

/** Lastro de receita de cada coin, em R$. */
export function revenuePerCoin(partnerFeePct: number, coinsPerReal: number): number {
  const k = safe(coinsPerReal, DEFAULT_COINS_PER_REAL);
  if (k <= 0) return 0;
  return Math.max(0, safe(partnerFeePct)) / 100 / k;
}

/** Arredonda para cima no passo de coins, respeitando o mínimo. */
export function roundPoints(points: number): number {
  if (!Number.isFinite(points) || points <= MIN_POINTS_COST) return MIN_POINTS_COST;
  return Math.ceil(points / POINTS_STEP) * POINTS_STEP;
}

export interface ViabilityInput {
  /** C: custo unitário do benefício para a PRX (R$). */
  costPrice: number;
  /** R: receita/comissão do parceiro por resgate (R$). */
  revenuePerRedemption: number;
  /** Tc: comissão média sobre compras em parceiros (%). */
  partnerFeePct?: number;
  /** m: margem mínima de lucro sobre o custo (%). Nunca abaixo de 30. */
  minMarginPct?: number;
  /** k: coins emitidos por real gasto em parceiros. */
  coinsPerReal?: number;
  /** Preço em coins a avaliar. Sem ele, avalia o preço sugerido. */
  pointsCost?: number | null;
  /** Coins que um membro ativo ganha por mês com check-ins (equivalência em tempo de uso). */
  behaviorCoinsPerMonth?: number;
}

export type ViabilityStatus = "ok" | "below_min" | "loss";

export interface ViabilityResult {
  minMarginPct: number;
  revenuePerCoin: number;
  /** Menor preço (em coins) que garante a margem mínima; null quando nenhum preço garante. */
  suggestedPoints: number | null;
  /** Preço avaliado (o informado ou o sugerido). */
  evaluatedPoints: number;
  /** Quanto o membro precisou movimentar em parceiros para juntar esses coins (R$). */
  requiredSpend: number;
  /** Meses de uso ativo (só check-ins) equivalentes ao preço; null sem regras de check-in. */
  monthsOfActiveUse: number | null;
  /** Receita total que o resgate carrega: R + coins · v. */
  revenue: number;
  profit: number;
  /** Lucro sobre o custo (%); null quando o benefício não custa nada à PRX. */
  marginOnCostPct: number | null;
  /** Lucro sobre a receita (%); null sem receita. */
  marginOnRevenuePct: number | null;
  status: ViabilityStatus;
  message: string;
}

/**
 * Calculadora de viabilidade de um benefício. Um benefício só pode ser
 * publicado com status "ok": margem projetada ≥ margem mínima (30%).
 */
export function assessBenefitViability(input: ViabilityInput): ViabilityResult {
  const cost = Math.max(0, safe(input.costPrice));
  const partnerRevenue = Math.max(0, safe(input.revenuePerRedemption));
  const feePct = Math.max(0, safe(input.partnerFeePct, DEFAULT_PARTNER_FEE_PCT));
  const minMarginPct = Math.max(MIN_PROFIT_MARGIN_PCT, safe(input.minMarginPct, MIN_PROFIT_MARGIN_PCT));
  const k = safe(input.coinsPerReal, DEFAULT_COINS_PER_REAL) > 0 ? safe(input.coinsPerReal, DEFAULT_COINS_PER_REAL) : DEFAULT_COINS_PER_REAL;
  const v = revenuePerCoin(feePct, k);
  const target = cost * (1 + minMarginPct / 100);

  let suggestedPoints: number | null;
  if (partnerRevenue >= target) suggestedPoints = MIN_POINTS_COST;
  else if (v <= 0) suggestedPoints = null;
  else suggestedPoints = roundPoints((target - partnerRevenue) / v);

  const informed = input.pointsCost;
  const evaluatedPoints = typeof informed === "number" && Number.isFinite(informed) && informed >= 0 ? Math.floor(informed) : suggestedPoints ?? 0;

  const revenue = round2(partnerRevenue + evaluatedPoints * v);
  const profit = round2(revenue - cost);
  const marginOnCostPct = cost > 0 ? round2((profit / cost) * 100) : null;
  const marginOnRevenuePct = revenue > 0 ? round2((profit / revenue) * 100) : null;
  const behavior = safe(input.behaviorCoinsPerMonth);
  const monthsOfActiveUse = behavior > 0 ? Math.round((evaluatedPoints / behavior) * 10) / 10 : null;

  let status: ViabilityStatus;
  let message: string;
  if (cost === 0) {
    status = "ok";
    message = partnerRevenue > 0 || evaluatedPoints > 0 ? "Sem custo para a PRX: todo resgate é receita." : "Sem custo e sem receita: benefício neutro para o caixa.";
  } else if (profit < 0) {
    status = "loss";
    message = suggestedPoints === null ? "Prejuízo: sem comissão sobre compras, nenhum preço em coins cobre o custo." : `Prejuízo projetado de ${formatMoney(-profit)} por resgate.`;
  } else if ((marginOnCostPct ?? 0) < minMarginPct) {
    status = "below_min";
    message = `Margem de ${formatPct(marginOnCostPct ?? 0)} abaixo do mínimo de ${formatPct(minMarginPct)}.`;
  } else {
    status = "ok";
    message = `Margem de ${formatPct(marginOnCostPct ?? 0)} sobre o custo.`;
  }

  return {
    minMarginPct,
    revenuePerCoin: Math.round(v * 10_000) / 10_000,
    suggestedPoints,
    evaluatedPoints,
    requiredSpend: round2(evaluatedPoints / k),
    monthsOfActiveUse,
    revenue,
    profit,
    marginOnCostPct,
    marginOnRevenuePct,
    status,
    message,
  };
}

/* -------------------------------------------------------------------------- */
/* Compras em parceiros                                                        */
/* -------------------------------------------------------------------------- */

export interface PurchaseReward {
  coins: number;
  xp: number;
  commission: number;
}

/**
 * Coins e XP de uma compra em parceiro. A regra de compra define "coins e XP a
 * cada R$ 10"; o crédito é proporcional ao valor. Se o parceiro paga comissão
 * menor que a de referência, os coins encolhem na mesma proporção: nenhum coin
 * é emitido sem a receita que o sustenta. XP não é moeda e não encolhe.
 */
export function purchaseReward(
  amount: number,
  partnerFeePct: number,
  rule: Pick<PointRule, "coins" | "xp" | "active"> | null,
  referenceFeePct = DEFAULT_PARTNER_FEE_PCT
): PurchaseReward {
  const value = Math.max(0, safe(amount));
  const fee = Math.max(0, safe(partnerFeePct));
  const commission = round2((value * fee) / 100);
  if (!rule || !rule.active || value <= 0) return { coins: 0, xp: 0, commission };
  const backing = referenceFeePct > 0 ? Math.min(1, fee / referenceFeePct) : 1;
  return {
    coins: Math.floor(((value * rule.coins) / 10) * backing),
    xp: Math.floor((value * rule.xp) / 10),
    commission,
  };
}

/* -------------------------------------------------------------------------- */
/* Lastro dos check-ins                                                        */
/* -------------------------------------------------------------------------- */

const OCCURRENCES_PER_MONTH = { once: 0, daily: 30, weekly: 30 / 7, monthly: 1, per_event: 0 } as const;

/** Coins que um membro assíduo junta por mês só com check-ins ativos. */
export function behaviorCoinsPerMonth(rules: ReadonlyArray<Pick<PointRule, "trigger" | "coins" | "active" | "periodicity">>): number {
  const total = rules
    .filter((rule) => rule.active && rule.trigger === "checkin")
    .reduce((sum, rule) => sum + rule.coins * OCCURRENCES_PER_MONTH[rule.periodicity], 0);
  return Math.round(total);
}

/* -------------------------------------------------------------------------- */
/* Painel financeiro                                                           */
/* -------------------------------------------------------------------------- */

export interface FinanceInput {
  /** Resgates no período, com os números do benefício no momento do cálculo. */
  redemptions: ReadonlyArray<{ costPrice: number; revenuePerRedemption: number }>;
  /** Compras em parceiros pontuadas (Pix/BACEN). */
  purchases: ReadonlyArray<{ amount: number; commission: number }>;
  /** Coins em circulação (passivo de resgate). */
  coinsOutstanding: number;
  revenuePerCoin: number;
}

export interface FinanceSummary {
  redemptionRevenue: number;
  purchaseRevenue: number;
  grossRevenue: number;
  subsidyCost: number;
  netProfit: number;
  /** Lucro sobre a receita (%); null sem receita. */
  marginPct: number | null;
  purchaseVolume: number;
  redemptionCount: number;
  purchaseCount: number;
  /** Valor de lastro dos coins em circulação (R$). */
  coinLiability: number;
}

export function summarizeFinance(input: FinanceInput): FinanceSummary {
  const redemptionRevenue = round2(input.redemptions.reduce((sum, r) => sum + Math.max(0, safe(r.revenuePerRedemption)), 0));
  const subsidyCost = round2(input.redemptions.reduce((sum, r) => sum + Math.max(0, safe(r.costPrice)), 0));
  const purchaseRevenue = round2(input.purchases.reduce((sum, p) => sum + Math.max(0, safe(p.commission)), 0));
  const purchaseVolume = round2(input.purchases.reduce((sum, p) => sum + Math.max(0, safe(p.amount)), 0));
  const grossRevenue = round2(redemptionRevenue + purchaseRevenue);
  const netProfit = round2(grossRevenue - subsidyCost);
  return {
    redemptionRevenue,
    purchaseRevenue,
    grossRevenue,
    subsidyCost,
    netProfit,
    marginPct: grossRevenue > 0 ? round2((netProfit / grossRevenue) * 100) : null,
    purchaseVolume,
    redemptionCount: input.redemptions.length,
    purchaseCount: input.purchases.length,
    coinLiability: round2(Math.max(0, safe(input.coinsOutstanding)) * Math.max(0, safe(input.revenuePerCoin))),
  };
}

export interface BankYieldInput {
  activeAccounts: number;
  averageBalance: number;
  /** CDI anual (%). */
  cdiAnnualPct: number;
  /** Parte do CDI repassada ao cliente (%): o card "Em breve" promete 100%. */
  clientSharePct: number;
  /** Rendimento que o BaaS paga sobre o saldo custodiado, em % do CDI. */
  custodyYieldPctOfCdi: number;
}

export interface BankYieldResult {
  custody: number;
  monthlyGrossYield: number;
  monthlyClientYield: number;
  monthlyPrxSpread: number;
  spreadPerAccount: number;
}

/** Simulação de rentabilidade e retenção de saldo do PRX Bank (mensal, juros compostos). */
export function simulateBankYield(input: BankYieldInput): BankYieldResult {
  const custody = Math.max(0, safe(input.activeAccounts)) * Math.max(0, safe(input.averageBalance));
  const monthlyCdi = Math.pow(1 + Math.max(0, safe(input.cdiAnnualPct)) / 100, 1 / 12) - 1;
  const gross = custody * monthlyCdi * (Math.max(0, safe(input.custodyYieldPctOfCdi)) / 100);
  const client = custody * monthlyCdi * (Math.max(0, safe(input.clientSharePct)) / 100);
  const spread = gross - client;
  return {
    custody: round2(custody),
    monthlyGrossYield: round2(gross),
    monthlyClientYield: round2(client),
    monthlyPrxSpread: round2(spread),
    spreadPerAccount: input.activeAccounts > 0 ? round2(spread / input.activeAccounts) : 0,
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
