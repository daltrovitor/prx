// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { clientIp, errorResponse, readJson, requirePartnerSession } from "@/lib/partners/http";
import { acceptCampaign, listCampaignsForPartner } from "@/lib/partners/service";
import { firstIssue } from "@/lib/partners/types";

const acceptSchema = z.object({
  campaignId: z.string().min(1),
  version: z.number().int().min(1),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/, "Versão do contrato inválida."),
  declarationAccepted: z.literal(true, { error: "Marque a declaração para aceitar." }),
  password: z.string().min(1, "Confirme sua senha para assinar.").max(200),
});

/** GET /api/partner/campaigns — campanhas enviadas pela PRX, com Resumo Comercial e hash do contrato. */
export async function GET(req: NextRequest) {
  try {
    const { partner } = await requirePartnerSession(req);
    return NextResponse.json({ success: true, campaigns: await listCampaignsForPartner(partner) });
  } catch (error) {
    return errorResponse(error, "Erro ao listar campanhas.");
  }
}

/** POST /api/partner/campaigns — aceite eletrônico com reconfirmação de senha. */
export async function POST(req: NextRequest) {
  try {
    const { user, partner } = await requirePartnerSession(req);
    const limit = checkRateLimit(`partner-accept:${user.sub}`, 5, 300);
    if (!limit.allowed) throw new PartnerError(`Muitas tentativas. Tente de novo em ${limit.resetInSeconds}s.`, 429);

    const parsed = acceptSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);

    const { acceptance, benefit } = await acceptCampaign(partner, {
      ...parsed.data,
      user: { sub: user.sub, email: user.email },
      ipAddress: clientIp(req),
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    });

    return NextResponse.json({
      success: true,
      message: "Parceria aceita. O certificado da campanha já está disponível.",
      certificateId: acceptance.certificateId,
      acceptedAt: acceptance.acceptedAt,
      benefitPublished: Boolean(benefit),
    });
  } catch (error) {
    return errorResponse(error, "Erro ao registrar o aceite.");
  }
}
