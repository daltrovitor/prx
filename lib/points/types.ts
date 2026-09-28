// Hello World
import { z } from "zod";

/**
 * Economia PRX: PRX Coins (moeda de resgate do PASS) e XP (régua de nível).
 * Coins só nascem de três fontes com lastro — comportamento, compras em
 * parceiros e boas-vindas — e só saem no resgate de benefícios. Todo movimento
 * fica no extrato imutável (point_transactions).
 */

/* -------------------------------------------------------------------------- */
/* Regras de bom comportamento                                                 */
/* -------------------------------------------------------------------------- */

/**
 * O que dispara a regra.
 *   checkin          o membro declara no app (semana sem apostas, treino…), limitado pela periodicidade
 *   partner_purchase compra validada em parceiro (Pix/BACEN); coins e XP são "a cada R$ 10"
 *   benefit_redeem   resgate de benefício no PASS
 *   voucher_use      voucher validado no balcão do parceiro
 */
export const POINT_RULE_TRIGGERS = ["checkin", "partner_purchase", "benefit_redeem", "voucher_use"] as const;
export type PointRuleTrigger = (typeof POINT_RULE_TRIGGERS)[number];

export const POINT_RULE_TRIGGER_LABEL: Record<PointRuleTrigger, string> = {
  checkin: "Check-in do membro",
  partner_purchase: "Compra em parceiro (a cada R$ 10)",
  benefit_redeem: "Resgate de benefício",
  voucher_use: "Voucher usado no parceiro",
};

export const POINT_RULE_PERIODS = ["once", "daily", "weekly", "monthly", "per_event"] as const;
export type PointRulePeriod = (typeof POINT_RULE_PERIODS)[number];

export const POINT_RULE_PERIOD_LABEL: Record<PointRulePeriod, string> = {
  once: "Uma vez",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  per_event: "A cada evento",
};

export const POINT_RULE_CATEGORIES = ["financas", "bem-estar", "comunidade", "compras", "fidelidade", "geral"] as const;
export type PointRuleCategory = (typeof POINT_RULE_CATEGORIES)[number];

export const POINT_RULE_CATEGORY_LABEL: Record<PointRuleCategory, string> = {
  financas: "Finanças",
  "bem-estar": "Bem-estar",
  comunidade: "Comunidade",
  compras: "Compras",
  fidelidade: "Fidelidade",
  geral: "Geral",
};

export interface PointRule {
  id: string;
  title: string;
  description: string;
  trigger: PointRuleTrigger;
  coins: number;
  xp: number;
  periodicity: PointRulePeriod;
  category: PointRuleCategory;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const text = (max: number) => z.string().trim().max(max);

export const pointRuleInputSchema = z
  .object({
    title: text(80).min(3, "Informe o título da regra."),
    description: text(280).default(""),
    trigger: z.enum(POINT_RULE_TRIGGERS),
    coins: z.coerce.number().int("Coins precisam ser inteiros.").min(0).max(100_000),
    xp: z.coerce.number().int("XP precisa ser inteiro.").min(0).max(1_000_000),
    periodicity: z.enum(POINT_RULE_PERIODS),
    category: z.enum(POINT_RULE_CATEGORIES),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((rule) => rule.coins > 0 || rule.xp > 0, { message: "A regra precisa dar coins, XP ou os dois.", path: ["coins"] })
  .refine((rule) => rule.trigger === "checkin" || rule.periodicity === "per_event", {
    message: "Regras automáticas (compra, resgate, uso de voucher) valem a cada evento.",
    path: ["periodicity"],
  })
  .refine((rule) => rule.trigger !== "checkin" || rule.periodicity !== "per_event", {
    message: "Check-in precisa de periodicidade (uma vez, diária, semanal ou mensal).",
    path: ["periodicity"],
  });

export type PointRuleInput = z.output<typeof pointRuleInputSchema>;

/* -------------------------------------------------------------------------- */
/* Extrato                                                                     */
/* -------------------------------------------------------------------------- */

export const POINT_SOURCES = ["welcome", "behavior", "partner_purchase", "benefit_redeem", "voucher_use", "mission", "admin_adjustment", "refund"] as const;
export type PointSource = (typeof POINT_SOURCES)[number];

export const POINT_SOURCE_LABEL: Record<PointSource, string> = {
  welcome: "Boas-vindas",
  behavior: "Bom comportamento",
  partner_purchase: "Compra em parceiro",
  benefit_redeem: "Resgate de benefício",
  voucher_use: "Voucher usado",
  mission: "Missão",
  admin_adjustment: "Ajuste PRX",
  refund: "Estorno",
};

export interface PointTransaction {
  id: string;
  userId: string;
  coinsDelta: number;
  xpDelta: number;
  balanceAfter: number;
  source: PointSource;
  ruleId: string | null;
  /** Benefício, voucher ou transação BACEN de origem. Garante idempotência. */
  referenceId: string | null;
  description: string;
  createdAt: string;
}

/** Movimento a aplicar. A soma nunca deixa o saldo de coins negativo. */
export interface PointMovement {
  coinsDelta: number;
  xpDelta: number;
  source: PointSource;
  ruleId?: string | null;
  referenceId?: string | null;
  description: string;
}

/* -------------------------------------------------------------------------- */
/* Compras em parceiros via Pix (BACEN)                                        */
/* -------------------------------------------------------------------------- */

export type PartnerMatchMethod = "document" | "pix_key" | "name";

export interface PartnerPurchase {
  id: string;
  userId: string;
  partnerId: string | null;
  partnerName: string;
  categoryId: string;
  /** Identificador fim a fim do Pix no SPI/BACEN. Único: o mesmo Pix nunca pontua duas vezes. */
  endToEndId: string;
  pixKey: string;
  amount: number;
  feePct: number;
  commission: number;
  coins: number;
  xp: number;
  matchMethod: PartnerMatchMethod;
  source: "sandbox" | "baas_webhook";
  createdAt: string;
}

/** Carteira do membro exibida no app. */
export interface PointsWallet {
  coins: number;
  xp: number;
  level: number;
  transactions: PointTransaction[];
  rules: MemberPointRule[];
  purchases: PartnerPurchase[];
}

/** Regra como o membro vê: com o próximo momento em que pode ser reivindicada. */
export interface MemberPointRule {
  id: string;
  title: string;
  description: string;
  trigger: PointRuleTrigger;
  coins: number;
  xp: number;
  periodicity: PointRulePeriod;
  category: PointRuleCategory;
  /** available: pode reivindicar agora · cooldown: volta em availableAt · done: regra única já usada · auto: crédito automático. */
  status: "available" | "cooldown" | "done" | "auto";
  /** ISO de quando o check-in volta a ficar disponível (status cooldown). */
  availableAt: string | null;
}
