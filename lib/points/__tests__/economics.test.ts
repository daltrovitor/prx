// Hello World
import { describe, expect, it } from "vitest";
import {
  MIN_PROFIT_MARGIN_PCT,
  assessBenefitViability,
  behaviorCoinsPerMonth,
  coinsPerRealFromRules,
  purchaseReward,
  revenuePerCoin,
  roundPoints,
  simulateBankYield,
  summarizeFinance,
} from "@/lib/points/economics";

describe("calculadora de viabilidade de benefícios", () => {
  it("sugere o menor preço em coins que garante 30% de lucro sobre o custo", () => {
    // C = R$ 20, R = R$ 2, Tc = 8%, 1 coin por real → v = R$ 0,08/coin
    // (20 · 1,3 − 2) / 0,08 = 300 coins
    const result = assessBenefitViability({ costPrice: 20, revenuePerRedemption: 2, partnerFeePct: 8, coinsPerReal: 1 });
    expect(result.revenuePerCoin).toBe(0.08);
    expect(result.suggestedPoints).toBe(300);
    expect(result.evaluatedPoints).toBe(300);
    expect(result.requiredSpend).toBe(300);
    expect(result.revenue).toBe(26);
    expect(result.profit).toBe(6);
    expect(result.marginOnCostPct).toBe(30);
    expect(result.status).toBe("ok");
  });

  it("nunca aceita margem mínima abaixo de 30%", () => {
    const result = assessBenefitViability({ costPrice: 10, revenuePerRedemption: 0, minMarginPct: 5 });
    expect(result.minMarginPct).toBe(MIN_PROFIT_MARGIN_PCT);
    expect(result.suggestedPoints).toBe(roundPoints((10 * 1.3) / 0.08));
  });

  it("marca prejuízo e margem insuficiente no preço informado", () => {
    expect(assessBenefitViability({ costPrice: 20, revenuePerRedemption: 2, pointsCost: 100 }).status).toBe("loss");
    expect(assessBenefitViability({ costPrice: 20, revenuePerRedemption: 2, pointsCost: 250 }).status).toBe("below_min");
    expect(assessBenefitViability({ costPrice: 20, revenuePerRedemption: 2, pointsCost: 400 }).status).toBe("ok");
  });

  it("benefício sem custo para a PRX é sempre viável", () => {
    const result = assessBenefitViability({ costPrice: 0, revenuePerRedemption: 0, pointsCost: 0 });
    expect(result.status).toBe("ok");
    expect(result.marginOnCostPct).toBeNull();
  });

  it("quando a comissão do parceiro já paga o custo com margem, cobra o mínimo de coins", () => {
    const result = assessBenefitViability({ costPrice: 10, revenuePerRedemption: 15 });
    expect(result.suggestedPoints).toBe(10);
    expect(result.status).toBe("ok");
  });

  it("sem comissão sobre compras não existe preço que cubra o custo", () => {
    const result = assessBenefitViability({ costPrice: 10, revenuePerRedemption: 0, partnerFeePct: 0 });
    expect(result.suggestedPoints).toBeNull();
    expect(result.status).toBe("loss");
  });

  it("converte o preço em meses de uso ativo quando há check-ins", () => {
    const result = assessBenefitViability({ costPrice: 20, revenuePerRedemption: 2, behaviorCoinsPerMonth: 100 });
    expect(result.monthsOfActiveUse).toBe(3);
  });
});

describe("compra em parceiro", () => {
  const rule = { coins: 10, xp: 20, active: true };

  it("credita coins e XP proporcionais ao valor (a cada R$ 10)", () => {
    expect(purchaseReward(50, 8, rule)).toEqual({ coins: 50, xp: 100, commission: 4 });
    expect(purchaseReward(25.9, 8, rule)).toEqual({ coins: 25, xp: 51, commission: 2.07 });
  });

  it("encolhe os coins quando a comissão do parceiro é menor que a de referência (lastro)", () => {
    expect(purchaseReward(100, 4, rule)).toEqual({ coins: 50, xp: 200, commission: 4 });
    expect(purchaseReward(100, 12, rule).coins).toBe(100);
  });

  it("não credita nada sem regra ativa ou valor", () => {
    expect(purchaseReward(100, 8, null)).toEqual({ coins: 0, xp: 0, commission: 8 });
    expect(purchaseReward(100, 8, { ...rule, active: false }).coins).toBe(0);
    expect(purchaseReward(0, 8, rule)).toEqual({ coins: 0, xp: 0, commission: 0 });
  });
});

describe("taxa de emissão e lastro", () => {
  it("lê coins por real da regra de compra ativa", () => {
    expect(coinsPerRealFromRules([{ trigger: "partner_purchase", coins: 20, active: true }])).toBe(2);
    expect(coinsPerRealFromRules([{ trigger: "partner_purchase", coins: 20, active: false }])).toBe(1);
    expect(revenuePerCoin(8, 2)).toBeCloseTo(0.04);
  });

  it("soma os coins mensais dos check-ins ativos", () => {
    expect(
      behaviorCoinsPerMonth([
        { trigger: "checkin", coins: 5, active: true, periodicity: "daily" },
        { trigger: "checkin", coins: 40, active: true, periodicity: "weekly" },
        { trigger: "checkin", coins: 20, active: true, periodicity: "monthly" },
        { trigger: "checkin", coins: 999, active: false, periodicity: "daily" },
        { trigger: "partner_purchase", coins: 10, active: true, periodicity: "per_event" },
      ])
    ).toBe(Math.round(150 + (40 * 30) / 7 + 20));
  });
});

describe("painel financeiro", () => {
  it("consolida receita, subsídio, lucro, margem e passivo de coins", () => {
    const summary = summarizeFinance({
      redemptions: [
        { costPrice: 20, revenuePerRedemption: 2 },
        { costPrice: 0, revenuePerRedemption: 5 },
      ],
      purchases: [
        { amount: 100, commission: 8 },
        { amount: 50, commission: 4 },
      ],
      coinsOutstanding: 1000,
      revenuePerCoin: 0.08,
    });
    expect(summary).toMatchObject({
      redemptionRevenue: 7,
      purchaseRevenue: 12,
      grossRevenue: 19,
      subsidyCost: 20,
      netProfit: -1,
      purchaseVolume: 150,
      redemptionCount: 2,
      purchaseCount: 2,
      coinLiability: 80,
    });
    expect(summary.marginPct).toBeCloseTo(-5.26, 2);
  });

  it("zera a margem quando não há receita", () => {
    expect(summarizeFinance({ redemptions: [], purchases: [], coinsOutstanding: 0, revenuePerCoin: 0.08 }).marginPct).toBeNull();
  });

  it("simula o spread do saldo custodiado no PRX Bank", () => {
    const result = simulateBankYield({ activeAccounts: 1000, averageBalance: 500, cdiAnnualPct: 12, clientSharePct: 100, custodyYieldPctOfCdi: 110 });
    const monthly = Math.pow(1.12, 1 / 12) - 1;
    expect(result.custody).toBe(500_000);
    expect(result.monthlyClientYield).toBeCloseTo(500_000 * monthly, 1);
    expect(result.monthlyPrxSpread).toBeCloseTo(500_000 * monthly * 0.1, 1);
    expect(result.spreadPerAccount).toBeCloseTo((500_000 * monthly * 0.1) / 1000, 2);
  });
});
