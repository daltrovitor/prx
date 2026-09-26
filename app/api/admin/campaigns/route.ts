// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import {
  cancelCampaign,
  contractView,
  createCampaign,
  listCampaignsWithAcceptance,
  listRevisions,
  publishAcceptedCampaign,
  sendCampaign,
  updateCampaign,
} from "@/lib/partners/service";
import { commercialSummarySchema, firstIssue } from "@/lib/partners/types";

const createSchema = z.object({ partnerId: z.string().min(1), summary: commercialSummarySchema, send: z.boolean().default(false) });
const updateSchema = z.object({ id: z.string().min(1), summary: commercialSummarySchema });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ id: z.string().min(1), action: z.literal("send") }),
  z.object({ id: z.string().min(1), action: z.literal("publish") }),
  z.object({ id: z.string().min(1), action: z.literal("cancel"), reason: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(400) }),
]);

/**
 * GET /api/admin/campaigns?partnerId=… — campanhas do parceiro com aceite.
 * GET /api/admin/campaigns?id=…        — detalhe com contrato, hash e revisões.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const [view, revisions] = await Promise.all([contractView(id), listRevisions(id)]);
      return NextResponse.json({
        success: true,
        campaign: view.campaign,
        acceptance: view.acceptance,
        contractHash: view.hash,
        verified: view.verified,
        missing: view.missing,
        revisions: revisions.map((r) => ({ version: r.version, changedBy: r.changedBy, changedAt: r.changedAt })),
      });
    }
    const partnerId = req.nextUrl.searchParams.get("partnerId") || undefined;
    return NextResponse.json({ success: true, campaigns: await listCampaignsWithAcceptance(partnerId) });
  } catch (error) {
    return errorResponse(error, "Erro ao consultar campanhas.");
  }
}

/** POST /api/admin/campaigns — cria o Resumo Comercial (rascunho) e, se pedido, já envia para aceite. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const created = await createCampaign(parsed.data.partnerId, parsed.data.summary, admin.email);
    const campaign = parsed.data.send ? await sendCampaign(created.id) : created;
    return NextResponse.json({
      success: true,
      message: parsed.data.send ? "Contrato gerado e enviado para aceite do parceiro." : "Rascunho do contrato gerado.",
      campaign,
    });
  } catch (error) {
    return errorResponse(error, "Erro ao gerar o contrato.");
  }
}

/** PUT /api/admin/campaigns — edita o Resumo Comercial (nova versão). */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const parsed = updateSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const campaign = await updateCampaign(parsed.data.id, parsed.data.summary, admin.email);
    return NextResponse.json({ success: true, message: `Resumo Comercial atualizado (versão ${campaign.version}).`, campaign });
  } catch (error) {
    return errorResponse(error, "Erro ao atualizar a campanha.");
  }
}

/** PATCH /api/admin/campaigns — enviar para aceite, cancelar ou republicar o benefício. */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const parsed = actionSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const input = parsed.data;
    if (input.action === "send") {
      return NextResponse.json({ success: true, message: "Enviado para aceite do parceiro.", campaign: await sendCampaign(input.id) });
    }
    if (input.action === "cancel") {
      return NextResponse.json({ success: true, message: "Campanha cancelada.", campaign: await cancelCampaign(input.id, input.reason) });
    }
    return NextResponse.json({ success: true, message: "Benefício publicado no catálogo.", benefit: await publishAcceptedCampaign(input.id) });
  } catch (error) {
    return errorResponse(error, "Erro ao atualizar a campanha.");
  }
}
