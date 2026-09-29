// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/partners/http";
import { getWaitlistSignups } from "@/lib/waitlist";

/** GET /api/admin/waitlist — leads da Lista VIP (/em-breve e prx.app.br), só para admin. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const signups = await getWaitlistSignups();
    return NextResponse.json({ success: true, count: signups.length, signups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar a lista de espera.");
  }
}
