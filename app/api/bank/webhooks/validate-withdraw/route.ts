// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { webhookAuthToken, webhookTokenMatches } from "@/lib/asaas/config";
import { asaasDeps } from "@/lib/bank/asaas/deps";
import { validateWithdraw, withdrawValidationSchema } from "@/lib/bank/asaas/withdraw-validation";
import { errorMessage } from "@/lib/errors";

/**
 * POST /api/bank/webhooks/validate-withdraw — mecanismo de validação de saque
 * do Asaas. Responde { status: "APPROVED" } só para saídas confirmadas pelo
 * membro no app; o resto recebe { status: "REFUSED", refuseReason }.
 * Autenticado pelo header asaas-access-token (ASAAS_WEBHOOK_AUTH_TOKEN).
 */
// nosemgrep: prx-mutation-route-without-auth — webhook do Asaas autenticado pelo token asaas-access-token, não por sessão
export async function POST(req: NextRequest) {
  const token = webhookAuthToken();
  if (!token) return NextResponse.json({ error: "Webhook do banco parceiro não configurado." }, { status: 503 });
  if (!webhookTokenMatches(req.headers.get("asaas-access-token"), token)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ status: "REFUSED", refuseReason: "Requisição inválida." });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ status: "REFUSED", refuseReason: "Requisição inválida." });
  }
  const parsed = withdrawValidationSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ status: "REFUSED", refuseReason: "Requisição inválida." });

  try {
    const answer = await validateWithdraw(parsed.data, asaasDeps());
    if (answer.status === "REFUSED") console.warn("[asaas] saque recusado:", parsed.data.type, answer.refuseReason);
    return NextResponse.json(answer);
  } catch (error) {
    // 5xx: o Asaas tenta de novo (até 3 vezes) e, sem resposta válida, cancela a saída.
    console.error("[asaas] falha na validação de saque:", errorMessage(error));
    return NextResponse.json({ error: "Falha ao validar." }, { status: 500 });
  }
}
