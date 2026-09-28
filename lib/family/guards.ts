// Hello World
import { getFamilyRepository } from "@/lib/family/repository";
import { todayInBrasilia } from "@/lib/family/age";
import { DEFAULT_MINOR_LIMITS } from "@/lib/family/types";
import { PartnerError } from "@/lib/partners/errors";
import type { BankTransaction } from "@/lib/prx/bank";

/*
 * Travas que o PRX BANK aplica às contas de família. Módulo separado do
 * serviço de família para o banco importar sem dependência circular.
 */

export const PARENT_NO_MONEY = "A Conta Pai não guarda dinheiro nem rende: ela serve para controle, segurança e mesada dos seus filhos.";

/**
 * Identidade de família, tolerante a banco sem a migração de família aplicada
 * (503): nesse caso o banco segue como antes, sem travas de família.
 */
async function identityOrNull(userId: string) {
  try {
    return await getFamilyRepository().getIdentity(userId);
  } catch (err) {
    if (err instanceof PartnerError && err.status === 503) return null;
    throw err;
  }
}

/** A Conta Pai nunca tem saldo próprio. */
export async function assertCanHoldMoney(userId: string): Promise<void> {
  const identity = await identityOrNull(userId);
  if (identity?.accountType === "parent") throw new PartnerError(PARENT_NO_MONEY, 403);
}

function spentSince(transactions: ReadonlyArray<BankTransaction>, sinceIso: string): number {
  return transactions.filter((t) => t.direction === "out" && t.createdAt >= sinceIso).reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Gasto de menor de idade: conta liberada pelo responsável e dentro dos limites
 * por compra, do dia e do mês (horário de Brasília). 0 = sem gasto permitido.
 */
export async function assertMinorSpend(userId: string, amount: number, transactions: ReadonlyArray<BankTransaction>, now = new Date()): Promise<void> {
  const repo = getFamilyRepository();
  const identity = await identityOrNull(userId);
  if (!identity) return;
  if (identity.accountType === "parent") throw new PartnerError(PARENT_NO_MONEY, 403);
  if (identity.accountType !== "minor") return;
  if (identity.status !== "active") throw new PartnerError("Sua conta ainda não foi liberada pelo responsável. Pix e cartão entram assim que ele aprovar.", 403);
  const limits = (await repo.getLimits(userId)) ?? DEFAULT_MINOR_LIMITS;
  const { y, m, d } = todayInBrasilia(now);
  const dayStart = new Date(Date.UTC(y, m - 1, d, 3)).toISOString();
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 3)).toISOString();
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (amount > limits.perTransaction) throw new PartnerError(`Acima do limite por compra definido pelo seu responsável (${brl(limits.perTransaction)}).`, 403);
  if (spentSince(transactions, dayStart) + amount > limits.daily) throw new PartnerError(`Passa do limite diário definido pelo seu responsável (${brl(limits.daily)}).`, 403);
  if (spentSince(transactions, monthStart) + amount > limits.monthly) throw new PartnerError(`Passa do limite mensal definido pelo seu responsável (${brl(limits.monthly)}).`, 403);
}
