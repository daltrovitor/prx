import { describe, expect, it } from "vitest";
import {
  TERMS_ID,
  buildContract,
  buildSummaryRows,
  campaignWindow,
  contractPlainText,
  formatDateBR,
  missingForAcceptance,
} from "@/lib/partners/contract";
import { buildContractWithHash, newCertificateId } from "@/lib/partners/contract-hash";
import { commercialSummarySchema, partnerInputSchema } from "@/lib/partners/types";
import { partnerSnapshot, summary } from "./fixtures";

const campaign = { id: "cmp-1", version: 1, summary };

describe("contrato individual", () => {
  it("identifica o parceiro na cláusula 1.1 e numera as 20 cláusulas", () => {
    const doc = buildContract(partnerSnapshot, campaign);
    expect(doc.sections.map((s) => s.number)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
    const clause11 = doc.sections[0].blocks[0];
    expect(clause11.kind === "paragraph" && clause11.text).toContain("Aurora Cafeteria LTDA, CNPJ nº 11.222.333/0001-81");
    expect(clause11.kind === "paragraph" && clause11.text).toContain("NXTGEN PARTICIPAÇÕES E SOLUÇÕES DIGITAIS LTDA, CNPJ nº 68.025.417/0001-42");
  });

  it("preenche a cláusula 3 com todos os campos do formulário", () => {
    const rows = Object.fromEntries(buildSummaryRows(partnerSnapshot, summary));
    expect(rows["Razão social / nome fantasia"]).toBe("Aurora Cafeteria LTDA / Café Aurora");
    expect(rows["CNPJ/CPF e representante"]).toContain("Marina Alves, CPF 529.982.247-25, Sócia-administradora");
    expect(rows["Preço normal"]).toMatch(/R\$\s?9,00/);
    expect(rows["Preço PRX / desconto / brinde"]).toBe("Gratuito (R$ 0,00)");
    expect(rows["Quantidade total garantida"]).toBe("100 unidades");
    expect(rows["Início da campanha"]).toBe("01/10/2026");
    expect(rows["Fim da campanha"]).toBe("31/10/2026");
    expect(rows["Modalidade de uso"]).toBe("QR Code na loja");
    expect(rows["Benefício Exclusivo PRX"]).toContain("3 meses");
    expect(rows["Plano de visibilidade"]).toContain("Spotlight");
    expect(rows["Valor de mídia"]).toMatch(/R\$\s?299,00/);
    expect(rows["Contato operacional"]).toBe("Loja Setor Bueno · (62) 3333-0000 · loja@aurora.com.br");
  });

  it("marca o que falta completar antes do aceite", () => {
    const incomplete = { ...partnerSnapshot, representative: { name: "", document: "", role: "", email: "", phone: "" } };
    const rows = Object.fromEntries(buildSummaryRows(incomplete, summary));
    expect(rows["CNPJ/CPF e representante"]).toContain("A completar pelo parceiro");
    expect(missingForAcceptance(incomplete)).toEqual(["nome do representante", "CPF do representante", "cargo do representante"]);
    expect(missingForAcceptance(partnerSnapshot)).toEqual([]);
  });

  it("o hash é determinístico e muda com qualquer alteração da oferta ou da versão", () => {
    const a = buildContractWithHash(partnerSnapshot, campaign);
    const b = buildContractWithHash(partnerSnapshot, campaign);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(b.hash);
    expect(contractPlainText(a.document)).toContain(TERMS_ID);

    const changedQuantity = buildContractWithHash(partnerSnapshot, { ...campaign, summary: { ...summary, quantity: 99 } });
    const changedVersion = buildContractWithHash(partnerSnapshot, { ...campaign, version: 2 });
    const changedPartner = buildContractWithHash({ ...partnerSnapshot, legalName: "Outra LTDA" }, campaign);
    expect(new Set([a.hash, changedQuantity.hash, changedVersion.hash, changedPartner.hash]).size).toBe(4);
  });

  it("janela da campanha cobre os dias inteiros no horário de Brasília", () => {
    expect(campaignWindow(summary)).toEqual({ startsAt: "2026-10-01T03:00:00.000Z", endsAt: "2026-11-01T02:59:59.999Z" });
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
  });

  it("gera IDs de certificado no formato esperado", () => {
    const id = newCertificateId(new Date("2026-09-25T12:00:00Z"));
    expect(id).toMatch(/^PRX-CERT-2026-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(newCertificateId()).not.toBe(newCertificateId());
  });
});

describe("validação do formulário (cláusula 3)", () => {
  const issues = (input: unknown) => {
    const result = commercialSummarySchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
  };

  it("aceita um Resumo Comercial completo", () => {
    expect(issues(summary)).toEqual([]);
  });

  it("recusa datas invertidas, preço PRX maior que o normal e exclusividade acima de 3 meses", () => {
    expect(issues({ ...summary, endDate: "2026-09-01" })).toContain("endDate");
    expect(issues({ ...summary, prxPrice: 10 })).toContain("prxPrice");
    expect(issues({ ...summary, exclusivityMonths: 4 })).toContain("exclusivityMonths");
    expect(issues({ ...summary, exclusive: false, exclusivityMonths: 2 })).toContain("exclusivityMonths");
  });

  it("exige o campo certo para cada tipo de oferta e zero de mídia no Básico", () => {
    expect(issues({ ...summary, offerKind: "percentual", discountPercent: null })).toContain("discountPercent");
    expect(issues({ ...summary, offerKind: "brinde", giftDescription: "" })).toContain("giftDescription");
    expect(issues({ ...summary, plan: "basico", mediaPrice: 299 })).toContain("mediaPrice");
    expect(issues({ ...summary, redemptionModes: [] })).toContain("redemptionModes");
  });

  it("cadastro do parceiro infere CNPJ/CPF e recusa documento inválido", () => {
    const base = { tradeName: "Café Aurora", legalName: "Aurora Cafeteria LTDA", categoryId: "gastronomia", location: "Goiânia, GO" };
    const ok = partnerInputSchema.safeParse({ ...base, document: "11.222.333/0001-81" });
    expect(ok.success && ok.data.documentType).toBe("CNPJ");
    expect(ok.success && ok.data.document).toBe("11222333000181");
    expect(partnerInputSchema.safeParse({ ...base, document: "11.222.333/0001-80" }).success).toBe(false);
    expect(partnerInputSchema.safeParse({ ...base, document: "11.222.333/0001-81", representative: { document: "111.111.111-11" } }).success).toBe(false);
  });
});
