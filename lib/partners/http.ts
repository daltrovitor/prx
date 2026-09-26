// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest, verifyPartnerRequest, type SessionPayload } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { PartnerError } from "@/lib/partners/errors";
import { requirePartnerForUser } from "@/lib/partners/service";
import type { Partner } from "@/lib/partners/types";

export function errorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof PartnerError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.warn(`[partners] ${fallback}:`, errorMessage(error));
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new PartnerError("Corpo da requisição inválido.", 400);
  }
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload> {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized || !auth.adminUser) throw new PartnerError(auth.error || "Acesso negado.", auth.status === 401 ? 401 : 403);
  return auth.adminUser;
}

export async function requirePartnerSession(req: NextRequest): Promise<{ user: SessionPayload & { email: string }; partner: Partner }> {
  const auth = await verifyPartnerRequest(req);
  if (!auth.authorized || !auth.partnerUser) throw new PartnerError(auth.error || "Acesso negado.", auth.status === 401 ? 401 : 403);
  const user = { ...auth.partnerUser, email: (auth.partnerUser.email || "").toLowerCase() };
  return { user, partner: await requirePartnerForUser(user) };
}

/** IP de origem informado pelo proxy da hospedagem (primeiro da cadeia). */
export function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "";
  return ip ? ip.slice(0, 64) : null;
}
