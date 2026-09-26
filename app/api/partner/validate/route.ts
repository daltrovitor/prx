import { NextRequest, NextResponse } from "next/server";
import { passStore } from "@/lib/pass-store";
import { supabaseAdmin } from "@/lib/supabase/client";
import type { VoucherRow } from "@/lib/db-rows";
import { getBenefit, isUuid, listBenefitsByPartner, listVouchersForBenefits, type CatalogVoucher } from "@/lib/partners/catalog";
import { PartnerError, isMissingColumn } from "@/lib/partners/errors";
import { errorResponse, readJson, requirePartnerSession } from "@/lib/partners/http";
import { assertPartnerOperational } from "@/lib/partners/service";

/**
 * Normalizes user input or QR payload to locate voucher
 */
function extractVoucherCode(input: string): string {
  const trimmed = input.trim();
  // Payload format: PRX_PASS::PRX-1234-5678::PartnerName.
  // NXTGEN_PASS:: is the legacy prefix printed on vouchers issued before the rebrand.
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
const display = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", DISPLAY) : null);

/**
 * O que o balcão vê. LGPD (cláusula 11.3): para confirmar o atendimento basta o
 * primeiro nome; e-mail e sobrenome do membro não saem do servidor.
 */
function counterView(v: CatalogVoucher, expired: boolean) {
  return {
    id: v.id,
    code: v.code,
    benefitTitle: v.benefitTitle,
    discountLabel: v.discountLabel,
    status: v.status === "used" ? ("used" as const) : ("valid" as const),
    expired,
    redeemedAt: display(v.createdAt),
    validatedAt: display(v.validatedAt),
    expiresAt: display(v.expiresAt),
    terms: v.terms || "Apresente o QR Code no balcão ao pedir a conta.",
    userName: (v.userName || "Membro PRX").trim().split(/\s+/)[0],
  };
}

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

async function findVoucher(normalizedCode: string, rawInput: string): Promise<CatalogVoucher | null> {
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
  if (!match) return null;
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

/** Parceiro dono do voucher: gravado nele ou herdado do benefício (vouchers antigos). */
async function voucherOwner(voucher: CatalogVoucher): Promise<string> {
  if (voucher.partnerId) return voucher.partnerId;
  if (!voucher.benefitId) return "";
  return (await getBenefit(voucher.benefitId))?.partnerId ?? "";
}

/**
 * POST /api/partner/validate
 * body: { code: string, action?: 'lookup' | 'redeem' }
 * Só o parceiro dono do benefício consulta ou dá baixa no voucher.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, partner } = await requirePartnerSession(req);
    assertPartnerOperational(partner);

    const body = (await readJson(req)) as { code?: unknown; payload?: unknown; action?: unknown };
    const rawInput = String(body.code || body.payload || "").slice(0, 300);
    const action = body.action === "redeem" ? "redeem" : "lookup";
    if (!rawInput.trim()) throw new PartnerError("Informe ou escaneie o código do voucher.", 400);

    const normalizedCode = extractVoucherCode(rawInput);
    const found = await findVoucher(normalizedCode, rawInput);
    if (!found) {
      throw new PartnerError(`Voucher '${normalizedCode}' não encontrado no sistema. Verifique o código e tente novamente.`, 404);
    }

    // Voucher de outro estabelecimento: recusa sem revelar nada sobre ele.
    if ((await voucherOwner(found)) !== partner.id) {
      throw new PartnerError("Este voucher é de outro estabelecimento parceiro e não pode ser validado aqui.", 403);
    }

    const expired = found.status === "valid" && Boolean(found.expiresAt) && Date.now() > new Date(found.expiresAt as string).getTime();

    if (action === "lookup") {
      return NextResponse.json({
        success: true,
        canRedeem: found.status === "valid" && !expired,
        warning:
          found.status === "used"
            ? `Atenção: Este voucher já consta como UTILIZADO${found.validatedAt ? ` em ${display(found.validatedAt)}` : ""}.`
            : expired
              ? `Voucher expirado em ${display(found.expiresAt)}. O prazo de uso após a aquisição terminou.`
              : null,
        voucher: counterView(found, expired),
      });
    }

    if (found.status === "used") {
      return NextResponse.json(
        {
          success: false,
          error: `Este voucher já foi utilizado anteriormente${found.validatedAt ? ` em ${display(found.validatedAt)}` : ""}.`,
          voucher: counterView(found, false),
        },
        { status: 400 }
      );
    }
    if (expired) {
      return NextResponse.json(
        { success: false, error: `Voucher expirado em ${display(found.expiresAt)}.`, voucher: counterView(found, true) },
        { status: 409 }
      );
    }

    const validatedAt = new Date().toISOString();
    if (supabaseAdmin && isUuid(found.id)) {
      // Baixa condicional: só marca se ainda não foi usado. Duas leituras
      // simultâneas do mesmo QR não conseguem dar baixa duas vezes.
      const update = (fields: Record<string, unknown>) =>
        supabaseAdmin!.from("vouchers").update(fields).eq("id", found.id).neq("status", "used").select("id");
      let result = await update({ status: "used", validated_at: validatedAt, validated_by: user.sub });
      if (result.error && isMissingColumn(result.error)) result = await update({ status: "used", validated_at: validatedAt });
      if (result.error) throw new PartnerError("Não foi possível dar baixa agora. Tente de novo.", 500);
      if (Array.isArray(result.data) && result.data.length === 0) {
        return NextResponse.json(
          { success: false, error: "Este voucher acabou de ser utilizado em outro caixa.", voucher: counterView({ ...found, status: "used" }, false) },
          { status: 409 }
        );
      }
    }

    passStore.updateVoucherStatus(found.id, "used", user.sub);
    if (found.code) passStore.updateVoucherStatus(found.code, "used", user.sub);

    return NextResponse.json({
      success: true,
      message: "Voucher validado e baixado com sucesso!",
      voucher: counterView({ ...found, status: "used", validatedAt }, false),
    });
  } catch (error) {
    return errorResponse(error, "Erro ao processar validação do voucher.");
  }
}

/**
 * GET /api/partner/validate
 * Últimos vouchers dos benefícios deste parceiro (nunca de outros).
 */
export async function GET(req: NextRequest) {
  try {
    const { partner } = await requirePartnerSession(req);
    const benefits = await listBenefitsByPartner(partner.id);
    const vouchers = await listVouchersForBenefits(
      benefits.map((b) => b.id),
      20
    );
    return NextResponse.json({ success: true, vouchers: vouchers.map((v) => counterView(v, false)) });
  } catch (error) {
    return errorResponse(error, "Erro ao consultar histórico.");
  }
}
