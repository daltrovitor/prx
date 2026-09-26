// Hello World
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/partners/http";
import { listDoorEvents } from "@/lib/live/service";
import { requirePartnerValidator } from "@/lib/validation/actor";

/** GET /api/partner/events — eventos do PRX LIVE ligados a este parceiro (portaria). */
export async function GET(req: NextRequest) {
  try {
    const { partner } = await requirePartnerValidator(req);
    const events = await listDoorEvents({ partnerId: partner.id, fullNames: false });
    return NextResponse.json({ success: true, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar os eventos.");
  }
}
