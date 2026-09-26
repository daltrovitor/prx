// Hello World
import { passStore } from "@/lib/pass-store";
import { supabaseAdmin } from "@/lib/supabase/client";
import type { VoucherRow } from "@/lib/db-rows";
import { getBenefit, isUuid, listBenefitsByPartner, listVouchersForBenefits, type CatalogVoucher } from "@/lib/partners/catalog";
import { PartnerError, dbError, isMissingColumn } from "@/lib/partners/errors";
import type { Validator } from "@/lib/validation/actor";

/**
 * Baixa de vouchers do PRX PASS no balcão. O parceiro só enxerga vouchers dos
 * próprios benefícios; a equipe PRX com permissão de benefícios e o admin
 * validam de qualquer parceiro.
 */

/** Normaliza o texto digitado ou o conteúdo do QR para o código do voucher. */
export function extractVoucherCode(input: string): string {
  const trimmed = input.trim();
  // Payload: PRX_PASS::PRX-1234-5678::Parceiro. NXTGEN_PASS:: é o prefixo legado de antes do rebrand.
  if (trimmed.startsWith("PRX_PASS::") || trimmed.startsWith("NXTGEN_PASS::")) {
    const parts = trimmed.split("::");
    if (parts[1]) return parts[1].trim().toUpperCase();
  }
  return trimmed.toUpperCase();
}

const DISPLAY: Intl.DateTimeFormatOptions = {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};
export const displayDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", DISPLAY) : null);

/**
 * O que o balcão vê. LGPD (cláusula 11.3): para confirmar o atendimento basta o
 * primeiro nome; e-mail e sobrenome do membro não saem do servidor.
 */
export function counterView(v: CatalogVoucher, expired: boolean) {
  return {
    id: v.id,
    code: v.code,
    benefitTitle: v.benefitTitle,
    partnerName: v.partnerName,
    discountLabel: v.discountLabel,
    status: v.status === "used" ? ("used" as const) : ("valid" as const),
    expired,
    redeemedAt: displayDate(v.createdAt),
    validatedAt: displayDate(v.validatedAt),
    validatedAtIso: v.validatedAt,
    expiresAt: displayDate(v.expiresAt),
    terms: v.terms || "Apresente o QR Code no balcão ao pedir a conta.",
    userName: (v.userName || "Membro PRX").trim().split(/\s+/)[0],
  };
}
export type CounterVoucher = ReturnType<typeof counterView>;

function fromRow(data: VoucherRow): CatalogVoucher {
  return {
    id: data.id,
    code: data.code,
    benefitId: data.benefit_id ?? "",
    benefitTitle: data.benefit_title ?? "",
    partnerId: data.partner_id ?? "",
    partnerName: data.partner_name ?? "",
    discountLabel: data.discount_label ?? "",
    status: data.status,
    userId: data.user_id ?? "",
    userEmail: data.user_email ?? "",
    userName: data.user_name ?? "",
    terms: data.terms ?? "",
    createdAt: data.redeemed_at || data.created_at || new Date().toISOString(),
    validatedAt: data.validated_at ?? null,
    expiresAt: data.expires_at ?? null,
  };
}

function fromMemory(match: ReturnType<typeof passStore.getVouchers>[number]): CatalogVoucher {
  return {
    id: match.id,
    code: match.code,
    benefitId: match.benefitId,
    benefitTitle: match.benefitTitle,
    partnerId: match.partnerId,
    partnerName: match.partnerName,
    discountLabel: match.discountLabel,
    status: match.status,
    userId: match.userId,
    userEmail: match.userEmail,
    userName: match.userName,
    terms: match.terms,
    createdAt: match.createdAtIso || new Date().toISOString(),
    validatedAt: match.validatedAtIso ?? null,
    expiresAt: match.expiresAt ?? null,
  };
}

export async function findVoucher(normalizedCode: string, rawInput: string): Promise<CatalogVoucher | null> {
  if (supabaseAdmin) {
    // Busca por colunas separadas: nunca interpolar entrada do usuário no filtro .or()
    // do PostgREST, e só comparar com a coluna uuid quando o valor for um uuid.
    const byCode = await supabaseAdmin.from("vouchers").select("*").eq("code", normalizedCode).maybeSingle<VoucherRow>();
    const byId =
      !byCode.data && isUuid(normalizedCode)
        ? await supabaseAdmin.from("vouchers").select("*").eq("id", normalizedCode.toLowerCase()).maybeSingle<VoucherRow>()
        : null;
    const data = byCode.data ?? byId?.data ?? null;
    if (data) return fromRow(data);
  }

  const match = passStore
    .getVouchers()
    .find((v) => v.code.toUpperCase() === normalizedCode || v.qrPayload === rawInput || v.id === normalizedCode);
  return match ? fromMemory(match) : null;
}

/** Parceiro dono do voucher: gravado nele ou herdado do benefício (vouchers antigos). */
async function voucherOwner(voucher: CatalogVoucher): Promise<string> {
  if (voucher.partnerId) return voucher.partnerId;
  if (!voucher.benefitId) return "";
  return (await getBenefit(voucher.benefitId))?.partnerId ?? "";
}

async function assertCanValidateVoucher(validator: Validator, voucher: CatalogVoucher) {
  if (validator.role === "admin") return;
  if (validator.role === "staff") return;
  // Voucher de outro estabelecimento: recusa sem revelar nada sobre ele.
  if ((await voucherOwner(voucher)) !== validator.partner.id) {
    throw new PartnerError("Este voucher é de outro estabelecimento parceiro e não pode ser validado aqui.", 403);
  }
}

export type VoucherOutcome =
  | { ok: true; canRedeem: boolean; warning: string | null; message?: string; voucher: CounterVoucher }
  | { ok: false; status: 400 | 409; error: string; voucher: CounterVoucher };

const isExpired = (v: CatalogVoucher) => v.status === "valid" && Boolean(v.expiresAt) && Date.now() > new Date(v.expiresAt as string).getTime();

async function locate(validator: Validator, rawInput: string): Promise<CatalogVoucher> {
  if (validator.role === "staff" && !validator.canValidateBenefits) throw new PartnerError("Seu acesso da equipe não inclui validação de benefícios.", 403);
  if (!rawInput.trim()) throw new PartnerError("Informe ou escaneie o código do voucher.", 400);
  const normalizedCode = extractVoucherCode(rawInput);
  const found = await findVoucher(normalizedCode, rawInput);
  if (!found) throw new PartnerError(`Voucher '${normalizedCode}' não encontrado no sistema. Verifique o código e tente novamente.`, 404);
  await assertCanValidateVoucher(validator, found);
  return found;
}

export async function lookupVoucher(validator: Validator, rawInput: string): Promise<VoucherOutcome> {
  const found = await locate(validator, rawInput);
  const expired = isExpired(found);
  return {
    ok: true,
    canRedeem: found.status === "valid" && !expired,
    warning:
      found.status === "used"
        ? `Atenção: Este voucher já consta como UTILIZADO${found.validatedAt ? ` em ${displayDate(found.validatedAt)}` : ""}.`
        : expired
          ? `Voucher expirado em ${displayDate(found.expiresAt)}. O prazo de uso após a aquisição terminou.`
          : null,
    voucher: counterView(found, expired),
  };
}

export async function redeemVoucher(validator: Validator, rawInput: string): Promise<VoucherOutcome> {
  const found = await locate(validator, rawInput);
  if (found.status === "used") {
    return {
      ok: false,
      status: 400,
      error: `Este voucher já foi utilizado anteriormente${found.validatedAt ? ` em ${displayDate(found.validatedAt)}` : ""}.`,
      voucher: counterView(found, false),
    };
  }
  if (isExpired(found)) return { ok: false, status: 409, error: `Voucher expirado em ${displayDate(found.expiresAt)}.`, voucher: counterView(found, true) };

  const validatedAt = new Date().toISOString();
  if (supabaseAdmin && isUuid(found.id)) {
    // Baixa condicional: só marca se ainda não foi usado. Duas leituras
    // simultâneas do mesmo QR não conseguem dar baixa duas vezes.
    const update = (fields: Record<string, unknown>) => supabaseAdmin!.from("vouchers").update(fields).eq("id", found.id).neq("status", "used").select("id");
    let result = await update({ status: "used", validated_at: validatedAt, validated_by: validator.userId });
    if (result.error && isMissingColumn(result.error)) result = await update({ status: "used", validated_at: validatedAt });
    if (result.error) throw new PartnerError("Não foi possível dar baixa agora. Tente de novo.", 500);
    if (Array.isArray(result.data) && result.data.length === 0) {
      return { ok: false, status: 409, error: "Este voucher acabou de ser utilizado em outro caixa.", voucher: counterView({ ...found, status: "used" }, false) };
    }
  }

  passStore.updateVoucherStatus(found.id, "used", validator.userId);
  if (found.code) passStore.updateVoucherStatus(found.code, "used", validator.userId);

  return {
    ok: true,
    canRedeem: false,
    warning: null,
    message: "Voucher validado e baixado com sucesso!",
    voucher: counterView({ ...found, status: "used", validatedAt }, false),
  };
}

/** Histórico do balcão: parceiro vê os vouchers dos seus benefícios; equipe/admin, as baixas que fizeram. */
export async function voucherHistory(validator: Validator, limit = 20): Promise<CounterVoucher[]> {
  if (validator.role === "partner") {
    const benefits = await listBenefitsByPartner(validator.partner.id);
    const vouchers = await listVouchersForBenefits(
      benefits.map((b) => b.id),
      limit
    );
    return vouchers.map((v) => counterView(v, false));
  }
  if (supabaseAdmin && isUuid(validator.userId)) {
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .eq("validated_by", validator.userId)
      .order("validated_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingColumn(error)) return [];
      throw dbError(error, "Não foi possível consultar o histórico");
    }
    return (data as VoucherRow[]).map((row) => counterView(fromRow(row), false));
  }
  return passStore
    .getVouchers()
    .filter((v) => v.validatedBy === validator.userId)
    .map(fromMemory)
    .sort((a, b) => (b.validatedAt ?? "").localeCompare(a.validatedAt ?? ""))
    .slice(0, limit)
    .map((v) => counterView(v, false));
}
