// Hello World
import { NextRequest, NextResponse } from "next/server";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson } from "@/lib/partners/http";
import { requireValidator } from "@/lib/validation/actor";
import { validateCode, validationHistory } from "@/lib/validation";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/validate — portaria e balcão (admin, parceiro ou Equipe PRX).
 * body: { code: string, action?: "lookup" | "confirm" }
 * Ingresso (PRX_LIVE::, UP-…, RUN-…) faz check-in; voucher (PRX_PASS::, PRX-…) dá baixa.
 */
export async function POST(req: NextRequest) {
  try {
    const validator = await requireValidator(req);
    const body = (await readJson(req)) as { code?: unknown; action?: unknown };
    const raw = typeof body.code === "string" ? body.code.slice(0, 300) : "";
    if (!raw.trim()) throw new PartnerError("Informe ou escaneie o código.", 400);
    const result = await validateCode(validator, raw, body.action === "confirm" ? "confirm" : "lookup");
    if (!result.ok) return NextResponse.json({ success: false, ...result }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao validar o código.");
  }
}

/** GET /api/validate — últimas validações de quem está logado. */
export async function GET(req: NextRequest) {
  try {
    const validator = await requireValidator(req);
    return NextResponse.json(
      {
        success: true,
        validator: {
          role: validator.role,
          name: validator.name,
          canValidateTickets: validator.role !== "staff" || validator.canValidateTickets,
          canValidateBenefits: validator.role !== "staff" || validator.canValidateBenefits,
        },
        history: await validationHistory(validator, 20),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    return errorResponse(error, "Erro ao consultar o histórico.");
  }
}
