// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { webhookAuthToken, webhookTokenMatches } from "@/lib/asaas/config";
import { asaasDeps } from "@/lib/bank/asaas/deps";
import { asaasEventSchema, handleAsaasEvent } from "@/lib/bank/asaas/webhooks";
import { errorMessage } from "@/lib/errors";

const MAX_BODY = 200_000;

/**
 * POST /api/bank/webhooks/asaas — eventos financeiros e cadastrais das subcontas.
 * Autenticado pelo header asaas-access-token (ASAAS_WEBHOOK_AUTH_TOKEN).
 * Evento repetido responde 200 sem reprocessar; falha interna responde 500
 * para o Asaas tentar de novo.
 */
// nosemgrep: prx-mutation-route-without-auth — webhook do Asaas autenticado pelo token asaas-access-token, não por sessão
export async function POST(req: NextRequest) {
  const token = webhookAuthToken();
  if (!token) return NextResponse.json({ error: "Webhook do banco parceiro não configurado." }, { status: 503 });
  if (!webhookTokenMatches(req.headers.get("asaas-access-token"), token)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Corpo grande demais." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  const parsed = asaasEventSchema.safeParse(json);
  if (!parsed.success) {
    // Autenticado mas fora do formato: registra e não trava a fila do Asaas.
    console.error("[asaas] evento fora do formato:", parsed.error.issues[0]?.path.join("."), parsed.error.issues[0]?.message);
    return NextResponse.json({ received: false, ignored: true });
  }

  try {
    const outcome = await handleAsaasEvent(parsed.data, asaasDeps());
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("[asaas] falha ao processar", parsed.data.event, parsed.data.id, errorMessage(error));
    return NextResponse.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }
}
