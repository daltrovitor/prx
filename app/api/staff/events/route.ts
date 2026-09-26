// Hello World
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/partners/http";
import { listDoorEvents } from "@/lib/live/service";
import { requireStaffValidator } from "@/lib/validation/actor";

/** GET /api/staff/events — eventos que a equipe pode operar na portaria. */
export async function GET(req: NextRequest) {
  try {
    const validator = await requireStaffValidator(req);
    if (validator.role === "staff" && !validator.canValidateTickets) return NextResponse.json({ success: true, events: [] });
    const events = await listDoorEvents({ staffOnly: validator.role === "staff", fullNames: true });
    return NextResponse.json({ success: true, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar os eventos.");
  }
}
