// Hello World
import { describe, expect, it } from "vitest";
import { calculatePrxLevel, levelProgress, xpForLevel } from "@/lib/pass-data";

describe("régua infinita de níveis", () => {
  it("segue a curva xpForLevel(n) = floor(250 · (n − 1)^1.65)", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(250);
    expect(xpForLevel(3)).toBe(Math.floor(250 * Math.pow(2, 1.65)));
    expect(xpForLevel(10)).toBe(Math.floor(250 * Math.pow(9, 1.65)));
    expect(xpForLevel(0)).toBe(0);
  });

  it("é estritamente crescente, sem teto", () => {
    for (let n = 1; n < 2000; n++) expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
  });

  it("inverte a curva exatamente nas fronteiras de cada nível", () => {
    for (const n of [1, 2, 3, 7, 8, 10, 50, 100, 1000, 1500]) {
      const floor = xpForLevel(n);
      expect(calculatePrxLevel(floor)).toBe(n);
      if (n > 1) expect(calculatePrxLevel(floor - 1)).toBe(n - 1);
      expect(calculatePrxLevel(xpForLevel(n + 1) - 1)).toBe(n);
    }
  });

  it("não trava mais no nível 7 (régua antiga terminava em 8.000 XP)", () => {
    expect(calculatePrxLevel(8000)).toBeGreaterThan(7);
    expect(calculatePrxLevel(1_000_000)).toBeGreaterThan(100);
  });

  it("trata XP inválido como zero", () => {
    expect(calculatePrxLevel(-10)).toBe(1);
    expect(calculatePrxLevel(Number.NaN)).toBe(1);
    expect(levelProgress(Number.POSITIVE_INFINITY).level).toBe(1);
  });

  it("levelProgress devolve piso, próximo nível, porcentagem e XP restante para qualquer nível", () => {
    const start = levelProgress(0);
    expect(start).toEqual({ level: 1, floor: 0, next: 250, pct: 0, remaining: 250 });

    const mid = levelProgress(125);
    expect(mid.pct).toBe(50);
    expect(mid.remaining).toBe(125);

    for (const n of [10, 50, 1000]) {
      const floor = xpForLevel(n);
      const next = xpForLevel(n + 1);
      const halfway = floor + Math.floor((next - floor) / 2);
      const progress = levelProgress(halfway);
      expect(progress.level).toBe(n);
      expect(progress.floor).toBe(floor);
      expect(progress.next).toBe(next);
      expect(progress.pct).toBeGreaterThanOrEqual(49);
      expect(progress.pct).toBeLessThanOrEqual(50);
      expect(progress.remaining).toBe(next - halfway);
    }
  });
});
