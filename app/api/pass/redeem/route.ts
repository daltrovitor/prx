import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { passStore } from "@/lib/pass-store";
import { Benefit } from "@/lib/pass-data";
import { supabaseAdmin } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

function isUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { benefitId } = body;

    if (!benefitId) {
      return NextResponse.json({ error: "Informe o ID do benefício." }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "Entre na sua conta para resgatar benefícios." }, { status: 401 });
    }

    const effectiveUserId = user.id;
    const effectiveEmail = user.email;
    const effectiveName = user.fullName;

    // 1. Locate benefit from passStore or Supabase
    let benefit: Benefit | undefined = passStore.getBenefitById(benefitId);

    if (!benefit && supabaseAdmin) {
      try {
        const { data: dbBen, error } = await supabaseAdmin
          .from("benefits")
          .select("*")
          .eq("id", benefitId)
          .maybeSingle();

        if (!error && dbBen) {
          benefit = {
            id: dbBen.id,
            partnerId: dbBen.partner_id || dbBen.id,
            partnerName: dbBen.partner_name,
            partnerLogo: dbBen.partner_logo || "",
            partnerBanner: dbBen.partner_banner || "",
            partnerLocation: dbBen.partner_location || "São Paulo, SP",
            categoryId: dbBen.category_id || "gastronomia",
            title: dbBen.title,
            description: dbBen.description || "",
            discountLabel: dbBen.discount_label,
            minPrxLevel: dbBen.min_nxt_level || 1,
            terms: Array.isArray(dbBen.terms)
              ? dbBen.terms
              : [dbBen.terms || "Apresente o QR Code no balcão ao pedir a conta."],
          };
          // Sync into passStore cache
          passStore.createBenefit(benefit);
        }
      } catch (dbErr) {
        console.warn("Supabase lookup error during benefit redeem:", dbErr);
      }
    }

    if (!benefit) {
      return NextResponse.json({ error: "Benefício não encontrado." }, { status: 404 });
    }

    // 2. Prevent duplicate active vouchers: check if user already has an active voucher for this benefit
    // A) Check passStore
    const existingStoreVoucher = passStore
      .getUserVouchers(effectiveUserId)
      .find(
        (v) =>
          (v.benefitId === benefit!.id || v.benefitTitle === benefit!.title) &&
          v.status === "valid"
      );

    if (existingStoreVoucher) {
      return NextResponse.json({
        success: true,
        message: "Você já possui um voucher ativo para este benefício.",
        voucher: existingStoreVoucher,
        alreadyActive: true,
      });
    }

    // B) Check Supabase vouchers
    if (supabaseAdmin) {
      try {
        let query = supabaseAdmin
          .from("vouchers")
          .select("*")
          .eq("status", "valid");

        if (isUuid(benefit.id)) {
          query = query.eq("benefit_id", benefit.id);
        } else {
          query = query.eq("benefit_title", benefit.title);
        }

        if (isUuid(effectiveUserId)) {
          query = query.eq("user_id", effectiveUserId);
        } else {
          query = query.eq("user_email", effectiveEmail);
        }

        const { data: dbExisting } = await query.maybeSingle();
        if (dbExisting) {
          const mappedExisting = {
            id: dbExisting.id,
            code: dbExisting.code,
            benefitId: dbExisting.benefit_id || benefit.id,
            benefitTitle: dbExisting.benefit_title,
            partnerId: benefit.partnerId,
            partnerName: dbExisting.partner_name,
            discountLabel: dbExisting.discount_label,
            status: "valid" as const,
            qrPayload: dbExisting.qr_payload,
            redeemedAt: new Date(dbExisting.redeemed_at || dbExisting.created_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
            terms: dbExisting.terms || benefit.terms[0] || "Apresente o QR Code no balcão.",
            userId: dbExisting.user_id || effectiveUserId,
            userEmail: dbExisting.user_email || effectiveEmail,
            userName: dbExisting.user_name || effectiveName,
          };
          // Sync into passStore
          passStore.createVoucher(mappedExisting);

          return NextResponse.json({
            success: true,
            message: "Você já possui um voucher ativo para este benefício.",
            voucher: mappedExisting,
            alreadyActive: true,
          });
        }
      } catch (checkErr) {
        console.warn("Notice checking existing vouchers in Supabase:", checkErr);
      }
    }

    // 3. Generate fresh anti-tamper code & QR payload
    const uniqueCode = `PRX-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const qrPayload = `PRX_PASS::${uniqueCode}::${benefit.partnerName.replace(/\s+/g, "")}`;
    const formattedNow = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const terms = benefit.terms[0] || "Apresente o QR Code no balcão ao pedir a conta.";

    let createdId: string | undefined;

    // 4. Persist in Supabase if available
    if (supabaseAdmin) {
      try {
        const payload: Record<string, unknown> = {
          code: uniqueCode,
          benefit_title: benefit.title,
          partner_name: benefit.partnerName,
          discount_label: benefit.discountLabel,
          user_email: effectiveEmail,
          user_name: effectiveName,
          status: "valid",
          qr_payload: qrPayload,
          terms: terms,
          redeemed_at: new Date().toISOString(),
        };

        if (isUuid(benefit.id)) {
          payload.benefit_id = benefit.id;
        }
        if (isUuid(effectiveUserId)) {
          payload.user_id = effectiveUserId;
        }

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("vouchers")
          .insert(payload)
          .select()
          .single();

        if (!insertErr && inserted) {
          createdId = inserted.id;
        } else if (insertErr) {
          console.warn("Supabase voucher insert fallback:", insertErr.message);
        }
      } catch (insertException) {
        console.warn("Supabase voucher insert exception:", errorMessage(insertException));
      }
    }

    // 5. Persist in memory store (synced across server instance)
    const newVoucher = passStore.createVoucher({
      id: createdId,
      code: uniqueCode,
      benefitId: benefit.id,
      benefitTitle: benefit.title,
      partnerId: benefit.partnerId,
      partnerName: benefit.partnerName,
      discountLabel: benefit.discountLabel,
      status: "valid",
      qrPayload,
      redeemedAt: formattedNow,
      terms,
      userId: effectiveUserId,
      userEmail: effectiveEmail,
      userName: effectiveName,
    });

    return NextResponse.json({
      success: true,
      message: "Benefício resgatado com sucesso!",
      voucher: newVoucher,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao resgatar benefício." },
      { status: 500 }
    );
  }
}
