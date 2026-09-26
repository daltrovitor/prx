// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import {
  accountView,
  addPixKey,
  assertBankOperational,
  cancelPhysicalCard,
  cardAddressSchema,
  pixKeyInputSchema,
  removePixKey,
  requestPhysicalCard,
} from "@/lib/bank/service";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/bank — conta do membro (nasce zerada e em ativação). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    return NextResponse.json({ success: true, account: await accountView(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar a conta.");
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_pix_key"), key: z.unknown() }),
  z.object({ action: z.literal("remove_pix_key"), id: z.string().min(1).max(100) }),
  z.object({ action: z.literal("request_card"), address: z.unknown() }),
  z.object({ action: z.literal("cancel_card_request"), id: z.string().min(1).max(100) }),
  z.object({ action: z.enum(["send_pix", "create_charge", "toggle_lock"]) }).loose(),
]);

/**
 * POST /api/bank
 *   add_pix_key / remove_pix_key          pré-cadastro de chaves (registradas no banco na ativação)
 *   request_card / cancel_card_request    pedido do cartão físico (enviado ao emissor na ativação)
 *   send_pix / create_charge / toggle_lock dependem do banco parceiro: 409 até a ativação
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) throw new PartnerError("Não autenticado.", 401);
    const limit = checkRateLimit(`bank:${user.id}`, 30, 60);
    if (!limit.allowed) throw new PartnerError(`Muitas tentativas. Aguarde ${limit.resetInSeconds}s.`, 429);

    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const body = parsed.data;

    switch (body.action) {
      case "add_pix_key": {
        const key = pixKeyInputSchema.safeParse(body.key);
        if (!key.success) throw new PartnerError(firstIssue(key.error), 422);
        await addPixKey(user.id, key.data);
        break;
      }
      case "remove_pix_key":
        await removePixKey(user.id, body.id);
        break;
      case "request_card": {
        const address = cardAddressSchema.safeParse(body.address);
        if (!address.success) throw new PartnerError(firstIssue(address.error), 422);
        await requestPhysicalCard(user.id, address.data);
        break;
      }
      case "cancel_card_request":
        await cancelPhysicalCard(user.id, body.id);
        break;
      default:
        await assertBankOperational(user.id);
    }
    return NextResponse.json({ success: true, account: await accountView(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Erro ao processar a operação.");
  }
}
