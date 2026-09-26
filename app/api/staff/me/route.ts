// Hello World
import { NextRequest, NextResponse } from "next/server";
import { verifyStaffRequest } from "@/lib/auth";
import { PartnerError } from "@/lib/partners/errors";
import { requireStaffActor } from "@/lib/staff/service";

/** GET /api/staff/me — sessão do portal da equipe. Sempre 200, com o motivo quando não há acesso. */
export async function GET(req: NextRequest) {
  const auth = await verifyStaffRequest(req);
  if (!auth.authorized || !auth.staffUser) {
    return NextResponse.json({ authenticated: auth.status !== 401, isStaff: false, error: auth.error }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const actor = await requireStaffActor(auth.staffUser);
    return NextResponse.json({ authenticated: true, isStaff: true, user: actor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof PartnerError ? error.message : "Acesso negado.";
    return NextResponse.json({ authenticated: true, isStaff: false, error: message }, { headers: { "Cache-Control": "no-store" } });
  }
}
