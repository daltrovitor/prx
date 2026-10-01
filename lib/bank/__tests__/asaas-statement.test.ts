// Hello World
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyGeneralApproval, openSubaccount } from "@/lib/bank/asaas/onboarding";
import { providerBalance, providerStatement, statementQuerySchema, toStatementItem } from "@/lib/bank/asaas/statement";
import { bankMessage } from "@/lib/bank/asaas/messages";
import { ASAAS_TEST_ENV, USER_ID, fakeAsaas, testDeps } from "./asaas-fakes";

const CREATED = { id: "acc_st", walletId: "wal_st", apiKey: "$aact_hmlg_st", accountNumber: null };

beforeEach(() => {
  for (const [key, value] of Object.entries(ASAAS_TEST_ENV)) vi.stubEnv(key, value);
});
afterEach(() => vi.unstubAllEnvs());

async function activeAccount(routes: Parameters<typeof fakeAsaas>[0]) {
  const fake = fakeAsaas({ "POST /accounts": { body: CREATED }, ...routes });
  const ctx = testDeps(fake.client);
  await openSubaccount(USER_ID, ctx.deps);
  await applyGeneralApproval((await ctx.store.getSubaccount(USER_ID))!, "APPROVED", null, ctx.deps);
  return { ...ctx, calls: fake.calls };
}

describe("saldo e extrato do banco parceiro", () => {
  it("saldo vem do Asaas com a chave da subconta e fica em cache", async () => {
    const { deps, mirror, calls } = await activeAccount({ "GET /finance/balance": { body: { balance: 321.45 } } });
    await expect(providerBalance(USER_ID, deps)).resolves.toBe(321.45);
    expect(calls.find((c) => c.path === "/finance/balance")?.apiKey).toBe(CREATED.apiKey);
    expect(mirror.accounts.get(USER_ID)?.balance).toBe(321.45);
  });

  it("extrato paginado, mais recente primeiro, com rótulos legíveis", async () => {
    const page = {
      hasMore: true,
      totalCount: 3,
      data: [
        { id: "ft_1", value: -10, balance: 90, type: "PIX_TRANSACTION_DEBIT", date: "2026-10-01", description: "Pix para Ana" },
        { id: "ft_2", value: 100, balance: 100, type: "PIX_TRANSACTION_CREDIT", date: "2026-09-30", description: null },
      ],
    };
    const { deps, calls } = await activeAccount({ "GET /financialTransactions": { body: page } });
    const result = await providerStatement(USER_ID, statementQuerySchema.parse({ offset: "0", limit: "2" }), deps);
    expect(result).toMatchObject({ hasMore: true, totalCount: 3, nextOffset: 2 });
    expect(result.items).toEqual([
      { id: "ft_1", direction: "out", amount: 10, balance: 90, label: "Pix enviado", description: "Pix para Ana", date: "2026-10-01" },
      { id: "ft_2", direction: "in", amount: 100, balance: 100, label: "Pix recebido", description: "", date: "2026-09-30" },
    ]);
    expect(calls.find((c) => c.path === "/financialTransactions")?.query).toBe("?offset=0&limit=2&order=desc");
  });

  it("tipo desconhecido usa a descrição do Asaas", () => {
    expect(toStatementItem({ id: "x", value: -1.5, balance: null, type: "NOVO_TIPO", date: "2026-10-01", description: "Tarifa nova", paymentId: null, transferId: null }).label).toBe("Tarifa nova");
  });

  it("valida a consulta do extrato", () => {
    expect(statementQuerySchema.parse({})).toEqual({ offset: 0, limit: 30 });
    expect(statementQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(statementQuerySchema.safeParse({ startDate: "01/10/2026" }).success).toBe(false);
    expect(statementQuerySchema.safeParse({ startDate: "2026-10-02", finishDate: "2026-10-01" }).success).toBe(false);
  });

  it("conta em análise não consulta saldo nem extrato", async () => {
    const fake = fakeAsaas({ "POST /accounts": { body: CREATED } });
    const { deps } = testDeps(fake.client);
    await openSubaccount(USER_ID, deps);
    await expect(providerBalance(USER_ID, deps)).rejects.toMatchObject({ status: 409 });
    expect(fake.calls.some((c) => c.path === "/finance/balance")).toBe(false);
  });
});

describe("textos dos avisos", () => {
  const full = (m: { title: string; body: string }) => `${m.title} ${m.body}`.replace(/ /g, " ");

  it("seguem as mensagens combinadas para cada evento", () => {
    expect(full(bankMessage("pix_received", { amount: 10, counterparty: "Bruno" }))).toBe("Pix recebido! R$ 10,00 de Bruno. O valor já está no seu saldo.");
    expect(full(bankMessage("pix_sent", { amount: 25.5, counterparty: "Ana" }))).toMatch(/^Pix enviado com sucesso! R\$ 25,50 para Ana\./);
    expect(full(bankMessage("transfer_failed", { amount: 15 }))).toBe("Falha na transferência de R$ 15,00. O valor foi estornado ao seu saldo.");
    expect(full(bankMessage("bill_paid", { amount: 80 }))).toBe("Boleto pago com sucesso! Pagamento de R$ 80,00 compensado.");
    expect(full(bankMessage("bill_failed"))).toBe("Falha no pagamento de conta. O saldo foi liberado.");
    expect(full(bankMessage("account_approved"))).toBe("Sua conta bancária foi aprovada! 🎉 Você já pode enviar e receber Pix.");
    expect(full(bankMessage("account_rejected"))).toBe("Atenção aos seus documentos Refaça o envio para ativar sua conta.");
  });
});
