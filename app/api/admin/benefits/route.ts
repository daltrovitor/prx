import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { passStore } from "@/lib/pass-store";
import { supabaseAdmin } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { BenefitRow } from "@/lib/db-rows";

// Safety alias in case any handler calls verifyAdminAuth
const verifyAdminAuth = (req?: NextRequest) => verifyAdminRequest(req);

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 1. Try Supabase
    if (supabaseAdmin) {
      const { data: dbBenefits, error } = await supabaseAdmin
        .from("benefits")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && dbBenefits) {
        const mapped = dbBenefits.map((b: BenefitRow) => ({
          id: b.id,
          partnerId: b.partner_id || b.id,
          partnerName: b.partner_name,
          partnerLogo: b.partner_logo ?? "",
          partnerBanner: b.partner_banner ?? "",
          partnerLocation: b.partner_location || "São Paulo, SP",
          categoryId: b.category_id,
          title: b.title,
          description: b.description || "",
          discountLabel: b.discount_label,
          minPrxLevel: b.min_nxt_level || 1,
          terms: Array.isArray(b.terms) ? b.terms : [b.terms || "Apresente o QR Code no balcão."],
        }));
        passStore.setBenefits(mapped);
        return NextResponse.json({ success: true, benefits: mapped });
      }
    }

    // 2. Fallback to passStore
    const benefits = passStore.getBenefits();
    return NextResponse.json({ success: true, benefits });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao consultar benefícios." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const {
      partnerName,
      partnerLogo,
      partnerBanner,
      partnerLocation,
      categoryId,
      title,
      description,
      discountLabel,
      minPrxLevel,
      terms,
    } = body;

    if (!partnerName || !title || !discountLabel || !categoryId) {
      return NextResponse.json(
        { error: "Campos obrigatórios: Nome do parceiro, Categoria, Título e Rótulo de desconto." },
        { status: 400 }
      );
    }

    const termsArray = Array.isArray(terms) ? terms : [terms || "Apresente o QR Code no balcão."];

    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { data: inserted, error } = await supabaseAdmin
          .from("benefits")
          .insert({
            partner_name: partnerName.trim(),
            partner_logo: partnerLogo?.trim() || null,
            partner_banner: partnerBanner?.trim() || null,
            partner_location: partnerLocation?.trim() || "São Paulo, SP",
            category_id: categoryId.trim(),
            title: title.trim(),
            description: description?.trim() || "",
            discount_label: discountLabel.trim(),
            min_nxt_level: Number(minPrxLevel) || 1,
            terms: termsArray,
            is_active: true,
          })
          .select()
          .single();

        if (!error && inserted) {
          const benefitObj = {
            id: inserted.id,
            partnerId: inserted.partner_id || inserted.id,
            partnerName: inserted.partner_name,
            partnerLogo: inserted.partner_logo,
            partnerBanner: inserted.partner_banner,
            partnerLocation: inserted.partner_location,
            categoryId: inserted.category_id,
            title: inserted.title,
            description: inserted.description,
            discountLabel: inserted.discount_label,
            minPrxLevel: inserted.min_nxt_level,
            terms: inserted.terms,
          };
          // Also keep memory store synced
          passStore.createBenefit(benefitObj);

          return NextResponse.json({
            success: true,
            message: "Benefício criado no Supabase com sucesso!",
            benefit: benefitObj,
          });
        }
        if (error) {
          console.warn("[Admin Benefits API] Supabase insert failed, falling back to passStore:", errorMessage(error));
        }
      } catch (err) {
        console.warn("[Admin Benefits API] Supabase insert exception, falling back to passStore:", errorMessage(err));
      }
    }

    // 2. Fallback to passStore
    const newBenefit = passStore.createBenefit({
      partnerId: `part-${Date.now().toString(36)}`,
      partnerName: partnerName.trim(),
      partnerLogo: partnerLogo?.trim() || "",
      partnerBanner: partnerBanner?.trim() || "",
      partnerLocation: partnerLocation?.trim() || "São Paulo, SP",
      categoryId: categoryId.trim(),
      title: title.trim(),
      description: description?.trim() || "",
      discountLabel: discountLabel.trim(),
      minPrxLevel: Number(minPrxLevel) || 1,
      terms: termsArray,
    });

    return NextResponse.json({
      success: true,
      message: "Benefício criado com sucesso!",
      benefit: newBenefit,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao criar benefício." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do benefício é obrigatório." }, { status: 400 });
    }

    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.partnerName) dbUpdates.partner_name = updates.partnerName.trim();
        if (updates.partnerLogo !== undefined) dbUpdates.partner_logo = updates.partnerLogo;
        if (updates.partnerBanner !== undefined) dbUpdates.partner_banner = updates.partnerBanner;
        if (updates.partnerLocation) dbUpdates.partner_location = updates.partnerLocation.trim();
        if (updates.categoryId) dbUpdates.category_id = updates.categoryId.trim();
        if (updates.title) dbUpdates.title = updates.title.trim();
        if (updates.description !== undefined) dbUpdates.description = updates.description.trim();
        if (updates.discountLabel) dbUpdates.discount_label = updates.discountLabel.trim();
        if (updates.minPrxLevel !== undefined) dbUpdates.min_nxt_level = Number(updates.minPrxLevel);
        if (updates.terms) dbUpdates.terms = Array.isArray(updates.terms) ? updates.terms : [updates.terms];

        const { data: updated, error } = await supabaseAdmin
          .from("benefits")
          .update(dbUpdates)
          .eq("id", id)
          .select()
          .single();

        if (!error && updated) {
          passStore.updateBenefit(id, updates);
          return NextResponse.json({
            success: true,
            message: "Benefício atualizado no Supabase com sucesso!",
            benefit: updated,
          });
        }
        if (error) {
          console.warn("[Admin Benefits API] Supabase update warning:", errorMessage(error));
        }
      } catch (err) {
        console.warn("[Admin Benefits API] Supabase update exception:", errorMessage(err));
      }
    }

    // 2. Fallback to passStore
    const updated = passStore.updateBenefit(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Benefício não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Benefício atualizado com sucesso!",
      benefit: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao atualizar benefício." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do benefício é obrigatório." }, { status: 400 });
    }

    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.from("benefits").delete().eq("id", id);
        if (!error) {
          passStore.deleteBenefit(id);
          return NextResponse.json({
            success: true,
            message: "Benefício removido do Supabase com sucesso!",
          });
        }
        if (error) {
          console.warn("[Admin Benefits API] Supabase delete warning:", errorMessage(error));
        }
      } catch (err) {
        console.warn("[Admin Benefits API] Supabase delete exception:", errorMessage(err));
      }
    }

    // 2. Fallback to passStore
    const deleted = passStore.deleteBenefit(id);
    if (!deleted) {
      return NextResponse.json({ error: "Benefício não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Benefício removido com sucesso!",
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "Erro ao excluir benefício." },
      { status: 500 }
    );
  }
}
