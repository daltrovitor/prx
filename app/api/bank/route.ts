// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getOrCreateServerBank,
  saveServerBank,
} from "@/lib/prx/server-bank-store";
import {
  sendPix,
  registerPixKey,
  removePixKey,
  addCharge,
  simulateChargePaid,
  setCardLocked,
  requestPhysicalCard,
  BankError,
} from "@/lib/prx/bank";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const state = getOrCreateServerBank(user.id, user.walletBalance);
  return NextResponse.json({ ok: true, state });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;
    let state = getOrCreateServerBank(user.id, user.walletBalance);

    switch (action) {
      case "send_pix": {
        const { key, amount, recipient, description } = body;
        state = sendPix(state, { key, amount, recipient, description });
        break;
      }
      case "add_pix_key": {
        const { type, value } = body;
        state = registerPixKey(state, type, value);
        break;
      }
      case "remove_pix_key": {
        const { id } = body;
        state = removePixKey(state, id);
        break;
      }
      case "create_charge": {
        const { amount, description, payload } = body;
        state = addCharge(state, { amount, description, payload: payload || "" });
        break;
      }
      case "mark_charge_paid": {
        const { id } = body;
        state = simulateChargePaid(state, id);
        break;
      }
      case "toggle_lock": {
        state = setCardLocked(state, !state.virtualCard.locked);
        break;
      }
      case "request_card": {
        const { address } = body;
        state = requestPhysicalCard(state, address);
        break;
      }
      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    saveServerBank(user.id, state);
    return NextResponse.json({ ok: true, state });
  } catch (err: unknown) {
    const message = err instanceof BankError ? err.message : (err as Error)?.message || "Erro ao processar transação bancária";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
