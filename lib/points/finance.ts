// Hello World
import { supabaseAdmin } from "@/lib/supabase/client";
import { passStore } from "@/lib/pass-store";
import type { BenefitRow } from "@/lib/db-rows";
import type { Benefit } from "@/lib/pass-data";
import { mapBenefitRow } from "@/lib/partners/catalog";
import { dbError } from "@/lib/partners/errors";
import {
  DEFAULT_PARTNER_FEE_PCT,
  assessBenefitViability,
  behaviorCoinsPerMonth,
  coinsPerRealFromRules,
  revenuePerCoin,
  summarizeFinance,
  type FinanceSummary,
  type ViabilityStatus,
} from "@/lib/points/economics";
import { getLedgerReaders, getRulesRepository } from "@/lib/points/repository";

/**
 * Inteligência financeira do painel admin: receita (comissões de resgate e
 * de compras em parceiros), custo (subsídio dos benefícios), lucro, passivo
 * de coins e a viabilidade de cada benefício do catálogo. Só números reais:
 * sem dados, tudo aparece zerado.
 */

export const FINANCE_PERIODS = [30, 90, 365] as const;
export type FinancePeriod = (typeof FINANCE_PERIODS)[number];

export interface BenefitEconomics {
  id: string;
  title: string;
  partnerName: string;
  pointsCost: number;
  costPrice: number;
  revenuePerRedemption: number;
  partnerFeePct: number;
  redemptions: number;
  marginOnCostPct: number | null;
  suggestedPoints: number | null;
  status: ViabilityStatus;
}

export interface FinanceOverview {
  periodDays: FinancePeriod;
  summary: FinanceSummary;
  coinsOutstanding: number;
  coinsPerReal: number;
  revenuePerCoin: number;
  behaviorCoinsPerMonth: number;
  benefits: BenefitEconomics[];
  topPartners: Array<{ partnerName: string; volume: number; commission: number; purchases: number }>;
}

async function loadBenefits(): Promise<Benefit[]> {
  if (!supabaseAdmin) return passStore.getBenefits();
  const { data, error } = await supabaseAdmin.from("benefits").select("*");
  if (error) throw dbError(error, "Não foi possível carregar os benefícios");
  return (data as BenefitRow[]).map(mapBenefitRow);
}

/** benefit_id de cada voucher gerado no período. */
async function loadRedemptions(sinceIso: string): Promise<string[]> {
  const memory = passStore
    .getVouchers()
    .filter((v) => (v.createdAtIso ?? "") >= sinceIso)
    .map((v) => v.benefitId);
  if (!supabaseAdmin) return memory;
  const { data, error } = await supabaseAdmin.from("vouchers").select("id, benefit_id, created_at").gte("created_at", sinceIso).limit(50_000);
  if (error) throw dbError(error, "Não foi possível carregar os resgates");
  return (data as Array<{ benefit_id: string | null }>).map((row) => row.benefit_id ?? "");
}

export async function financeOverview(periodDays: FinancePeriod): Promise<FinanceOverview> {
  const sinceIso = new Date(Date.now() - periodDays * 86_400_000).toISOString();
  const readers = getLedgerReaders();
  const [benefits, redemptionIds, rules, purchaseLists, coinTotals] = await Promise.all([
    loadBenefits(),
    loadRedemptions(sinceIso),
    getRulesRepository().listRules(),
    Promise.all(readers.map((r) => r.listAllPurchases(sinceIso))),
    Promise.all(readers.map((r) => r.coinsOutstanding())),
  ]);

  const purchases = purchaseLists.flat();
  const coinsOutstanding = coinTotals.reduce((sum, n) => sum + n, 0);
  const k = coinsPerRealFromRules(rules);
  const v = revenuePerCoin(DEFAULT_PARTNER_FEE_PCT, k);
  const monthlyBehavior = behaviorCoinsPerMonth(rules);
  const byId = new Map(benefits.map((b) => [b.id, b]));

  const redemptionCount = new Map<string, number>();
  for (const id of redemptionIds) redemptionCount.set(id, (redemptionCount.get(id) ?? 0) + 1);

  const redemptions = redemptionIds.map((id) => {
    const benefit = byId.get(id);
    return { costPrice: benefit?.costPrice ?? 0, revenuePerRedemption: benefit?.prxRevenuePerRedemption ?? 0 };
  });

  const summary = summarizeFinance({ redemptions, purchases, coinsOutstanding, revenuePerCoin: v });

  const benefitRows: BenefitEconomics[] = benefits.map((benefit) => {
    const assessment = assessBenefitViability({
      costPrice: benefit.costPrice ?? 0,
      revenuePerRedemption: benefit.prxRevenuePerRedemption ?? 0,
      partnerFeePct: benefit.partnerFeePct ?? DEFAULT_PARTNER_FEE_PCT,
      coinsPerReal: k,
      pointsCost: benefit.pointsCost ?? 0,
      behaviorCoinsPerMonth: monthlyBehavior,
    });
    return {
      id: benefit.id,
      title: benefit.title,
      partnerName: benefit.partnerName,
      pointsCost: benefit.pointsCost ?? 0,
      costPrice: benefit.costPrice ?? 0,
      revenuePerRedemption: benefit.prxRevenuePerRedemption ?? 0,
      partnerFeePct: benefit.partnerFeePct ?? DEFAULT_PARTNER_FEE_PCT,
      redemptions: redemptionCount.get(benefit.id) ?? 0,
      marginOnCostPct: assessment.marginOnCostPct,
      suggestedPoints: assessment.suggestedPoints,
      status: assessment.status,
    };
  });

  const partners = new Map<string, { partnerName: string; volume: number; commission: number; purchases: number }>();
  for (const p of purchases) {
    const key = p.partnerId ?? p.partnerName;
    const current = partners.get(key) ?? { partnerName: p.partnerName, volume: 0, commission: 0, purchases: 0 };
    current.volume = Math.round((current.volume + p.amount) * 100) / 100;
    current.commission = Math.round((current.commission + p.commission) * 100) / 100;
    current.purchases += 1;
    partners.set(key, current);
  }

  return {
    periodDays,
    summary,
    coinsOutstanding,
    coinsPerReal: k,
    revenuePerCoin: Math.round(v * 10_000) / 10_000,
    behaviorCoinsPerMonth: monthlyBehavior,
    benefits: benefitRows,
    topPartners: [...partners.values()].sort((a, b) => b.commission - a.commission).slice(0, 8),
  };
}
