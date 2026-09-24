import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerRequest } from "@/lib/auth";
import { passStore, SystemVoucher } from "@/lib/pass-store";
import { supabaseAdmin } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { VoucherRow } from "@/lib/db-rows";

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

/**
 * Mascara o e-mail do membro para o parceiro (LGPD: o balcão só precisa
 * confirmar a identidade, não receber o endereço completo).
 */
type PartnerVoucherView = Omit<SystemVoucher, "userEmail" | "userName" | "userId"> & {
  userEmail: string;
  userName: string;
  userId: string;
  validatedAt?: string | null;
};

function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

/**
 * POST /api/partner/validate
 * body: { code: string, action?: 'lookup' | 'redeem' }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyPartnerRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const rawInput = body.code || body.payload || "";
    const action = body.action || "lookup"; // 'lookup' | 'redeem'

    if (!rawInput) {
      return NextResponse.json(
        { error: "Informe ou escaneie o código do voucher." },
        { status: 400 }
      );
    }

    const normalizedCode = extractVoucherCode(rawInput);

    // 1. Try finding in Supabase
    let foundVoucher: PartnerVoucherView | null = null;
    if (supabaseAdmin) {
      // Busca por colunas separadas: nunca interpolar entrada do usuário no filtro .or()
      // do PostgREST, e só comparar com a coluna uuid quando o valor for um uuid.
      const isUuidInput = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedCode);
      const byCode = await supabaseAdmin.from("vouchers").select("*").eq("code", normalizedCode).maybeSingle<VoucherRow>();
      const byId =
        !byCode.data && isUuidInput
          ? await supabaseAdmin.from("vouchers").select("*").eq("id", normalizedCode.toLowerCase()).maybeSingle<VoucherRow>()
          : null;
      const data = byCode.data ?? byId?.data ?? null;
      const error = byCode.error && !byId?.data ? byCode.error : null;

      if (!error && data) {
        foundVoucher = {
          id: data.id,
          code: data.code,
          benefitId: data.benefit_id ?? "",
          benefitTitle: data.benefit_title ?? "",
          partnerId: data.partner_id ?? "",
          partnerName: data.partner_name ?? "",
          discountLabel: data.discount_label ?? "",
          status: data.status,
          qrPayload: data.qr_payload ?? "",
          redeemedAt: new Date(data.redeemed_at || data.created_at || Date.now()).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          validatedAt: data.validated_at
            ? new Date(data.validated_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          terms: data.terms || "Apresente o QR Code no balcão ao pedir a conta.",
          userId: data.user_id ?? "",
          userEmail: maskEmail(data.user_email),
          userName: data.user_name ?? "",
        };
      }
    }

    // 2. Fallback to passStore
    if (!foundVoucher) {
      const vouchers = passStore.getVouchers();
      const match = vouchers.find(
        (v) =>
          v.code.toUpperCase() === normalizedCode ||
          v.qrPayload === rawInput ||
          v.id === normalizedCode
      );
      if (match) {
        foundVoucher = { ...match };
      }
    }

    if (!foundVoucher) {
      return NextResponse.json(
        {
          success: false,
          error: `Voucher '${normalizedCode}' não encontrado no sistema. Verifique o código e tente novamente.`,
        },
        { status: 404 }
      );
    }

    // Action: Redeem / Mark as used
    if (action === "redeem") {
      if (foundVoucher.status === "used") {
        return NextResponse.json(
          {
            success: false,
            error: `Este voucher já foi utilizado anteriormente${
              foundVoucher.validatedAt ? ` em ${foundVoucher.validatedAt}` : ""
            }.`,
            voucher: foundVoucher,
          },
          { status: 400 }
        );
      }

      const validatedAtIso = new Date().toISOString();
      const validatedAtDisplay = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Update in Supabase
      if (supabaseAdmin) {
        try {
          // Baixa condicional: só marca se ainda não foi usado. Duas leituras
          // simultâneas do mesmo QR não conseguem dar baixa duas vezes.
          const { data: updated, error: updateError } = await supabaseAdmin
            .from("vouchers")
            .update({
              status: "used",
              validated_at: validatedAtIso,
            })
            .eq("id", foundVoucher.id)
            .neq("status", "used")
            .select("id");
          if (!updateError && Array.isArray(updated) && updated.length === 0 && /^[0-9a-f-]{36}$/i.test(String(foundVoucher.id))) {
            return NextResponse.json(
              { success: false, error: "Este voucher acabou de ser utilizado em outro caixa.", voucher: { ...foundVoucher, status: "used" } },
              { status: 409 }
            );
          }
        } catch (dbErr) {
          console.warn("Supabase voucher update notice:", dbErr);
        }
      }

      // Update in passStore
      passStore.updateVoucherStatus(foundVoucher.id, "used");
      if (foundVoucher.code) {
        passStore.updateVoucherStatus(foundVoucher.code, "used");
      }

      foundVoucher.status = "used";
      foundVoucher.validatedAt = validatedAtDisplay;

      return NextResponse.json({
        success: true,
        message: "Voucher validado e baixado com sucesso!",
        voucher: foundVoucher,
      });
    }

    // Default Action: Lookup only
    return NextResponse.json({
      success: true,
      canRedeem: foundVoucher.status === "valid",
      warning:
        foundVoucher.status === "used"
          ? `Atenção: Este voucher já consta como UTILIZADO${
              foundVoucher.validatedAt ? ` em ${foundVoucher.validatedAt}` : ""
            }.`
          : null,
      voucher: foundVoucher,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao processar validação do voucher." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/partner/validate
 * Returns recent vouchers validated or stored
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyPartnerRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Try Supabase first
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        const mapped = data.map((v: VoucherRow) => ({
          id: v.id,
          code: v.code,
          benefitTitle: v.benefit_title,
          partnerName: v.partner_name,
          discountLabel: v.discount_label,
          status: v.status,
          redeemedAt: new Date(v.redeemed_at || v.created_at || Date.now()).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          validatedAt: v.validated_at
            ? new Date(v.validated_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          userName: v.user_name,
          userEmail: maskEmail(v.user_email),
        }));

        return NextResponse.json({ success: true, vouchers: mapped });
      }
    }

    // Fallback to passStore
    const all = passStore
      .getVouchers()
      .slice(0, 20)
      .map((v) => ({ ...v, userEmail: maskEmail(v.userEmail) }));
    return NextResponse.json({ success: true, vouchers: all });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao consultar histórico." },
      { status: 500 }
    );
  }
}
