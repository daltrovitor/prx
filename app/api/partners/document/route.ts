// Hello World
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { renderCertificateHtml, renderContractHtml, type DocumentAudience } from "@/lib/partners/document-html";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, requirePartnerSession } from "@/lib/partners/http";
import { contractView } from "@/lib/partners/service";

/**
 * GET /api/partners/document?campaignId=…&kind=contract|certificate
 * Contrato individual ou certificado em HTML imprimível. Acesso: admin ou o
 * parceiro dono da campanha. Rascunhos só aparecem para o admin.
 */
export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaignId");
    const kind = req.nextUrl.searchParams.get("kind") === "certificate" ? "certificate" : "contract";
    if (!campaignId) throw new PartnerError("Informe a campanha.", 400);

    const admin = await verifyAdminRequest(req);
    let audience: DocumentAudience = "admin";
    const view = await (async () => {
      if (admin.authorized) return contractView(campaignId);
      const { partner } = await requirePartnerSession(req);
      audience = "partner";
      const found = await contractView(campaignId);
      if (found.campaign.partnerId !== partner.id || found.campaign.status === "draft") throw new PartnerError("Documento não encontrado.", 404);
      return found;
    })();

    const nonce = crypto.randomBytes(16).toString("base64");
    const html = kind === "certificate" ? renderCertificateHtml(view, nonce) : renderContractHtml(view, audience, nonce);
    if (!html) throw new PartnerError("O certificado é emitido depois do aceite da campanha.", 404);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
      },
    });
  } catch (error) {
    return errorResponse(error, "Erro ao gerar o documento.");
  }
}
