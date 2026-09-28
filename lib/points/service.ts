// Hello World
import { PartnerError } from "@/lib/partners/errors";
import { getPartnerRepository } from "@/lib/partners/repository";
import { listBenefitsByPartner } from "@/lib/partners/catalog";
import type { Benefit } from "@/lib/pass-data";
import { calculatePrxLevel } from "@/lib/pass-data";
import { DEFAULT_PARTNER_FEE_PCT, purchaseReward } from "@/lib/points/economics";
import { matchPartner, verticalOf, type MatchablePartner } from "@/lib/points/partner-match";
import { claimsReaderFor, getLedgerReaders, getRulesRepository, getWalletRepository, INSUFFICIENT_COINS, type ApplyResult } from "@/lib/points/repository";
import { claimStatus, toMemberRule } from "@/lib/points/rules";
import type { BehaviorClaim, ClaimStatus, PartnerMatchMethod, PartnerPurchase, PointRule, PointRuleTrigger, PointsWallet } from "@/lib/points/types";
import type { Partner } from "@/lib/partners/types";

/**
 * Regras da economia PRX do lado do servidor. Toda concessão de coins/XP e
 * todo débito passa por aqui; o cliente nunca informa quanto ganhou.
 */

export async function listActiveRules(): Promise<PointRule[]> {
  return (await getRulesRepository().listRules()).filter((rule) => rule.active);
}

async function ruleFor(trigger: PointRuleTrigger): Promise<PointRule | null> {
  return (await listActiveRules()).find((rule) => rule.trigger === trigger) ?? null;
}

export async function getWallet(userId: string): Promise<PointsWallet> {
  const wallet = getWalletRepository(userId);
  const [balance, transactions, claims, rules, purchases, history] = await Promise.all([
    wallet.getBalance(userId),
    wallet.listTransactions(userId, 100),
    wallet.lastClaims(userId),
    listActiveRules(),
    wallet.listPurchases(userId, 20),
    wallet.listClaims(userId, 30),
  ]);
  const now = new Date();
  return {
    coins: balance.coins,
    xp: balance.xp,
    level: calculatePrxLevel(balance.xp),
    transactions,
    rules: rules.map((rule) => toMemberRule(rule, claims[rule.id] ?? null, now)),
    purchases,
    claims: history,
  };
}

/**
 * Bom comportamento enviado pelo membro. Nada é creditado agora: o envio
 * entra na fila de análise da equipe PRX, com coins e XP congelados, e só
 * vira pontos quando aprovado (reviewClaim). A periodicidade conta envios
 * em análise e aprovados; recusados liberam novo envio.
 */
export async function submitClaim(member: { id: string; name: string; email: string }, ruleId: string, evidence: string): Promise<BehaviorClaim> {
  const rule = await getRulesRepository().getRule(ruleId);
  if (!rule || !rule.active) throw new PartnerError("Esta ação não está disponível.", 404);
  if (rule.trigger !== "checkin") throw new PartnerError("Esta recompensa é creditada automaticamente.", 409);
  const wallet = getWalletRepository(member.id);
  const claims = await wallet.lastClaims(member.id);
  const status = claimStatus(rule, claims[rule.id] ?? null);
  if (status.status === "pending") throw new PartnerError("Seu envio anterior ainda está em análise.", 409);
  if (status.status === "done") throw new PartnerError("Você já garantiu esta recompensa.", 409);
  if (status.status === "cooldown") throw new PartnerError("Você já enviou este bom comportamento no período. Volte no próximo.", 409);
  return wallet.insertClaim({
    userId: member.id,
    userName: member.name,
    userEmail: member.email,
    ruleId: rule.id,
    ruleTitle: rule.title,
    coins: rule.coins,
    xp: rule.xp,
    evidence,
  });
}

/** Fila de análise do admin (Supabase e memória, quando os dois existem). */
export async function listClaimsForReview(status: ClaimStatus | "all", limit = 100): Promise<BehaviorClaim[]> {
  const lists = await Promise.all(getLedgerReaders().map((r) => r.listClaimsByStatus(status, limit)));
  return lists.flat().sort((a, b) => (status === "pending" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))).slice(0, limit);
}

/**
 * Aprova ou recusa um envio. Na aprovação, credita os coins e o XP
 * congelados no envio (idempotente pelo id do envio) e só então marca
 * como aprovado; um clique duplo nunca credita duas vezes.
 */
export async function reviewClaim(claimId: string, decision: "approve" | "reject", note: string, reviewer: string): Promise<BehaviorClaim> {
  const reader = claimsReaderFor(claimId);
  const claim = await reader.getClaim(claimId);
  if (!claim) throw new PartnerError("Envio não encontrado.", 404);
  if (claim.status !== "pending") throw new PartnerError(`Este envio já foi ${claim.status === "approved" ? "aprovado" : "recusado"}.`, 409);
  if (decision === "approve" && (claim.coins > 0 || claim.xp > 0)) {
    await getWalletRepository(claim.userId).apply(claim.userId, {
      coinsDelta: claim.coins,
      xpDelta: claim.xp,
      source: "behavior",
      ruleId: claim.ruleId || null,
      referenceId: `claim:${claim.id}`,
      description: claim.ruleTitle,
    });
  }
  const decided = await reader.decideClaim(claimId, { status: decision === "approve" ? "approved" : "rejected", note, reviewer });
  if (!decided) throw new PartnerError("Este envio acabou de ser decidido por outra pessoa.", 409);
  return decided;
}

/** Garante que o membro tem coins suficientes antes de gerar o voucher. */
export async function assertCanAfford(userId: string, pointsCost: number): Promise<void> {
  if (!(pointsCost > 0)) return;
  const { coins } = await getWalletRepository(userId).getBalance(userId);
  if (coins < pointsCost) throw new PartnerError(`${INSUFFICIENT_COINS} Faltam ${(pointsCost - coins).toLocaleString("pt-BR")} coins.`, 409);
}

/**
 * Resgate: debita o preço em coins e credita o XP de fidelidade, numa única
 * transação do extrato (idempotente pelo id do voucher).
 */
export async function chargeRedemption(userId: string, benefit: Pick<Benefit, "id" | "title" | "partnerName" | "pointsCost">, voucherId: string): Promise<ApplyResult | null> {
  const cost = Math.max(0, Math.floor(benefit.pointsCost ?? 0));
  const charge = async () => {
    const rule = await ruleFor("benefit_redeem");
    const xp = rule?.xp ?? 0;
    if (cost === 0 && xp === 0) return null;
    return getWalletRepository(userId).apply(userId, {
      coinsDelta: -cost,
      xpDelta: xp,
      source: "benefit_redeem",
      ruleId: rule?.id ?? null,
      referenceId: voucherId,
      description: `${benefit.partnerName}: ${benefit.title}`,
    });
  };
  if (cost > 0) return charge();
  // Resgate gratuito: o XP é bônus e nunca derruba o resgate (ex.: migração de pontos ainda não aplicada).
  try {
    return await charge();
  } catch (error) {
    console.warn("[points] XP de resgate não registrado:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** XP de fidelidade quando o voucher é validado no balcão. Nunca derruba a validação. */
export async function rewardVoucherUse(userId: string, voucherId: string, label: string): Promise<void> {
  if (!userId) return;
  try {
    const rule = await ruleFor("voucher_use");
    if (!rule || (rule.coins === 0 && rule.xp === 0)) return;
    await getWalletRepository(userId).apply(userId, {
      coinsDelta: rule.coins,
      xpDelta: rule.xp,
      source: "voucher_use",
      ruleId: rule.id,
      referenceId: voucherId,
      description: label,
    });
  } catch (error) {
    console.warn("[points] XP de uso de voucher não registrado:", error instanceof Error ? error.message : error);
  }
}

/* -------------------------------------------------------------------------- */
/* Compra em parceiro via Pix (motor pré-BaaS)                                */
/* -------------------------------------------------------------------------- */

function toMatchable(partner: Partner): MatchablePartner & { partner: Partner } {
  return {
    id: partner.id,
    tradeName: partner.tradeName,
    legalName: partner.legalName,
    document: partner.document,
    categoryId: partner.categoryId,
    status: partner.status,
    contactEmail: partner.contact?.email,
    contactPhone: partner.contact?.phone,
    ownerEmail: partner.ownerEmail,
    partner,
  };
}

/** Comissão da PRX sobre compras no parceiro: a maior definida nos benefícios dele, ou 8%. */
async function partnerFeePct(partnerId: string): Promise<number> {
  try {
    const fees = (await listBenefitsByPartner(partnerId)).map((b) => b.partnerFeePct ?? 0).filter((fee) => fee > 0);
    return fees.length > 0 ? Math.max(...fees) : DEFAULT_PARTNER_FEE_PCT;
  } catch {
    return DEFAULT_PARTNER_FEE_PCT;
  }
}

export interface PartnerPixPreview {
  partnerId: string;
  partnerName: string;
  categoryId: string;
  categoryName: string;
  verticalCode: string;
  matchMethod: PartnerMatchMethod;
  coins: number;
  xp: number;
}

/** Identifica o parceiro de um Pix ainda não enviado (tela de revisão) e estima a recompensa. */
export async function previewPartnerPix(input: { key: string; recipientName?: string | null; amount?: number }): Promise<PartnerPixPreview | null> {
  const partners = (await getPartnerRepository().listPartners()).map(toMatchable);
  const match = matchPartner({ key: input.key, recipientName: input.recipientName }, partners);
  if (!match) return null;
  const vertical = verticalOf(match.partner.categoryId);
  const reward = purchaseReward(input.amount ?? 0, await partnerFeePct(match.partner.id), await ruleFor("partner_purchase"));
  return {
    partnerId: match.partner.id,
    partnerName: match.partner.tradeName,
    categoryId: vertical.id,
    categoryName: vertical.name,
    verticalCode: vertical.code,
    matchMethod: match.method,
    coins: reward.coins,
    xp: reward.xp,
  };
}

export interface PartnerPixTransfer {
  /** Identificador fim a fim do Pix (E2E) devolvido pelo SPI/BaaS. */
  endToEndId: string;
  key: string;
  recipientName?: string | null;
  amount: number;
  source: "sandbox" | "baas_webhook";
}

export interface PartnerPixResult {
  purchase: PartnerPurchase;
  coins: number;
  xp: number;
  level: number;
  categoryName: string;
  duplicate: boolean;
}

/**
 * Motor de compra em parceiro. Chamado quando um Pix enviado pela conta PRX é
 * liquidado — pelo gateway sandbox hoje, pelo webhook do BaaS em produção.
 * Identifica o parceiro, categoriza o gasto no nicho dele, registra a compra
 * (comissão devida pela PRX) e credita coins proporcionais e XP. Idempotente
 * pelo E2E: reprocessar o mesmo Pix não credita de novo.
 */
export async function processPartnerPixTransfer(userId: string, transfer: PartnerPixTransfer): Promise<PartnerPixResult | null> {
  if (!(transfer.amount > 0)) return null;
  const partners = (await getPartnerRepository().listPartners()).map(toMatchable);
  const match = matchPartner({ key: transfer.key, recipientName: transfer.recipientName }, partners);
  if (!match) return null;

  const vertical = verticalOf(match.partner.categoryId);
  const feePct = await partnerFeePct(match.partner.id);
  const rule = await ruleFor("partner_purchase");
  const reward = purchaseReward(transfer.amount, feePct, rule);
  const repo = getWalletRepository(userId);

  const { purchase, duplicate } = await repo.insertPurchase({
    userId,
    partnerId: match.partner.id,
    partnerName: match.partner.tradeName,
    categoryId: vertical.id,
    endToEndId: transfer.endToEndId,
    pixKey: transfer.key,
    amount: Math.round(transfer.amount * 100) / 100,
    feePct,
    commission: reward.commission,
    coins: reward.coins,
    xp: reward.xp,
    matchMethod: match.method,
    source: transfer.source,
  });

  const applied =
    purchase.coins > 0 || purchase.xp > 0
      ? await repo.apply(userId, {
          coinsDelta: purchase.coins,
          xpDelta: purchase.xp,
          source: "partner_purchase",
          ruleId: rule?.id ?? null,
          referenceId: purchase.endToEndId,
          description: `Compra em ${purchase.partnerName}`,
        })
      : null;
  const balance = applied ?? (await repo.getBalance(userId));
  return {
    purchase,
    coins: balance.coins,
    xp: balance.xp,
    level: calculatePrxLevel(balance.xp),
    categoryName: vertical.name,
    duplicate: duplicate || Boolean(applied?.duplicate),
  };
}
