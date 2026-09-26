import { describe, expect, it } from "vitest";
import { ageBandFromBirthDate, ageDistribution, computePartnerMetrics, type AgeBand, type MetricVoucher } from "@/lib/partners/metrics";

const now = new Date("2026-09-25T12:00:00Z");

describe("faixas etárias", () => {
  it("usa idade completa, considerando o aniversário", () => {
    expect(ageBandFromBirthDate("2010-09-25", now)).toBe("16_17"); // faz 16 hoje
    expect(ageBandFromBirthDate("2010-09-26", now)).toBe("ate_15"); // ainda 15
    expect(ageBandFromBirthDate("2008-09-25", now)).toBe("18_24");
    expect(ageBandFromBirthDate("2001-09-26", now)).toBe("18_24"); // 24
    expect(ageBandFromBirthDate("1997-01-01", now)).toBe("25_29");
    expect(ageBandFromBirthDate("1990-01-01", now)).toBe("30_mais");
    expect(ageBandFromBirthDate(null, now)).toBe("nao_informado");
    expect(ageBandFromBirthDate("data-ruim", now)).toBe("nao_informado");
  });
});

describe("supressão de pequenos grupos", () => {
  const repeat = (band: AgeBand, n: number) => Array.from({ length: n }, () => band);

  it("oculta tudo quando o total é menor que o mínimo", () => {
    const dist = ageDistribution(repeat("18_24", 4));
    expect(dist.every((d) => d.suppressed && d.share === null)).toBe(true);
  });

  it("oculta a faixa pequena e, se ela for a única, também a menor faixa seguinte", () => {
    const dist = ageDistribution([...repeat("18_24", 20), ...repeat("25_29", 6), ...repeat("16_17", 2)]);
    const byBand = Object.fromEntries(dist.map((d) => [d.band, d]));
    expect(byBand["16_17"].suppressed).toBe(true);
    expect(byBand["25_29"].suppressed).toBe(true); // supressão secundária
    expect(byBand["18_24"].suppressed).toBe(false);
    expect(byBand["18_24"].share).toBeCloseTo(20 / 28);
    expect(byBand["ate_15"].suppressed).toBe(false);
    expect(byBand["ate_15"].share).toBe(0);
  });

  it("com duas ou mais faixas pequenas não precisa de supressão secundária", () => {
    const dist = ageDistribution([...repeat("18_24", 20), ...repeat("25_29", 3), ...repeat("16_17", 2)]);
    const byBand = Object.fromEntries(dist.map((d) => [d.band, d]));
    expect(byBand["18_24"].suppressed).toBe(false);
    expect(byBand["25_29"].suppressed).toBe(true);
    expect(byBand["16_17"].suppressed).toBe(true);
  });
});

describe("métricas do parceiro", () => {
  const voucher = (memberKey: string, status: string, validatedAt: string | null, benefitId = "b1"): MetricVoucher => ({
    benefitId,
    memberKey,
    ageBand: "18_24",
    status,
    createdAt: "2026-09-23T13:00:00Z", // quarta-feira
    validatedAt,
  });

  it("calcula CTR, conversão, uso, vendas estimadas e horários em Brasília", () => {
    const metrics = computePartnerMetrics({
      events: [
        ...Array.from({ length: 200 }, () => ({ benefitId: "b1", kind: "impression" as const, ageBand: "18_24" as const, createdAt: "2026-09-23T12:00:00Z" })),
        ...Array.from({ length: 20 }, () => ({ benefitId: "b1", kind: "click" as const, ageBand: "18_24" as const, createdAt: "2026-09-23T12:00:00Z" })),
      ],
      vouchers: [
        voucher("m1", "used", "2026-09-23T15:30:00Z"),
        voucher("m1", "used", "2026-09-24T15:10:00Z"),
        voucher("m2", "valid", null),
        voucher("m3", "used", "2026-09-23T22:00:00Z"),
        voucher("m4", "valid", null),
        voucher("m5", "cancelled", null),
      ],
      offers: [{ benefitId: "b1", price: 19.9 }],
    });

    expect(metrics.impressions).toBe(200);
    expect(metrics.clicks).toBe(20);
    expect(metrics.ctr).toBeCloseTo(0.1);
    expect(metrics.redemptions).toBe(5); // cancelado não conta
    expect(metrics.conversion).toBeCloseTo(5 / 20);
    expect(metrics.validations).toBe(3);
    expect(metrics.usageRate).toBeCloseTo(3 / 5);
    expect(metrics.estimatedSales).toBeCloseTo(59.7);
    expect(metrics.averageTicket).toBeCloseTo(19.9);
    expect(metrics.validationsByHour[12]).toBe(2); // 15:30Z e 15:10Z = 12h em Brasília
    expect(metrics.validationsByHour[19]).toBe(1); // 22:00Z = 19h
    expect(metrics.redemptionsByWeekday[3]).toBe(5);
    expect(metrics.recurrence).toBeNull(); // só 4 membros distintos: abaixo do mínimo
  });

  it("recorrência aparece a partir do grupo mínimo e sem ratios quando não há base", () => {
    const vouchers = ["a", "a", "b", "c", "d", "e"].map((k) => voucher(k, "used", "2026-09-23T15:00:00Z"));
    const metrics = computePartnerMetrics({ events: [], vouchers, offers: [] });
    expect(metrics.recurrence).toBeCloseTo(1 / 5);
    expect(metrics.ctr).toBeNull();
    expect(metrics.conversion).toBeNull();
    expect(metrics.estimatedSales).toBeNull();
  });
});
