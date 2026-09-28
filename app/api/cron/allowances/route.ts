// Hello World
import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDueAllowances } from "@/lib/family/service";

/**
 * Agendador diário das mesadas (Vercel Cron). Protegido por CRON_SECRET no
 * cabeçalho Authorization: Bearer. Idempotente: cada período é pago uma vez.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const paid = await runDueAllowances();
  return NextResponse.json({ success: true, paid });
}
