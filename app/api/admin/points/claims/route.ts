// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { listClaimsForReview, reviewClaim } from "@/lib/points/service";
import { CLAIM_STATUSES, claimReviewSchema, type ClaimStatus } from "@/lib/points/types";

/** GET /api/admin/points/claims?status=pending|approved|rejected|all — fila de análise de bom comportamento. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const raw = req.nextUrl.searchParams.get("status") ?? "pending";
    const status: ClaimStatus | "all" = raw === "all" || (CLAIM_STATUSES as readonly string[]).includes(raw) ? (raw as ClaimStatus | "all") : "pending";
    return NextResponse.json({ success: true, claims: await listClaimsForReview(status) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar a fila de análise.");
  }
}

/** POST /api/admin/points/claims — aprova (credita coins e XP) ou recusa um envio. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const parsed = claimReviewSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const claim = await reviewClaim(parsed.data.id, parsed.data.decision, parsed.data.note, admin.email || admin.sub);
    return NextResponse.json({ success: true, claim });
  } catch (error) {
    return errorResponse(error, "Erro ao registrar a decisão.");
  }
}
