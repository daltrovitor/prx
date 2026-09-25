// Hello World
import { getCurrentUser } from "@/lib/auth";
import {
  type BankState,
  type BankTransaction,
  type PixKey,
  type CardData,
  type PhysicalCardRequest,
  type PixCharge,
  seedBankState,
  sendPix,
  registerPixKey,
  removePixKey,
  addCharge,
  simulateChargePaid,
  setCardLocked,
  requestPhysicalCard,
} from "@/lib/prx/bank";

/**
 * Armazenamento do PRX BANK no backend.
 * Toda mutação e estado financeiro é validado e processado no servidor.
 */
const serverBankStates = new Map<string, BankState>();

export function getOrCreateServerBank(userId: string, initialBalance?: number): BankState {
  let state = serverBankStates.get(userId);
  if (!state) {
    state = seedBankState();
    if (typeof initialBalance === "number" && !isNaN(initialBalance)) {
      state.balance = initialBalance;
    }
    serverBankStates.set(userId, state);
  }
  return state;
}

export function saveServerBank(userId: string, state: BankState): void {
  serverBankStates.set(userId, state);
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
