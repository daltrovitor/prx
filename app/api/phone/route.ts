// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { familyErrorResponse, requireUser } from "@/lib/family/http";
import { phoneVerificationState } from "@/lib/phone/service";

/** GET /api/phone — celular confirmado pelo WhatsApp e código pendente (sem o código). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ phone: await phoneVerificationState(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar o celular.");
  }
}
