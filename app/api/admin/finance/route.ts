// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/partners/http";
import { FINANCE_PERIODS, financeOverview, type FinancePeriod } from "@/lib/points/finance";

/** GET /api/admin/finance?period=30|90|365 — receita, custos, lucro, passivo de coins e viabilidade do catálogo. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const requested = Number(req.nextUrl.searchParams.get("period"));
    const period: FinancePeriod = (FINANCE_PERIODS as readonly number[]).includes(requested) ? (requested as FinancePeriod) : 30;
    return NextResponse.json({ success: true, finance: await financeOverview(period) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Erro ao consolidar o financeiro.");
  }
}
