// Hello World
import type { MemberPointRule, PointRule, PointRuleInput, PointRulePeriod } from "@/lib/points/types";

/**
 * Regras padrão de pontos e XP. São configuração (não dados de exemplo): o
 * admin edita, desativa ou cria outras na aba Pontos. A migração
 * 20260927_prx_points_reels_finance.sql insere as mesmas regras no Supabase.
 *
 * A regra de compra define a taxa de emissão de coins do sistema inteiro:
 * 10 coins a cada R$ 10 = 1 coin por real gasto em parceiro. A calculadora de
 * viabilidade usa essa taxa para garantir o lastro de cada benefício.
 *
 * Check-ins pagam sobretudo XP: coins de check-in não vêm de uma compra com
 * comissão, então ficam baixos (~78/mês para quem faz todos) para que o grosso
 * dos coins de um resgate venha de receita já gerada.
 */
export const DEFAULT_POINT_RULES: ReadonlyArray<PointRuleInput & { slug: string }> = [
  {
    slug: "semana-sem-apostas",
    title: "Semana sem apostas",
    description: "Build. Don't Bet: confirme mais uma semana construindo em vez de apostar.",
    trigger: "checkin",
    coins: 10,
    xp: 150,
    periodicity: "weekly",
    category: "financas",
    active: true,
    sortOrder: 1,
  },
  {
    slug: "checkin-saudavel",
    title: "Check-in de atividade saudável",
    description: "Treino, corrida, meditação ou terapia: registre o seu dia.",
    trigger: "checkin",
    coins: 1,
    xp: 25,
    periodicity: "daily",
    category: "bem-estar",
    active: true,
    sortOrder: 2,
  },
  {
    slug: "habito-financeiro-mes",
    title: "Revisão do mês no PRX Map",
    description: "Olhe para onde foi o seu dinheiro e defina a meta do próximo mês.",
    trigger: "checkin",
    coins: 5,
    xp: 60,
    periodicity: "monthly",
    category: "financas",
    active: true,
    sortOrder: 3,
  },
  {
    slug: "compra-parceiro",
    title: "Compra em parceiro PRX",
    description: "Pague um parceiro com Pix pela sua conta PRX e ganhe na hora.",
    trigger: "partner_purchase",
    coins: 10,
    xp: 20,
    periodicity: "per_event",
    category: "compras",
    active: true,
    sortOrder: 4,
  },
  {
    slug: "resgate-beneficio",
    title: "Resgate de benefício",
    description: "Cada benefício ativado no PASS conta para o seu nível.",
    trigger: "benefit_redeem",
    coins: 0,
    xp: 50,
    periodicity: "per_event",
    category: "fidelidade",
    active: true,
    sortOrder: 5,
  },
  {
    slug: "voucher-usado",
    title: "Voucher usado no parceiro",
    description: "Usou o voucher no balcão? XP de fidelidade liberado.",
    trigger: "voucher_use",
    coins: 0,
    xp: 80,
    periodicity: "per_event",
    category: "fidelidade",
    active: true,
    sortOrder: 6,
  },
];

/** Brasília não tem horário de verão desde 2019: UTC−3 fixo. */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Início (UTC) do período corrente em horário de Brasília. Semana começa na segunda. */
export function periodStart(period: Exclude<PointRulePeriod, "once" | "per_event">, now: Date): Date {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  let startLocal: number;
  if (period === "monthly") startLocal = Date.UTC(y, m, 1);
  else if (period === "weekly") {
    const weekday = (local.getUTCDay() + 6) % 7; // segunda = 0
    startLocal = Date.UTC(y, m, d) - weekday * DAY_MS;
  } else startLocal = Date.UTC(y, m, d);
  return new Date(startLocal + BRT_OFFSET_MS);
}

/** Início (UTC) do próximo período em horário de Brasília. */
export function nextPeriodStart(period: Exclude<PointRulePeriod, "once" | "per_event">, now: Date): Date {
  const start = periodStart(period, now);
  if (period === "daily") return new Date(start.getTime() + DAY_MS);
  if (period === "weekly") return new Date(start.getTime() + 7 * DAY_MS);
  const local = new Date(start.getTime() - BRT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) + BRT_OFFSET_MS);
}

/** Último envio do membro para uma regra (o que decide a janela de periodicidade). */
export interface LastClaim {
  at: string;
  status: "pending" | "approved" | "rejected";
}

/**
 * Situação de um bom comportamento dado o último envio do membro.
 * Envio em análise bloqueia novos; envio recusado libera de novo; aprovado
 * segue a periodicidade. Regras automáticas nunca são enviadas à mão.
 */
export function claimStatus(rule: Pick<PointRule, "trigger" | "periodicity">, last: LastClaim | string | null, now = new Date()): Pick<MemberPointRule, "status" | "availableAt"> {
  if (rule.trigger !== "checkin" || rule.periodicity === "per_event") return { status: "auto", availableAt: null };
  const claim: LastClaim | null = typeof last === "string" ? { at: last, status: "approved" } : last;
  if (!claim || claim.status === "rejected") return { status: "available", availableAt: null };
  if (claim.status === "pending") return { status: "pending", availableAt: null };
  if (rule.periodicity === "once") return { status: "done", availableAt: null };
  if (new Date(claim.at) < periodStart(rule.periodicity, now)) return { status: "available", availableAt: null };
  return { status: "cooldown", availableAt: nextPeriodStart(rule.periodicity, now).toISOString() };
}

export function toMemberRule(rule: PointRule, lastClaim: LastClaim | null, now = new Date()): MemberPointRule {
  return {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    trigger: rule.trigger,
    coins: rule.coins,
    xp: rule.xp,
    periodicity: rule.periodicity,
    category: rule.category,
    ...claimStatus(rule, lastClaim, now),
  };
}
