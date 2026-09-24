// Hello World
import type { PixKeyType } from "@/lib/prx/pix";

/**
 * Domínio do PRX BANK.
 *
 * Toda a UI conversa com estas funções puras sobre um BankState. Hoje o estado
 * vive no aparelho (modo demonstração, `BANK_MODE = "sandbox"`); na integração
 * com o parceiro BaaS cada operação passa a ser uma chamada à API do provedor
 * via rotas /api/bank/* — a assinatura das funções é o contrato a manter.
 * Ver docs/PLANO_BAAS.md.
 */
export const BANK_MODE: "sandbox" | "live" = "sandbox";

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

export interface PixKey {
  id: string;
  type: PixKeyType;
  value: string;
  createdAt: string;
}

export interface CardData {
  last4: string;
  number: string;
  expiry: string;
  cvv: string;
  locked: boolean;
}

export type PhysicalCardStage = "requested" | "production" | "shipped" | "delivered";

export interface PhysicalCardRequest {
  requestedAt: string;
  address: string;
  trackingCode: string;
}

export interface PixCharge {
  id: string;
  amount?: number;
  description?: string;
  payload: string;
  createdAt: string;
  paid: boolean;
}

export interface BankState {
  version: 1;
  balance: number;
  transactions: BankTransaction[];
  pixKeys: PixKey[];
  virtualCard: CardData;
  physicalCard: PhysicalCardRequest | null;
  charges: PixCharge[];
}

export class BankError extends Error {}

const DAY = 86_400_000;

function uid(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}_${random.replace(/-/g, "").slice(0, 12)}`;
}

function luhnComplete(partial: string): string {
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return partial + ((10 - (sum % 10)) % 10).toString();
}

function createCard(): CardData {
  let partial = "552289";
  while (partial.length < 15) partial += Math.floor(Math.random() * 10).toString();
  const number = luhnComplete(partial);
  const now = new Date();
  const expiry = `${String(now.getMonth() + 1).padStart(2, "0")}/${String((now.getFullYear() + 5) % 100).padStart(2, "0")}`;
  return {
    last4: number.slice(-4),
    number,
    expiry,
    cvv: String(Math.floor(100 + Math.random() * 900)),
    locked: false,
  };
}

/** Estado inicial da conta de demonstração, com um histórico curto e plausível. */
export function seedBankState(): BankState {
  const now = Date.now();
  const at = (daysAgo: number, hours = 0) => new Date(now - daysAgo * DAY - hours * 3_600_000).toISOString();
  const transactions: BankTransaction[] = [
    { id: uid("tx"), kind: "pix_in", direction: "in", amount: 350, counterparty: "Mesada — Pix recebido", description: "Transferência recebida", createdAt: at(0, 3) },
    { id: uid("tx"), kind: "card", direction: "out", amount: 32.9, counterparty: "Café Vértice", description: "Compra no cartão virtual", createdAt: at(1, 5) },
    { id: uid("tx"), kind: "cashback", direction: "in", amount: 4.1, counterparty: "PRX PASS", description: "Cashback de benefício", createdAt: at(2, 1) },
    { id: uid("tx"), kind: "pix_out", direction: "out", amount: 60, counterparty: "Lucas M.", description: "Rateio da pizza", createdAt: at(4, 2) },
    { id: uid("tx"), kind: "card", direction: "out", amount: 89.9, counterparty: "Loja Norte Sneakers", description: "Compra no cartão virtual", createdAt: at(9, 6) },
    { id: uid("tx"), kind: "pix_in", direction: "in", amount: 1000, counterparty: "Estágio — Pix recebido", description: "Bolsa estágio", createdAt: at(12) },
    { id: uid("tx"), kind: "pix_out", direction: "out", amount: 120, counterparty: "Academia Forma", description: "Mensalidade", createdAt: at(20, 4) },
    { id: uid("tx"), kind: "card", direction: "out", amount: 45.5, counterparty: "Livraria Página", description: "Compra no cartão virtual", createdAt: at(33, 2) },
  ];
  const balance = transactions.reduce((sum, tx) => sum + (tx.direction === "in" ? tx.amount : -tx.amount), 181.3);
  return {
    version: 1,
    balance: Math.round(balance * 100) / 100,
    transactions,
    pixKeys: [],
    virtualCard: createCard(),
    physicalCard: null,
    charges: [],
  };
}

export function sendPix(state: BankState, input: { key: string; amount: number; recipient: string; description?: string }): BankState {
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) throw new BankError("Informe um valor maior que zero.");
  if (amount > state.balance) throw new BankError("Saldo insuficiente para esta transferência.");
  const tx: BankTransaction = {
    id: uid("tx"),
    kind: "pix_out",
    direction: "out",
    amount,
    counterparty: input.recipient || input.key,
    description: input.description?.trim() || "Pix enviado",
    createdAt: new Date().toISOString(),
  };
  return { ...state, balance: Math.round((state.balance - amount) * 100) / 100, transactions: [tx, ...state.transactions] };
}

export function addCharge(state: BankState, charge: Omit<PixCharge, "id" | "createdAt" | "paid">): BankState {
  const next: PixCharge = { ...charge, id: uid("chg"), createdAt: new Date().toISOString(), paid: false };
  return { ...state, charges: [next, ...state.charges] };
}

/** Só existe no modo demonstração: confirma uma cobrança como se o pagador tivesse pago. */
export function simulateChargePaid(state: BankState, chargeId: string, payer = "Pagador de teste"): BankState {
  const charge = state.charges.find((c) => c.id === chargeId);
  if (!charge || charge.paid) return state;
  const amount = charge.amount ?? 25;
  const tx: BankTransaction = {
    id: uid("tx"),
    kind: "pix_in",
    direction: "in",
    amount,
    counterparty: payer,
    description: charge.description || "Cobrança Pix recebida",
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    balance: Math.round((state.balance + amount) * 100) / 100,
    transactions: [tx, ...state.transactions],
    charges: state.charges.map((c) => (c.id === chargeId ? { ...c, paid: true } : c)),
  };
}

export function registerPixKey(state: BankState, type: PixKeyType, value: string): BankState {
  if (state.pixKeys.length >= 5) throw new BankError("Limite de 5 chaves Pix por conta.");
  const normalized = value.trim();
  if (state.pixKeys.some((k) => k.value === normalized)) throw new BankError("Esta chave já está cadastrada.");
  const key: PixKey = { id: uid("key"), type, value: normalized, createdAt: new Date().toISOString() };
  return { ...state, pixKeys: [...state.pixKeys, key] };
}

export function createRandomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
}

export function removePixKey(state: BankState, keyId: string): BankState {
  return { ...state, pixKeys: state.pixKeys.filter((k) => k.id !== keyId) };
}

export function setCardLocked(state: BankState, locked: boolean): BankState {
  return { ...state, virtualCard: { ...state.virtualCard, locked } };
}

export function requestPhysicalCard(state: BankState, address: string): BankState {
  if (state.physicalCard) throw new BankError("Você já solicitou o cartão físico.");
  const trackingCode = `PRX${Math.floor(100000000 + Math.random() * 900000000)}BR`;
  return { ...state, physicalCard: { requestedAt: new Date().toISOString(), address, trackingCode } };
}

/** Etapas de entrega com prazos de referência (1, 3 e 6 dias úteis). */
export const PHYSICAL_CARD_STAGES: ReadonlyArray<{ stage: PhysicalCardStage; label: string; afterDays: number }> = [
  { stage: "requested", label: "Pedido recebido", afterDays: 0 },
  { stage: "production", label: "Em produção", afterDays: 1 },
  { stage: "shipped", label: "A caminho", afterDays: 3 },
  { stage: "delivered", label: "Entregue", afterDays: 6 },
];

export function physicalCardStageIndex(request: PhysicalCardRequest, now = Date.now()): number {
  const elapsedDays = (now - new Date(request.requestedAt).getTime()) / DAY;
  let index = 0;
  PHYSICAL_CARD_STAGES.forEach((s, i) => {
    if (elapsedDays >= s.afterDays) index = i;
  });
  return index;
}

export type StatementPeriod = 7 | 30 | 90;
export type StatementFilter = "all" | "in" | "out";

export function filterTransactions(list: BankTransaction[], period: StatementPeriod, filter: StatementFilter, now = Date.now()): BankTransaction[] {
  const since = now - period * DAY;
  return list.filter((tx) => new Date(tx.createdAt).getTime() >= since && (filter === "all" || tx.direction === filter));
}

export function summarize(list: BankTransaction[]): { income: number; outcome: number } {
  return list.reduce(
    (acc, tx) => {
      if (tx.direction === "in") acc.income += tx.amount;
      else acc.outcome += tx.amount;
      return acc;
    },
    { income: 0, outcome: 0 }
  );
}

export const TRANSACTION_LABEL: Record<TransactionKind, string> = {
  pix_in: "Pix recebido",
  pix_out: "Pix enviado",
  card: "Cartão",
  cashback: "Cashback",
  ticket: "Ingresso",
};

/** Débito genérico do saldo, usado quando outro módulo (ex.: PRX UP) cobra na conta PRX BANK. */
export function debitBalance(
  state: BankState,
  input: { amount: number; kind: TransactionKind; counterparty: string; description: string }
): BankState {
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) return state;
  if (amount > state.balance) throw new BankError("Saldo PRX BANK insuficiente.");
  const tx: BankTransaction = {
    id: uid("tx"),
    kind: input.kind,
    direction: "out",
    amount,
    counterparty: input.counterparty,
    description: input.description,
    createdAt: new Date().toISOString(),
  };
  return { ...state, balance: Math.round((state.balance - amount) * 100) / 100, transactions: [tx, ...state.transactions] };
}
