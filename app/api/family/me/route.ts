// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { PartnerError } from "@/lib/partners/errors";
import { familyState } from "@/lib/family/service";
import { familyErrorResponse, requireUser } from "@/lib/family/http";

/** Situação da conta na família: tipo, pendências (análise, vínculo) e limites do menor. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    try {
      return NextResponse.json({ state: await familyState(user) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      // Banco sem a migração de família: o app segue sem as telas de família em vez de travar o membro.
      if (error instanceof PartnerError && error.status === 503) return NextResponse.json({ state: null, unavailable: true }, { headers: { "Cache-Control": "no-store" } });
      throw error;
    }
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar os dados da família.");
  }
}
