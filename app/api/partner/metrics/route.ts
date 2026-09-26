// Hello World
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requirePartnerSession } from "@/lib/partners/http";
import { partnerMetrics } from "@/lib/partners/service";

/** GET /api/partner/metrics?days=90 — inteligência agregada; nenhuma identidade de membro. */
export async function GET(req: NextRequest) {
  try {
    const { partner } = await requirePartnerSession(req);
    const days = Math.min(365, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 90));
    return NextResponse.json({ success: true, ...(await partnerMetrics(partner.id, days)) });
  } catch (error) {
    return errorResponse(error, "Erro ao calcular as métricas.");
  }
}
