import { describe, expect, it } from "vitest";
import { formatDocument, inferDocumentType, isValidCnpj, isValidCpf } from "@/lib/partners/documents";
import { PRX_OPERATOR } from "@/lib/partners/contract";
import { deriveOfferLabel, effectivePrice, mediaBillingText, planRank, referenceMediaPrice } from "@/lib/partners/plans";

describe("CPF e CNPJ", () => {
  it("aceita documentos com dígitos verificadores corretos, com ou sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("o CNPJ da operadora no Termo é válido", () => {
    expect(isValidCnpj(PRX_OPERATOR.document)).toBe(true);
    expect(formatDocument("CNPJ", PRX_OPERATOR.document)).toBe("68.025.417/0001-42");
  });

  it("rejeita dígito errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("infere o tipo pelo número de dígitos e formata", () => {
    expect(inferDocumentType("529.982.247-25")).toBe("CPF");
    expect(inferDocumentType("11.222.333/0001-81")).toBe("CNPJ");
    expect(inferDocumentType("123")).toBeNull();
    expect(formatDocument("CPF", "52998224725")).toBe("529.982.247-25");
  });
});

describe("planos e oferta", () => {
  it("gera o rótulo curto do card", () => {
    expect(deriveOfferLabel({ offerKind: "percentual", prxPrice: null, discountPercent: 25 })).toBe("25% OFF");
    expect(deriveOfferLabel({ offerKind: "preco", prxPrice: 0, discountPercent: null })).toBe("Grátis");
    expect(deriveOfferLabel({ offerKind: "preco", prxPrice: 19.9, discountPercent: null })).toMatch(/R\$\s?19,90/);
    expect(deriveOfferLabel({ offerKind: "brinde", prxPrice: null, discountPercent: null })).toBe("Brinde");
  });

  it("calcula o preço efetivo para estimar vendas", () => {
    expect(effectivePrice({ offerKind: "preco", normalPrice: 30, prxPrice: 19.9, discountPercent: null })).toBe(19.9);
    expect(effectivePrice({ offerKind: "percentual", normalPrice: 80, prxPrice: null, discountPercent: 25 })).toBe(60);
    expect(effectivePrice({ offerKind: "percentual", normalPrice: null, prxPrice: null, discountPercent: 25 })).toBeNull();
    expect(effectivePrice({ offerKind: "brinde", normalPrice: 10, prxPrice: null, discountPercent: null })).toBeNull();
  });

  it("valor de referência da mídia e ordem no catálogo", () => {
    expect(referenceMediaPrice("spotlight", 3)).toBe(897);
    expect(referenceMediaPrice("takeover", 2)).toBe(2980);
    expect(referenceMediaPrice("basico", 12)).toBe(0);
    expect(mediaBillingText("basico", 1)).toBe("Sem custo de mídia");
    expect(mediaBillingText("takeover", 2)).toBe("Por período: 2 períodos de 7 dias");
    expect(planRank("takeover")).toBeGreaterThan(planRank("prime"));
    expect(planRank("prime")).toBeGreaterThan(planRank("spotlight"));
    expect(planRank(null)).toBe(0);
  });
});
