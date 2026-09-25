// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getOrCreateServerLiveWallet,
  saveServerLiveWallet,
} from "@/lib/prx/server-live-store";
import {
  getOrCreateServerBank,
  saveServerBank,
} from "@/lib/prx/server-bank-store";
import {
  LIVE_EVENTS,
  issueTicket,
  registerForRun,
  submitToFounders,
} from "@/lib/prx/live";
import { debitBalance } from "@/lib/prx/bank";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const wallet = getOrCreateServerLiveWallet(user.id);
  return NextResponse.json({ ok: true, wallet });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;
    let wallet = getOrCreateServerLiveWallet(user.id);

    switch (action) {
      case "issue_ticket": {
        const { eventId, batchId, paymentMethod } = body;
        const event = LIVE_EVENTS.find((e) => e.id === eventId);
        if (!event) {
          return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
        }
        const batch = event.batches.find((b) => b.id === batchId);
        if (!batch) {
          return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
        }

        // Se pagamento for saldo bancário e o preço for > 0, debita no servidor
        if (batch.price > 0 && paymentMethod === "saldo") {
          let bankState = getOrCreateServerBank(user.id, user.walletBalance);
          bankState = debitBalance(bankState, {
            amount: batch.price,
            kind: "ticket",
            counterparty: `PRX UP · ${event.title}`,
            description: `${batch.name}`,
          });
          saveServerBank(user.id, bankState);
        }

        const result = issueTicket(wallet, {
          event,
          batch,
          holderName: user.fullName || "Membro PRX",
          paymentMethod: paymentMethod === "card" ? "card" : "pix",
        });

        wallet = result.wallet;
        saveServerLiveWallet(user.id, wallet);
        return NextResponse.json({ ok: true, wallet, ticket: result.ticket });
      }

      case "register_run": {
        const { stageId, modality, category, shirtSize } = body;
        wallet = registerForRun(wallet, {
          stageId,
          modality,
          category,
          shirtSize,
        });
        saveServerLiveWallet(user.id, wallet);
        return NextResponse.json({ ok: true, wallet });
      }

      case "submit_founders": {
        const { startupName, oneLiner, stage, deckFileName, videoUrl } = body;
        wallet = submitToFounders(wallet, {
          startupName,
          oneLiner,
          stage,
          deckFileName,
          videoUrl,
        });
        saveServerLiveWallet(user.id, wallet);
        return NextResponse.json({ ok: true, wallet });
      }

      default:
        return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = (err as Error)?.message || "Erro ao processar ação no PRX LIVE";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
