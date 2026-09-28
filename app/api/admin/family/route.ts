// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/partners/http";
import { reviewSchema } from "@/lib/family/types";
import { reviewFamilyRequest, reviewQueues } from "@/lib/family/service";
import { body, familyErrorResponse, invalid } from "@/lib/family/http";

const STATUSES = new Set(["pending", "approved", "rejected", "all"]);

/** Fila de análise da equipe: cadastros de Conta Pai e comprovações de emancipação. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const raw = req.nextUrl.searchParams.get("status") || "pending";
    const status = (STATUSES.has(raw) ? raw : "pending") as "pending" | "approved" | "rejected" | "all";
    return NextResponse.json(await reviewQueues(status), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar a fila de famílias.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const parsed = reviewSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    const { kind, id, decision, note } = parsed.data;
    const result = await reviewFamilyRequest(kind, id, decision, note, admin.email || admin.sub);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível registrar a decisão.");
  }
}
