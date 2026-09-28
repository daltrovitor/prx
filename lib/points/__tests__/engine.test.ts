// Hello World
import { beforeEach, describe, expect, it } from "vitest";
import { matchPartner, normalizeName, verticalOf, type MatchablePartner } from "@/lib/points/partner-match";
import { claimStatus, nextPeriodStart, periodStart } from "@/lib/points/rules";
import { pointRuleInputSchema } from "@/lib/points/types";
import { getPartnerRepository } from "@/lib/partners/repository";
import { getWalletRepository, resetPointsMemory } from "@/lib/points/repository";
import { assertCanAfford, chargeRedemption, getWallet, listClaimsForReview, previewPartnerPix, processPartnerPixTransfer, reviewClaim, submitClaim } from "@/lib/points/service";
import { partnerSnapshot } from "@/lib/partners/__tests__/fixtures";

const burger: MatchablePartner = {
  id: "p1",
  tradeName: "Burger Lab",
  legalName: "Burger Lab Comércio de Alimentos LTDA",
  document: "11222333000181",
  categoryId: "gastronomia",
  status: "ATIVO",
  contactEmail: "pix@burgerlab.com.br",
  contactPhone: "(11) 98888-7777",
};
const suspended: MatchablePartner = { ...burger, id: "p2", tradeName: "Sneaker Hub", legalName: "Sneaker Hub LTDA", document: "04252011000110", status: "SUSPENSO" };

describe("identificação do parceiro recebedor", () => {
  it("reconhece CNPJ, e-mail, celular e nome", () => {
    expect(matchPartner({ key: "11.222.333/0001-81" }, [burger])).toMatchObject({ method: "document" });
    expect(matchPartner({ key: "PIX@burgerlab.com.br" }, [burger])).toMatchObject({ method: "pix_key" });
    expect(matchPartner({ key: "+5511988887777" }, [burger])).toMatchObject({ method: "pix_key" });
    expect(matchPartner({ key: "3f2c-random", recipientName: "BURGER LAB PINHEIROS" }, [burger])).toMatchObject({ method: "name" });
    expect(matchPartner({ key: "3f2c-random", recipientName: "Burger Lab Comercio de Alimentos Ltda" }, [burger])).toMatchObject({ method: "name" });
  });

  it("ignora parceiros inativos e destinos desconhecidos", () => {
    expect(matchPartner({ key: "04252011000110" }, [suspended])).toBeNull();
    expect(matchPartner({ key: "52998224725" }, [burger])).toBeNull();
    expect(matchPartner({ key: "x", recipientName: "Lab" }, [burger])).toBeNull();
  });

  it("normaliza nomes sem acentos nem sufixos societários", () => {
    expect(normalizeName("Café Aurora Ltda.")).toBe("cafe aurora");
    expect(verticalOf("gastronomia")).toEqual({ id: "gastronomia", name: "Gastronomia", code: "BITE" });
    expect(verticalOf("desconhecida").code).toBe("OUTROS");
  });
});

describe("janelas de check-in (horário de Brasília)", () => {
  // 2026-09-27 é domingo. 02:00 UTC = 23:00 de sábado em Brasília.
  const now = new Date("2026-09-27T02:00:00Z");

  it("calcula o início do dia, da semana (segunda) e do mês em UTC−3", () => {
    expect(periodStart("daily", now).toISOString()).toBe("2026-09-26T03:00:00.000Z");
    expect(periodStart("weekly", now).toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(periodStart("monthly", now).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(nextPeriodStart("monthly", now).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("libera, segura e encerra conforme a periodicidade", () => {
    const weekly = { trigger: "checkin" as const, periodicity: "weekly" as const };
    expect(claimStatus(weekly, null, now).status).toBe("available");
    expect(claimStatus(weekly, { at: "2026-09-22T12:00:00Z", status: "pending" }, now).status).toBe("pending");
    expect(claimStatus(weekly, { at: "2026-09-22T12:00:00Z", status: "rejected" }, now).status).toBe("available");
    expect(claimStatus(weekly, "2026-09-22T12:00:00Z", now)).toEqual({ status: "cooldown", availableAt: "2026-09-28T03:00:00.000Z" });
    expect(claimStatus(weekly, "2026-09-20T12:00:00Z", now).status).toBe("available");
    expect(claimStatus({ trigger: "checkin", periodicity: "once" }, "2026-01-01T00:00:00Z", now).status).toBe("done");
    expect(claimStatus({ trigger: "partner_purchase", periodicity: "per_event" }, null, now).status).toBe("auto");
  });

  it("valida a coerência entre gatilho e periodicidade", () => {
    const base = { title: "Regra", description: "", coins: 10, xp: 10, category: "geral", active: true, sortOrder: 0 };
    expect(pointRuleInputSchema.safeParse({ ...base, trigger: "checkin", periodicity: "weekly" }).success).toBe(true);
    expect(pointRuleInputSchema.safeParse({ ...base, trigger: "checkin", periodicity: "per_event" }).success).toBe(false);
    expect(pointRuleInputSchema.safeParse({ ...base, trigger: "partner_purchase", periodicity: "weekly" }).success).toBe(false);
    expect(pointRuleInputSchema.safeParse({ ...base, coins: 0, xp: 0, trigger: "checkin", periodicity: "daily" }).success).toBe(false);
  });
});

describe("economia PRX (memória)", () => {
  const userId = `usr_test_${Date.now().toString(36)}`;

  beforeEach(() => resetPointsMemory());

  const member = { id: userId, name: "Membro Teste", email: "teste@prx.dev" };

  it("abre a carteira zerada: nenhum coin de graça", async () => {
    const wallet = await getWallet(userId);
    expect(wallet.coins).toBe(0);
    expect(wallet.transactions).toHaveLength(0);
    expect(wallet.rules.some((r) => r.trigger === "checkin" && r.status === "available")).toBe(true);
  });

  it("bom comportamento só credita depois da aprovação da equipe", async () => {
    const wallet = await getWallet(userId);
    const weekly = wallet.rules.find((r) => r.periodicity === "weekly")!;
    const claim = await submitClaim(member, weekly.id, "Mais uma semana sem apostar, foco no curso.");
    expect(claim.status).toBe("pending");
    expect((await getWallet(userId)).coins).toBe(0);
    expect((await getWallet(userId)).rules.find((r) => r.id === weekly.id)?.status).toBe("pending");
    await expect(submitClaim(member, weekly.id, "Enviando de novo antes da análise.")).rejects.toThrow(/análise/);

    expect((await listClaimsForReview("pending")).some((c) => c.id === claim.id)).toBe(true);
    const approved = await reviewClaim(claim.id, "approve", "", "admin@prx.dev");
    expect(approved.status).toBe("approved");
    const after = await getWallet(userId);
    expect(after.coins).toBe(weekly.coins);
    expect(after.transactions[0]).toMatchObject({ source: "behavior", coinsDelta: weekly.coins, xpDelta: weekly.xp });
    await expect(reviewClaim(claim.id, "approve", "", "admin@prx.dev")).rejects.toThrow(/já foi aprovado/);
    await expect(submitClaim(member, weekly.id, "Outra semana no mesmo período.")).rejects.toThrow(/período/);
  });

  it("envio recusado não credita e libera novo envio", async () => {
    const wallet = await getWallet(userId);
    const daily = wallet.rules.find((r) => r.periodicity === "daily")!;
    const claim = await submitClaim(member, daily.id, "Treino de 40 minutos na praça.");
    await reviewClaim(claim.id, "reject", "Sem comprovação.", "admin@prx.dev");
    expect((await getWallet(userId)).coins).toBe(0);
    expect((await getWallet(userId)).rules.find((r) => r.id === daily.id)?.status).toBe("available");
  });

  it("debita o resgate uma única vez e bloqueia saldo insuficiente", async () => {
    await getWallet(userId);
    await getWalletRepository(userId).apply(userId, { coinsDelta: 100, xpDelta: 0, source: "admin_adjustment", referenceId: "seed", description: "Saldo de teste" });
    await expect(assertCanAfford(userId, 500)).rejects.toThrow(/insuficientes/);
    const benefit = { id: "b1", title: "Café", partnerName: "Café Aurora", pointsCost: 60 };
    const first = await chargeRedemption(userId, benefit, "voucher-1");
    expect(first?.coins).toBe(40);
    const again = await chargeRedemption(userId, benefit, "voucher-1");
    expect(again?.duplicate).toBe(true);
    expect(again?.coins).toBe(40);
    await expect(chargeRedemption(userId, benefit, "voucher-2")).rejects.toThrow(/insuficientes/);
    expect((await getWalletRepository(userId).getBalance(userId)).coins).toBe(40);
  });

  it("detecta Pix para parceiro, categoriza e credita coins e XP uma única vez", async () => {
    const repo = getPartnerRepository();
    const partner = await repo.insertPartner({
      ...partnerSnapshot,
      categoryId: "gastronomia",
      description: "",
      logoUrl: "",
      bannerUrl: "",
      status: "ATIVO",
      ownerUserId: null,
      ownerEmail: null,
    });

    const preview = await previewPartnerPix({ key: partnerSnapshot.document, amount: 50 });
    expect(preview).toMatchObject({ partnerId: partner.id, verticalCode: "BITE", coins: 50, xp: 100 });

    const transfer = { endToEndId: `E2E${Date.now()}`, key: partnerSnapshot.document, amount: 50, source: "sandbox" as const };
    const result = await processPartnerPixTransfer(userId, transfer);
    expect(result).toMatchObject({ coins: 50, categoryName: "Gastronomia", duplicate: false });
    expect(result?.purchase).toMatchObject({ partnerName: "Café Aurora", commission: 4, coins: 50, xp: 100, matchMethod: "document" });

    const replay = await processPartnerPixTransfer(userId, transfer);
    expect(replay?.duplicate).toBe(true);
    expect(replay?.coins).toBe(50);

    const wallet = await getWallet(userId);
    expect(wallet.purchases).toHaveLength(1);
    expect(wallet.transactions.filter((t) => t.source === "partner_purchase")).toHaveLength(1);

    expect(await processPartnerPixTransfer(userId, { ...transfer, endToEndId: "E2E-other", key: "52998224725" })).toBeNull();
  });
});
