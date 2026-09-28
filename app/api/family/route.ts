// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { familyOverview } from "@/lib/family/service";
import { familyErrorResponse, requireUser } from "@/lib/family/http";

/** Painel da Conta Pai: situação do cadastro, filhos (saldo, coins, nível, mesada, limites) e pedidos de vínculo. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ overview: await familyOverview(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar a família.");
  }
}
