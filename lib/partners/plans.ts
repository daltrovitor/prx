// Hello World

/**
 * Tabela comercial do PRX PASS (cláusula 8.3 do Termo) e vocabulário das
 * campanhas. Preços são proposta inicial da PRX: mudar aqui altera o padrão
 * de novas campanhas, nunca as já aceitas (8.5), que guardam o próprio valor.
 */

export type VisibilityPlan = "basico" | "spotlight" | "prime" | "takeover";

export interface VisibilityPlanDefinition {
  id: VisibilityPlan;
  label: string;
  /** Preço de referência por período. */
  price: number;
  /** "mês" ou "7 dias". */
  period: string;
  /** Takeover é "a partir de": o valor final depende do inventário. */
  startingAt: boolean;
  perks: string;
  /** Ordem no catálogo: maior aparece primeiro. */
  rank: number;
}

export const VISIBILITY_PLANS: Record<VisibilityPlan, VisibilityPlanDefinition> = {
  basico: {
    id: "basico",
    label: "Básico",
    price: 0,
    period: "mês",
    startingAt: false,
    perks: "Presença orgânica no catálogo, página do parceiro e métricas essenciais.",
    rank: 0,
  },
  spotlight: {
    id: "spotlight",
    label: "Spotlight",
    price: 299,
    period: "mês",
    startingAt: false,
    perks: "Selo de destaque, prioridade em listas e categorias elegíveis e relatório ampliado.",
    rank: 1,
  },
  prime: {
    id: "prime",
    label: "Prime",
    price: 599,
    period: "mês",
    startingAt: false,
    perks: "Maior destaque em categorias, vitrines e campanhas selecionadas e relatório ampliado.",
    rank: 2,
  },
  takeover: {
    id: "takeover",
    label: "Takeover",
    price: 1490,
    period: "7 dias",
    startingAt: true,
    perks: "Posição premium, banner ou ação temática, conforme inventário disponível.",
    rank: 3,
  },
};

export const VISIBILITY_PLAN_IDS = Object.keys(VISIBILITY_PLANS) as VisibilityPlan[];

export function isPaidPlan(plan: VisibilityPlan | null | undefined): boolean {
  return Boolean(plan && plan !== "basico");
}

export function planRank(plan: VisibilityPlan | null | undefined): number {
  return plan ? VISIBILITY_PLANS[plan]?.rank ?? 0 : 0;
}

/** Valor de referência da mídia para N períodos do plano. */
export function referenceMediaPrice(plan: VisibilityPlan, periods: number): number {
  return VISIBILITY_PLANS[plan].price * Math.max(1, Math.floor(periods || 1));
}

export function mediaBillingText(plan: VisibilityPlan, periods: number): string {
  const def = VISIBILITY_PLANS[plan];
  if (def.price === 0) return "Sem custo de mídia";
  const n = Math.max(1, Math.floor(periods || 1));
  const unit = def.period === "mês" ? (n === 1 ? "mês" : "meses") : n === 1 ? "período de 7 dias" : "períodos de 7 dias";
  return `Por período: ${n} ${unit}`;
}

/* -------------------------------------------------------------------------- */
/* Modalidades de entrega e resgate (cláusula 4.1)                            */
/* -------------------------------------------------------------------------- */

export type RedemptionMode = "qr_presencial" | "voucher_digital" | "compra_app" | "link_out" | "agendamento" | "lista_checkin";

export const REDEMPTION_MODES: Record<RedemptionMode, { label: string; clause: string }> = {
  qr_presencial: { label: "QR Code na loja", clause: "(a) QR Code presencial" },
  voucher_digital: { label: "Voucher / cupom digital", clause: "(b) Voucher/cupom digital" },
  compra_app: { label: "Compra no PRX PASS", clause: "(c) Compra no PRX PASS" },
  link_out: { label: "Link para o e-commerce do parceiro", clause: "(d) Link-out" },
  agendamento: { label: "Agendamento / reserva", clause: "(e) Agendamento/reserva" },
  lista_checkin: { label: "Lista nominal / check-in", clause: "(f) Lista nominal/check-in" },
};

export const REDEMPTION_MODE_IDS = Object.keys(REDEMPTION_MODES) as RedemptionMode[];

/* -------------------------------------------------------------------------- */
/* Oferta                                                                      */
/* -------------------------------------------------------------------------- */

export type OfferKind = "preco" | "percentual" | "brinde";
export type QuantityUnit = "unidades" | "vagas" | "resgates";

export const OFFER_KINDS: Record<OfferKind, string> = {
  preco: "Preço PRX",
  percentual: "Desconto (%)",
  brinde: "Brinde",
};

export const QUANTITY_UNITS: Record<QuantityUnit, string> = {
  unidades: "unidades",
  vagas: "vagas",
  resgates: "resgates",
};

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Rótulo curto exibido sobre o card do catálogo. */
export function deriveOfferLabel(offer: {
  offerKind: OfferKind;
  prxPrice: number | null;
  discountPercent: number | null;
}): string {
  if (offer.offerKind === "percentual" && offer.discountPercent) return `${Math.round(offer.discountPercent)}% OFF`;
  if (offer.offerKind === "preco" && offer.prxPrice !== null) return offer.prxPrice === 0 ? "Grátis" : formatMoney(offer.prxPrice);
  return "Brinde";
}

/** Descrição completa da condição PRX, usada no Resumo Comercial. */
export function describeOffer(offer: {
  offerKind: OfferKind;
  prxPrice: number | null;
  discountPercent: number | null;
  giftDescription: string;
}): string {
  if (offer.offerKind === "percentual") return `${offer.discountPercent ?? 0}% OFF`;
  if (offer.offerKind === "preco") return offer.prxPrice === 0 ? "Gratuito (R$ 0,00)" : formatMoney(offer.prxPrice ?? 0);
  return `Brinde: ${offer.giftDescription}`;
}

/** Preço efetivo pago pelo membro, quando calculável. Usado para estimar vendas. */
export function effectivePrice(offer: {
  offerKind: OfferKind;
  normalPrice: number | null;
  prxPrice: number | null;
  discountPercent: number | null;
}): number | null {
  if (offer.offerKind === "preco") return offer.prxPrice;
  if (offer.offerKind === "percentual" && offer.normalPrice !== null && offer.discountPercent !== null) {
    return Math.round(offer.normalPrice * (1 - offer.discountPercent / 100) * 100) / 100;
  }
  return null;
}
