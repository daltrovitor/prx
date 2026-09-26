// Hello World
import type { PixKeyType } from "@/lib/prx/pix";

/**
 * Domínio do PRX BANK (tipos e regras puras, seguros para o cliente).
 *
 * A conta de cada membro vive nas tabelas bank_* do Supabase e nasce zerada,
 * em "pending_activation". Saldo, extrato, Pix e cartões só passam a mover
 * dinheiro quando o banco parceiro (BaaS) for conectado: até lá nenhum número
 * é inventado. O que já funciona sem o BaaS: pré-cadastro de chaves Pix e
 * pedido do cartão físico, que são enviados ao banco na ativação.
 * Ver docs/PLANO_BAAS.md.
 */

export const ACCOUNT_STATUSES = ["pending_activation", "active", "blocked"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending_activation: "Em ativação",
  active: "Ativa",
  blocked: "Bloqueada",
};

export type TransactionKind = "pix_in" | "pix_out" | "card" | "cashback" | "ticket";

export interface BankTransaction {
  id: string;
  kind: TransactionKind;
  direction: "in" | "out";
  amount: number;
  counterparty: string;
  description: string;
  createdAt: string;
}

export type PixKeyStatus = "pending_activation" | "active";

export interface PixKey {
  id: string;
  type: PixKeyType;
  value: string;
  status: PixKeyStatus;
  createdAt: string;
}

export const PIX_KEY_STATUS_LABEL: Record<PixKeyStatus, string> = {
  pending_activation: "Registro na ativação",
  active: "Ativa",
};

/** Dados do cartão virtual guardados pela PRX: nunca o número completo nem o CVV (ficam no emissor). */
export interface VirtualCard {
  last4: string;
  expiry: string;
  locked: boolean;
}

export const CARD_REQUEST_STATUSES = ["waiting_activation", "requested", "production", "shipped", "delivered", "cancelled"] as const;
export type CardRequestStatus = (typeof CARD_REQUEST_STATUSES)[number];

export const CARD_REQUEST_STATUS_LABEL: Record<CardRequestStatus, string> = {
  waiting_activation: "Aguardando ativação da conta",
  requested: "Pedido enviado ao emissor",
  production: "Em produção",
  shipped: "A caminho",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export interface CardRequest {
  id: string;
  address: string;
  status: CardRequestStatus;
  trackingCode: string | null;
  createdAt: string;
}

export interface PixCharge {
  id: string;
  amount: number | null;
  description: string;
  payload: string;
  paid: boolean;
  createdAt: string;
}

/** O que o app recebe de /api/bank. */
export interface BankAccountView {
  status: AccountStatus;
  balance: number;
  agency: string | null;
  accountNumber: string | null;
  activatedAt: string | null;
  transactions: BankTransaction[];
  pixKeys: PixKey[];
  virtualCard: VirtualCard | null;
  cardRequest: CardRequest | null;
  charges: PixCharge[];
}

export const MAX_PIX_KEYS = 5;
const DAY = 86_400_000;

export type StatementPeriod = 7 | 30 | 90;
export type StatementFilter = "all" | "in" | "out";

export function filterTransactions(list: BankTransaction[], period: StatementPeriod, filter: StatementFilter, now = Date.now()): BankTransaction[] {
  const since = now - period * DAY;
  return list.filter((tx) => new Date(tx.createdAt).getTime() >= since && (filter === "all" || tx.direction === filter));
}

export function summarize(list: BankTransaction[]): { income: number; outcome: number } {
  const totals = list.reduce(
    (acc, tx) => {
      if (tx.direction === "in") acc.income += tx.amount;
      else acc.outcome += tx.amount;
      return acc;
    },
    { income: 0, outcome: 0 }
  );
  return { income: Math.round(totals.income * 100) / 100, outcome: Math.round(totals.outcome * 100) / 100 };
}

export const TRANSACTION_LABEL: Record<TransactionKind, string> = {
  pix_in: "Pix recebido",
  pix_out: "Pix enviado",
  card: "Cartão",
  cashback: "Cashback",
  ticket: "Ingresso",
};

/** Mensagem única para operações que dependem do banco parceiro. */
export const ACTIVATION_REQUIRED = "Disponível quando sua conta PRX BANK for ativada com o banco parceiro.";
