// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import { getLegalChecklist, legalPatchSchema, updateLegalItem } from "@/lib/legal/checklist-store";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/admin/legal — itens do Checklist Jurídico e Regulatório e o progresso. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json({ success: true, ...(await getLegalChecklist()) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar o checklist jurídico.");
  }
}

/** PATCH /api/admin/legal — atualiza status, responsável ou parecer de um item (`{ id, status?, responsible?, notes? }`). */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const rate = checkRateLimit(`admin_legal_${admin.sub}`, 120, 60);
    if (!rate.allowed) throw new PartnerError(`Muitas alterações seguidas. Tente em ${rate.resetInSeconds}s.`, 429);
    const parsed = legalPatchSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(parsed.error.issues[0]?.message || "Dados inválidos.", 422);
    const result = await updateLegalItem(parsed.data, admin.email || admin.sub);
    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Não foi possível salvar o item do checklist.");
  }
}
