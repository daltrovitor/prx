// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { birthDatesFor } from "@/lib/partners/catalog";
import { PartnerError } from "@/lib/partners/errors";
import { clientIp, errorResponse, readJson } from "@/lib/partners/http";
import { ageBandFromBirthDate } from "@/lib/partners/metrics";
import { recordBenefitEvents } from "@/lib/partners/service";
import { firstIssue } from "@/lib/partners/types";

const id = z.string().min(1).max(64);
const schema = z.object({
  impressions: z.array(id).max(60).default([]),
  click: id.nullable().default(null),
});

/**
 * POST /api/pass/events — exibições e cliques no catálogo para as métricas do
 * parceiro. Grava só benefício, parceiro e faixa etária: nunca quem clicou.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const limit = checkRateLimit(`pass-events:${user?.id || clientIp(req) || "anon"}`, 120, 60);
    if (!limit.allowed) throw new PartnerError("Muitas requisições.", 429);

    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);

    const births = user ? await birthDatesFor([user.id]) : new Map<string, string | null>();
    const recorded = await recordBenefitEvents({
      impressions: parsed.data.impressions,
      click: parsed.data.click,
      ageBand: ageBandFromBirthDate(user ? births.get(user.id) ?? null : null),
    });
    return NextResponse.json({ success: true, recorded }, { status: 202 });
  } catch (error) {
    return errorResponse(error, "Erro ao registrar métricas.");
  }
}
