// Hello World
import { describe, expect, it } from "vitest";
import { cardAddressSchema, pixKeyInputSchema } from "@/lib/bank/service";
import { filterTransactions, summarize, type BankTransaction } from "@/lib/prx/bank";

describe("pré-cadastro de chave Pix", () => {
  it("normaliza CPF, e-mail e celular", () => {
    expect(pixKeyInputSchema.parse({ type: "cpf", value: "529.982.247-25" })).toEqual({ type: "cpf", value: "52998224725" });
    expect(pixKeyInputSchema.parse({ type: "email", value: " Ana@PRX.dev " })).toEqual({ type: "email", value: "ana@prx.dev" });
    expect(pixKeyInputSchema.parse({ type: "phone", value: "(11) 98765-4321" })).toEqual({ type: "phone", value: "+5511987654321" });
    expect(pixKeyInputSchema.parse({ type: "phone", value: "+55 11 98765-4321" })).toEqual({ type: "phone", value: "+5511987654321" });
  });

  it("gera a chave aleatória no servidor, ignorando o que vier do cliente", () => {
    const parsed = pixKeyInputSchema.parse({ type: "random", value: "qualquer-coisa" });
    expect(parsed.value).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("recusa CPF inválido, e-mail malformado e celular curto", () => {
    expect(pixKeyInputSchema.safeParse({ type: "cpf", value: "111.111.111-11" }).success).toBe(false);
    expect(pixKeyInputSchema.safeParse({ type: "email", value: "ana@" }).success).toBe(false);
    expect(pixKeyInputSchema.safeParse({ type: "phone", value: "98765" }).success).toBe(false);
    expect(pixKeyInputSchema.safeParse({ type: "cnpj", value: "11222333000181" }).success).toBe(false);
  });
});

describe("pedido do cartão físico", () => {
  it("exige CEP de 8 dígitos e endereço completo", () => {
    expect(cardAddressSchema.safeParse({ cep: "01310-100", street: "Av. Paulista", number: "1000", city: "São Paulo/SP" }).success).toBe(true);
    expect(cardAddressSchema.safeParse({ cep: "0131", street: "Av. Paulista", number: "1000", city: "São Paulo/SP" }).success).toBe(false);
    expect(cardAddressSchema.safeParse({ cep: "01310100", street: "", number: "1000", city: "São Paulo/SP" }).success).toBe(false);
  });
});

describe("extrato", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  const tx = (id: string, direction: "in" | "out", amount: number, daysAgo: number): BankTransaction => ({
    id,
    kind: direction === "in" ? "pix_in" : "pix_out",
    direction,
    amount,
    counterparty: "",
    description: "",
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
  });

  it("conta nova: extrato vazio soma zero", () => {
    expect(summarize(filterTransactions([], 30, "all", now))).toEqual({ income: 0, outcome: 0 });
  });

  it("filtra por período e direção e soma sem erro de arredondamento", () => {
    const list = [tx("a", "in", 0.1, 1), tx("b", "in", 0.2, 2), tx("c", "out", 10, 40)];
    expect(summarize(filterTransactions(list, 30, "all", now))).toEqual({ income: 0.3, outcome: 0 });
    expect(filterTransactions(list, 90, "out", now).map((t) => t.id)).toEqual(["c"]);
  });
});
