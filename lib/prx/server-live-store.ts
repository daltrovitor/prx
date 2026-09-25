// Hello World
import {
  type LiveWallet,
  type LiveEvent,
  type TicketBatch,
  type Ticket,
  type RunRegistration,
  type FoundersSubmission,
  seedLiveWallet,
  issueTicket as pureIssueTicket,
  registerForRun as pureRegisterForRun,
  submitToFounders as pureSubmitToFounders,
} from "@/lib/prx/live";

/**
 * Armazenamento do PRX LIVE no backend.
 * Ingressos, inscrições da PRX RUN e submissões do PRX FOUNDERS persistem no servidor.
 */
const serverLiveWallets = new Map<string, LiveWallet>();

export function getOrCreateServerLiveWallet(userId: string): LiveWallet {
  let wallet = serverLiveWallets.get(userId);
  if (!wallet) {
    wallet = seedLiveWallet();
    serverLiveWallets.set(userId, wallet);
  }
  return wallet;
}

export function saveServerLiveWallet(userId: string, wallet: LiveWallet): void {
  serverLiveWallets.set(userId, wallet);
}
