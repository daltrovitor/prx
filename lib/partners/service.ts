// Hello World
import { supabaseAdmin } from "@/lib/supabase/client";
import { passStore } from "@/lib/pass-store";
import type { Benefit } from "@/lib/pass-data";
import {
  birthDatesFor,
  deactivateBenefit,
  isUuid,
  listBenefitsByPartner,
  listVouchersForBenefits,
  publishCampaignBenefit,
} from "@/lib/partners/catalog";
import { ACCEPTANCE_DECLARATION, TERMS_VERSION, buildSummaryRows, missingForAcceptance, type ContractDocument } from "@/lib/partners/contract";
import { buildContractWithHash, newCertificateId } from "@/lib/partners/contract-hash";
import { createPartnerAccount, linkExistingAccount, revokePartnerAccess, verifyAccountPassword, type PartnerAccount } from "@/lib/partners/access";
import { PartnerError, dbError } from "@/lib/partners/errors";
import { ageBandFromBirthDate, computePartnerMetrics, type AgeBand, type PartnerMetrics } from "@/lib/partners/metrics";
import { effectivePrice } from "@/lib/partners/plans";
import { getPartnerRepository } from "@/lib/partners/repository";
import type {
  Campaign,
  CampaignRevision,
  CommercialSummary,
  ContractAcceptance,
  Partner,
  PartnerContact,
  PartnerInput,
  PartnerRepresentative,
  PartnerSnapshot,
} from "@/lib/partners/types";

const repo = () => getPartnerRepository();

export function snapshotOf(partner: Partner): PartnerSnapshot {
  return {
    tradeName: partner.tradeName,
    legalName: partner.legalName,
    documentType: partner.documentType,
    document: partner.document,
    location: partner.location,
    representative: partner.representative,
    contact: partner.contact,
  };
}

async function requirePartner(id: string): Promise<Partner> {
  const partner = await repo().getPartner(id);
  if (!partner) throw new PartnerError("Parceiro não encontrado.", 404);
  return partner;
}

async function requireCampaign(id: string): Promise<Campaign> {
  const campaign = await repo().getCampaign(id);
  if (!campaign) throw new PartnerError("Campanha não encontrada.", 404);
  return campaign;
}

/* -------------------------------------------------------------------------- */
/* Parceiros (admin)                                                           */
/* -------------------------------------------------------------------------- */

export interface PartnerOverview extends Partner {
  benefitCount: number;
  campaignCounts: { draft: number; sent: number; accepted: number; cancelled: number };
}

export async function listPartnersOverview(): Promise<PartnerOverview[]> {
  const [partners, campaigns] = await Promise.all([repo().listPartners(), repo().listCampaigns()]);
  const benefitsByPartner = new Map<string, number>();
  const benefitLists = await Promise.all(partners.map((p) => listBenefitsByPartner(p.id)));
  partners.forEach((p, i) => benefitsByPartner.set(p.id, benefitLists[i].length));

  return partners.map((partner) => {
    const own = campaigns.filter((c) => c.partnerId === partner.id);
    const count = (status: Campaign["status"]) => own.filter((c) => c.status === status).length;
    return {
      ...partner,
      benefitCount: benefitsByPartner.get(partner.id) ?? 0,
      campaignCounts: { draft: count("draft"), sent: count("sent"), accepted: count("accepted"), cancelled: count("cancelled") },
    };
  });
}

export type AccessRequest = { mode: "link"; email: string } | { mode: "create"; email: string; name: string } | { mode: "revoke" };

async function assertAccountFree(userId: string, partnerId?: string) {
  const owner = await repo().getPartnerByOwner(userId);
  if (owner && owner.id !== partnerId) {
    throw new PartnerError(`Esta conta já acessa o parceiro “${owner.tradeName}”. Cada login pertence a um único parceiro.`, 409);
  }
}

async function resolveAccess(request: Exclude<AccessRequest, { mode: "revoke" }>, partnerId?: string): Promise<PartnerAccount> {
  if (request.mode === "link") {
    const account = await linkExistingAccount(request.email);
    await assertAccountFree(account.userId, partnerId);
    return account;
  }
  return createPartnerAccount(request.email, request.name);
}

export async function createPartner(input: PartnerInput, access?: Exclude<AccessRequest, { mode: "revoke" }>): Promise<{ partner: Partner; account?: PartnerAccount }> {
  const account = access ? await resolveAccess(access) : undefined;
  const partner = await repo().insertPartner({
    ...input,
    ownerUserId: account?.userId ?? null,
    ownerEmail: account?.email ?? null,
  });
  return { partner, account };
}

export async function updatePartner(id: string, input: PartnerInput): Promise<Partner> {
  const current = await requirePartner(id);
  const partner = await repo().updatePartner(id, input);
  // Benefícios herdam nome, imagens e local do parceiro.
  if (current.tradeName !== partner.tradeName || current.logoUrl !== partner.logoUrl || current.bannerUrl !== partner.bannerUrl || current.location !== partner.location) {
    await syncBenefitBranding(partner);
  }
  return partner;
}

async function syncBenefitBranding(partner: Partner) {
  if (supabaseAdmin && isUuid(partner.id)) {
    const { error } = await supabaseAdmin
      .from("benefits")
      .update({
        partner_name: partner.tradeName,
        partner_logo: partner.logoUrl || null,
        partner_banner: partner.bannerUrl || null,
        partner_location: partner.location,
      })
      .eq("partner_id", partner.id);
    if (error) throw dbError(error, "Não foi possível atualizar os benefícios do parceiro");
  }
  passStore
    .getBenefits()
    .filter((b) => b.partnerId === partner.id)
    .forEach((b) =>
      passStore.updateBenefit(b.id, {
        partnerName: partner.tradeName,
        partnerLogo: partner.logoUrl,
        partnerBanner: partner.bannerUrl,
        partnerLocation: partner.location,
      })
    );
}

export async function setPartnerAccess(partnerId: string, request: AccessRequest): Promise<{ partner: Partner; account?: PartnerAccount }> {
  const partner = await requirePartner(partnerId);
  if (request.mode === "revoke") {
    if (partner.ownerUserId) await revokePartnerAccess(partner.ownerUserId, partner.ownerEmail);
    return { partner: await repo().updatePartner(partnerId, { ownerUserId: null, ownerEmail: null }) };
  }
  const account = await resolveAccess(request, partnerId);
  if (partner.ownerUserId && partner.ownerUserId !== account.userId) {
    await revokePartnerAccess(partner.ownerUserId, partner.ownerEmail);
  }
  return { partner: await repo().updatePartner(partnerId, { ownerUserId: account.userId, ownerEmail: account.email }), account };
}

/* -------------------------------------------------------------------------- */
/* Campanhas (admin)                                                           */
/* -------------------------------------------------------------------------- */

export async function createCampaign(partnerId: string, summary: CommercialSummary, actor: string): Promise<Campaign> {
  await requirePartner(partnerId);
  const campaign = await repo().insertCampaign({
    partnerId,
    status: "draft",
    version: 1,
    summary,
    benefitId: null,
    createdBy: actor,
    sentAt: null,
    acceptedAt: null,
    cancelledAt: null,
    cancelReason: null,
  });
  await repo().insertRevision({ campaignId: campaign.id, version: 1, summary, changedBy: actor, changedAt: campaign.createdAt });
  return campaign;
}

/** Editar gera nova versão. Se já estava com o parceiro, ele precisa revisar a nova versão. */
export async function updateCampaign(id: string, summary: CommercialSummary, actor: string): Promise<Campaign> {
  const current = await requireCampaign(id);
  if (current.status !== "draft" && current.status !== "sent") {
    throw new PartnerError("Campanha aceita ou cancelada não pode ser alterada. Crie uma nova campanha.", 409);
  }
  const version = current.version + 1;
  const updated = await repo().updateCampaign(id, { summary, version }, { statuses: ["draft", "sent"], version: current.version });
  if (!updated) throw new PartnerError("A campanha mudou enquanto você editava (foi aceita ou alterada). Recarregue.", 409);
  await repo().insertRevision({ campaignId: id, version, summary, changedBy: actor, changedAt: updated.updatedAt });
  return updated;
}

export async function sendCampaign(id: string): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  const partner = await requirePartner(campaign.partnerId);
  if (!partner.ownerUserId) throw new PartnerError("Vincule um login ao parceiro antes de enviar: é por ele que o representante aceita.", 422);
  if (partner.status === "SUSPENSO" || partner.status === "BLOQUEADO") throw new PartnerError("Parceiro suspenso ou bloqueado não recebe campanhas.", 422);
  const updated = await repo().updateCampaign(id, { status: "sent", sentAt: new Date().toISOString() }, { statuses: ["draft"] });
  if (!updated) throw new PartnerError("Só rascunhos podem ser enviados para aceite.", 409);
  return updated;
}

export async function cancelCampaign(id: string, reason: string): Promise<Campaign> {
  const campaign = await requireCampaign(id);
  const updated = await repo().updateCampaign(
    id,
    { status: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: reason },
    { statuses: ["draft", "sent", "accepted"] }
  );
  if (!updated) throw new PartnerError("Esta campanha já está cancelada.", 409);
  if (campaign.benefitId) await deactivateBenefit(campaign.benefitId);
  return updated;
}

/** Reprocessa a publicação do benefício de uma campanha aceita (idempotente). */
export async function publishAcceptedCampaign(id: string): Promise<Benefit> {
  const campaign = await requireCampaign(id);
  const acceptance = await repo().getAcceptanceByCampaign(id);
  if (!acceptance || campaign.status !== "accepted") throw new PartnerError("A campanha ainda não foi aceita pelo parceiro.", 409);
  const partner = await requirePartner(campaign.partnerId);
  const benefit = await publishCampaignBenefit(partner, campaign, acceptance.summarySnapshot);
  if (campaign.benefitId !== benefit.id) {
    await repo().updateCampaign(id, { benefitId: benefit.id }, { statuses: ["accepted"] });
  }
  return benefit;
}

/* -------------------------------------------------------------------------- */
/* Contrato                                                                    */
/* -------------------------------------------------------------------------- */

export interface ContractView {
  campaign: Campaign;
  partner: Partner;
  document: ContractDocument;
  hash: string;
  acceptance: ContractAcceptance | null;
  /** Para contrato aceito: o texto re-gerado bate com o hash gravado no aceite. */
  verified: boolean | null;
  missing: string[];
}

export async function contractView(campaignId: string): Promise<ContractView> {
  const campaign = await requireCampaign(campaignId);
  const [partner, acceptance] = await Promise.all([requirePartner(campaign.partnerId), repo().getAcceptanceByCampaign(campaignId)]);

  if (acceptance) {
    const { document, hash } = buildContractWithHash(acceptance.partnerSnapshot, {
      id: campaign.id,
      version: acceptance.campaignVersion,
      summary: acceptance.summarySnapshot,
    });
    return { campaign, partner, document, hash, acceptance, verified: hash === acceptance.contentHash, missing: [] };
  }

  const snapshot = snapshotOf(partner);
  const { document, hash } = buildContractWithHash(snapshot, campaign);
  return { campaign, partner, document, hash, acceptance: null, verified: null, missing: missingForAcceptance(snapshot) };
}

export async function listRevisions(campaignId: string): Promise<CampaignRevision[]> {
  return repo().listRevisions(campaignId);
}

export async function listCampaignsWithAcceptance(partnerId?: string): Promise<Array<Campaign & { acceptance: ContractAcceptance | null }>> {
  const [campaigns, acceptances] = await Promise.all([repo().listCampaigns(partnerId ? { partnerId } : undefined), repo().listAcceptances(partnerId ? { partnerId } : undefined)]);
  const byCampaign = new Map(acceptances.map((a) => [a.campaignId, a]));
  return campaigns.map((c) => {
    const acceptance = byCampaign.get(c.id) ?? null;
    // O aceite é a fonte de verdade: se o status não foi gravado por falha de rede, ele prevalece.
    return { ...c, status: acceptance && c.status === "sent" ? "accepted" : c.status, acceptance };
  });
}

/* -------------------------------------------------------------------------- */
/* Portal do parceiro                                                          */
/* -------------------------------------------------------------------------- */

export async function requirePartnerForUser(user: { sub: string; email?: string | null }): Promise<Partner> {
  const partner = await repo().getPartnerByOwner(user.sub, user.email);
  if (!partner) throw new PartnerError("Sua conta ainda não está vinculada a um parceiro. Fale com a equipe PRX.", 403);
  return partner;
}

export function assertPartnerOperational(partner: Partner) {
  if (partner.status === "SUSPENSO" || partner.status === "BLOQUEADO") {
    throw new PartnerError("A parceria está suspensa. Fale com a equipe PRX.", 403);
  }
}

export interface PartnerCampaignView {
  id: string;
  status: Campaign["status"];
  version: number;
  summary: CommercialSummary;
  summaryRows: Array<readonly [string, string]>;
  contractHash: string;
  missing: string[];
  sentAt: string | null;
  acceptance: Pick<ContractAcceptance, "certificateId" | "acceptedAt" | "contentHash" | "userEmail"> | null;
  cancelReason: string | null;
}

/** Campanhas visíveis ao parceiro (rascunhos são internos da PRX). */
export async function listCampaignsForPartner(partner: Partner): Promise<PartnerCampaignView[]> {
  const campaigns = await listCampaignsWithAcceptance(partner.id);
  const snapshot = snapshotOf(partner);
  return campaigns
    .filter((c) => c.status !== "draft")
    .map((c) => {
      const accepted = c.acceptance;
      const effectivePartner = accepted ? accepted.partnerSnapshot : snapshot;
      const effectiveSummary = accepted ? accepted.summarySnapshot : c.summary;
      const version = accepted ? accepted.campaignVersion : c.version;
      const { hash } = buildContractWithHash(effectivePartner, { id: c.id, version, summary: effectiveSummary });
      return {
        id: c.id,
        status: c.status,
        version,
        summary: effectiveSummary,
        summaryRows: buildSummaryRows(effectivePartner, effectiveSummary),
        contractHash: hash,
        missing: accepted ? [] : missingForAcceptance(snapshot),
        sentAt: c.sentAt,
        acceptance: accepted
          ? { certificateId: accepted.certificateId, acceptedAt: accepted.acceptedAt, contentHash: accepted.contentHash, userEmail: accepted.userEmail }
          : null,
        cancelReason: c.cancelReason,
      };
    });
}

export async function updateOwnProfile(partner: Partner, data: { representative: PartnerRepresentative; contact: PartnerContact }): Promise<Partner> {
  return repo().updatePartner(partner.id, { representative: data.representative, contact: data.contact });
}

export interface AcceptInput {
  campaignId: string;
  version: number;
  contentHash: string;
  declarationAccepted: boolean;
  password: string;
  user: { sub: string; email: string };
  ipAddress: string | null;
  userAgent: string | null;
}

export const AUTH_METHOD =
  "Sessão do Portal do Parceiro (e-mail e senha, cookie HttpOnly assinado HMAC-SHA256) com reconfirmação de senha no ato do aceite";

/**
 * Aceite eletrônico. Garante que o representante aceita exatamente a versão
 * que viu (versão + hash), com cadastro completo e senha reconfirmada.
 */
export async function acceptCampaign(partner: Partner, input: AcceptInput): Promise<{ acceptance: ContractAcceptance; benefit: Benefit | null }> {
  assertPartnerOperational(partner);
  if (!input.declarationAccepted) throw new PartnerError("Marque a declaração de poderes e concordância para aceitar.", 422);

  const campaign = await requireCampaign(input.campaignId);
  if (campaign.partnerId !== partner.id) throw new PartnerError("Campanha não encontrada.", 404);
  if (campaign.status === "accepted") throw new PartnerError("Esta campanha já foi aceita.", 409);
  if (campaign.status !== "sent") throw new PartnerError("Esta campanha não está disponível para aceite.", 409);

  const snapshot = snapshotOf(partner);
  const missing = missingForAcceptance(snapshot);
  if (missing.length > 0) throw new PartnerError(`Complete o cadastro antes de aceitar: ${missing.join(", ")}.`, 422);

  const { hash } = buildContractWithHash(snapshot, campaign);
  if (campaign.version !== input.version || hash !== input.contentHash) {
    throw new PartnerError("O Resumo Comercial foi atualizado enquanto você lia. Revise a versão atual antes de aceitar.", 409);
  }

  if (!(await verifyAccountPassword(input.user.email, input.password))) {
    throw new PartnerError("Senha incorreta. O aceite exige a senha do seu login no portal.", 401);
  }

  const acceptedAt = new Date().toISOString();
  // 1) Trava a campanha na versão lida: nenhuma edição do admin passa depois daqui.
  const locked = await repo().updateCampaign(input.campaignId, { status: "accepted", acceptedAt }, { statuses: ["sent"], version: input.version });
  if (!locked) throw new PartnerError("A campanha mudou agora há pouco. Recarregue e revise a versão atual.", 409);

  // 2) Registro imutável do aceite. Se falhar, a campanha volta para "aguardando aceite".
  let acceptance: ContractAcceptance;
  try {
    acceptance = await repo().insertAcceptance({
      campaignId: campaign.id,
      partnerId: partner.id,
      certificateId: newCertificateId(),
      termsVersion: TERMS_VERSION,
      campaignVersion: campaign.version,
      contentHash: hash,
      partnerSnapshot: snapshot,
      summarySnapshot: campaign.summary,
      declaration: ACCEPTANCE_DECLARATION,
      acceptedAt,
      userId: input.user.sub,
      userEmail: input.user.email,
      authMethod: AUTH_METHOD,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    await repo().updateCampaign(input.campaignId, { status: "sent", acceptedAt: null }, { statuses: ["accepted"], version: input.version });
    throw error;
  }

  // 3) Publica o benefício. Falha aqui não desfaz o aceite: o admin pode republicar.
  let benefit: Benefit | null = null;
  try {
    benefit = await publishCampaignBenefit(partner, locked, campaign.summary);
    await repo().updateCampaign(input.campaignId, { benefitId: benefit.id }, { statuses: ["accepted"] });
  } catch (error) {
    console.warn("[partners] aceite registrado, publicação do benefício pendente:", error);
  }
  return { acceptance, benefit };
}

/* -------------------------------------------------------------------------- */
/* Métricas                                                                    */
/* -------------------------------------------------------------------------- */

export interface CampaignProgress {
  campaignId: string;
  title: string;
  quantity: number;
  unit: string;
  redeemed: number;
  validated: number;
  startDate: string;
  endDate: string;
}

export async function partnerMetrics(partnerId: string, days = 90): Promise<{ metrics: PartnerMetrics; campaigns: CampaignProgress[]; periodDays: number }> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [benefits, campaigns] = await Promise.all([listBenefitsByPartner(partnerId), listCampaignsWithAcceptance(partnerId)]);
  const benefitIds = benefits.map((b) => b.id);
  const [events, vouchers] = await Promise.all([repo().listEvents(benefitIds, since), listVouchersForBenefits(benefitIds)]);

  const births = await birthDatesFor(vouchers.map((v) => v.userId));
  const band = (userId: string): AgeBand => ageBandFromBirthDate(births.get(userId) ?? null);
  const inWindow = vouchers.filter((v) => v.createdAt >= since);

  const accepted = campaigns.filter((c) => c.acceptance && c.benefitId);
  const offers = accepted.map((c) => ({ benefitId: c.benefitId as string, price: effectivePrice(c.acceptance!.summarySnapshot) }));

  const metrics = computePartnerMetrics({
    events,
    vouchers: inWindow.map((v) => ({
      benefitId: v.benefitId,
      memberKey: v.userId || v.userEmail,
      ageBand: band(v.userId),
      status: v.status,
      createdAt: v.createdAt,
      validatedAt: v.validatedAt,
    })),
    offers,
  });

  const progress: CampaignProgress[] = accepted.map((c) => {
    const summary = c.acceptance!.summarySnapshot;
    const own = vouchers.filter((v) => v.benefitId === c.benefitId && v.status !== "cancelled");
    return {
      campaignId: c.id,
      title: summary.benefitTitle,
      quantity: summary.quantity,
      unit: summary.quantityUnit,
      redeemed: own.length,
      validated: own.filter((v) => v.status === "used").length,
      startDate: summary.startDate,
      endDate: summary.endDate,
    };
  });

  return { metrics, campaigns: progress, periodDays: days };
}

/** Registra exibições e cliques sem identidade: só benefício, parceiro e faixa etária. */
export async function recordBenefitEvents(input: { impressions: string[]; click: string | null; ageBand: AgeBand }): Promise<number> {
  const ids = Array.from(new Set([...input.impressions, ...(input.click ? [input.click] : [])]));
  if (ids.length === 0) return 0;

  const owners = new Map<string, string>();
  if (supabaseAdmin) {
    const uuids = ids.filter(isUuid);
    if (uuids.length > 0) {
      const { data, error } = await supabaseAdmin.from("benefits").select("id, partner_id").in("id", uuids);
      if (error) throw dbError(error, "Não foi possível registrar as métricas");
      (data as Array<{ id: string; partner_id: string | null }>).forEach((row) => row.partner_id && owners.set(row.id, row.partner_id));
    }
  } else {
    passStore.getBenefits().forEach((b) => b.partnerId && ids.includes(b.id) && owners.set(b.id, b.partnerId));
  }

  const events = [
    ...Array.from(new Set(input.impressions)).map((benefitId) => ({ benefitId, kind: "impression" as const })),
    ...(input.click ? [{ benefitId: input.click, kind: "click" as const }] : []),
  ]
    .filter((e) => owners.has(e.benefitId))
    .map((e) => ({ ...e, partnerId: owners.get(e.benefitId) as string, ageBand: input.ageBand }));

  await repo().recordEvents(events);
  return events.length;
}
