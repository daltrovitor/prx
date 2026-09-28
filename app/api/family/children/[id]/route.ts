// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { childDetail } from "@/lib/family/service";
import { familyErrorResponse, requireUser } from "@/lib/family/http";

/** Tudo do filho para o responsável: saldo, extrato, benefícios, nível, XP, coins, eventos, ingressos e projetos. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parent = await requireUser(req);
    const { id } = await params;
    return NextResponse.json({ child: await childDetail(parent, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar os dados do filho.");
  }
}
