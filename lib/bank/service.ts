// Hello World
import crypto from "crypto";
import { z } from "zod";
import { PartnerError } from "@/lib/partners/errors";
import { getBankRepository } from "@/lib/bank/repository";
import { ACTIVATION_REQUIRED, MAX_PIX_KEYS, type BankAccountView, type CardRequest, type PixKey } from "@/lib/prx/bank";
import { isValidCpf } from "@/lib/prx/pix";

/**
 * Regras do PRX BANK antes da ativação do banco parceiro: a conta existe,
 * zerada; chaves Pix e o cartão físico ficam pré-cadastrados para seguir ao
 * banco na ativação. Operações que movem dinheiro respondem 409.
 */

/** Conta marcada como ativa sem a integração do BaaS publicada nesta versão. */
const BAAS_PENDING = "A integração com o banco parceiro ainda não foi publicada nesta versão do app.";

export async function accountView(userId: string): Promise<BankAccountView> {
  const repo = getBankRepository(userId);
  const account = await repo.getOrCreateAccount(userId);
  const [transactions, pixKeys, cardRequest, charges] = await Promise.all([
    repo.listTransactions(userId, 200),
    repo.listPixKeys(userId),
    repo.getOpenCardRequest(userId),
    repo.listCharges(userId, 20),
  ]);
  return {
    status: account.status,
    balance: account.balance,
    agency: account.agency,
    accountNumber: account.accountNumber,
    activatedAt: account.activatedAt,
    transactions,
    pixKeys,
    virtualCard: account.virtualCard,
    cardRequest,
    charges,
  };
}

export const pixKeyInputSchema = z
  .object({
    type: z.enum(["cpf", "email", "phone", "random"]),
    value: z.string().trim().max(120).default(""),
  })
  .transform((input, ctx) => {
    const digits = input.value.replace(/\D/g, "");
    switch (input.type) {
      case "random":
        return { type: input.type, value: crypto.randomUUID() };
      case "cpf":
        if (!isValidCpf(digits)) {
          ctx.addIssue({ code: "custom", message: "CPF inválido." });
          return z.NEVER;
        }
        return { type: input.type, value: digits };
      case "email": {
        const email = input.value.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 77) {
          ctx.addIssue({ code: "custom", message: "E-mail inválido." });
          return z.NEVER;
        }
        return { type: input.type, value: email };
      }
      case "phone": {
        const local = digits.replace(/^55(?=\d{10,11}$)/, "");
        if (local.length < 10 || local.length > 11) {
          ctx.addIssue({ code: "custom", message: "Celular inválido. Use DDD + número." });
          return z.NEVER;
        }
        return { type: input.type, value: `+55${local}` };
      }
    }
  });

export async function addPixKey(userId: string, input: z.output<typeof pixKeyInputSchema>): Promise<PixKey> {
  const repo = getBankRepository(userId);
  const account = await repo.getOrCreateAccount(userId);
  if (account.status === "blocked") throw new PartnerError("Conta bloqueada. Fale com o suporte PRX.", 403);
  const keys = await repo.listPixKeys(userId);
  if (keys.length >= MAX_PIX_KEYS) throw new PartnerError(`Limite de ${MAX_PIX_KEYS} chaves Pix por conta.`, 409);
  if (keys.some((k) => k.value === input.value)) throw new PartnerError("Esta chave já está cadastrada.", 409);
  // Sem o banco parceiro não há registro no DICT: a chave fica reservada para a ativação.
  if (account.status !== "active") return repo.insertPixKey(userId, { ...input, status: "pending_activation" });
  throw new PartnerError(BAAS_PENDING, 503);
}

export async function removePixKey(userId: string, keyId: string): Promise<void> {
  const removed = await getBankRepository(userId).deletePixKey(userId, keyId);
  if (!removed) throw new PartnerError("Chave não encontrada.", 404);
}

export const cardAddressSchema = z.object({
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP precisa de 8 dígitos."),
  street: z.string().trim().min(3, "Informe o endereço.").max(120),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(60).default(""),
  city: z.string().trim().min(2, "Informe a cidade e UF.").max(80),
});

export async function requestPhysicalCard(userId: string, address: z.output<typeof cardAddressSchema>): Promise<CardRequest> {
  const repo = getBankRepository(userId);
  const account = await repo.getOrCreateAccount(userId);
  if (account.status === "blocked") throw new PartnerError("Conta bloqueada. Fale com o suporte PRX.", 403);
  if (await repo.getOpenCardRequest(userId)) throw new PartnerError("Você já pediu o cartão físico.", 409);
  const full = `${address.street}, ${address.number}${address.complement ? ` — ${address.complement}` : ""} · ${address.city} · CEP ${address.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}`;
  return repo.insertCardRequest(userId, full);
}

export async function cancelPhysicalCard(userId: string, requestId: string): Promise<void> {
  const cancelled = await getBankRepository(userId).cancelCardRequest(userId, requestId);
  if (!cancelled) throw new PartnerError("Só pedidos que ainda aguardam a ativação podem ser cancelados.", 409);
}

/** Pix, cobrança e bloqueio de cartão dependem do banco parceiro. */
export async function assertBankOperational(userId: string): Promise<never> {
  const account = await getBankRepository(userId).getOrCreateAccount(userId);
  if (account.status === "blocked") throw new PartnerError("Conta bloqueada. Fale com o suporte PRX.", 403);
  if (account.status === "pending_activation") throw new PartnerError(ACTIVATION_REQUIRED, 409);
  throw new PartnerError(BAAS_PENDING, 503);
}
