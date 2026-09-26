// Hello World
import { NextRequest, NextResponse } from "next/server";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, requireAdmin } from "@/lib/partners/http";
import { partnerMetrics } from "@/lib/partners/service";

/** GET /api/admin/partners/metrics?partnerId=…&days=90 — mesma visão agregada do parceiro. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const partnerId = req.nextUrl.searchParams.get("partnerId");
    if (!partnerId) throw new PartnerError("Informe o parceiro.", 400);
    const days = Math.min(365, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 90));
    return NextResponse.json({ success: true, ...(await partnerMetrics(partnerId, days)) });
  } catch (error) {
    return errorResponse(error, "Erro ao calcular as métricas.");
  }
}
