// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { getRulesRepository } from "@/lib/points/repository";
import { pointRuleInputSchema } from "@/lib/points/types";

/** Regras de pontos e XP por bom comportamento (admin). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json({ success: true, rules: await getRulesRepository().listRules() });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar as regras de pontos.");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const parsed = pointRuleInputSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    return NextResponse.json({ success: true, rule: await getRulesRepository().insertRule(parsed.data) });
  } catch (error) {
    return errorResponse(error, "Erro ao criar a regra.");
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await readJson(req);
    const id = z.object({ id: z.string().min(1).max(100) }).safeParse(body);
    if (!id.success) throw new PartnerError("Informe a regra.", 400);
    const parsed = pointRuleInputSchema.safeParse(body);
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const rule = await getRulesRepository().updateRule(id.data.id, parsed.data);
    if (!rule) throw new PartnerError("Regra não encontrada.", 404);
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    return errorResponse(error, "Erro ao atualizar a regra.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new PartnerError("Informe a regra.", 400);
    if (!(await getRulesRepository().deleteRule(id))) throw new PartnerError("Regra não encontrada.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Erro ao excluir a regra.");
  }
}
