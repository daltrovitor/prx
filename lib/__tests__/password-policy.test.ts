// Hello World
import { describe, expect, it } from "vitest";
import { PASSWORD_RULES, passwordProblem, strongPasswordSchema } from "@/lib/password-policy";

describe("senha dos cadastros", () => {
  it("exige 8+ caracteres, letra, número e caractere especial", () => {
    expect(passwordProblem("Ab1!")).toBe("A senha precisa ter 8 caracteres ou mais.");
    expect(passwordProblem("12345678!")).toBe("A senha precisa ter uma letra.");
    expect(passwordProblem("Senhaforte!")).toBe("A senha precisa ter um número.");
    expect(passwordProblem("Senhaforte1")).toBe("A senha precisa ter um caractere especial (!@#$%…).");
    expect(passwordProblem("Senha forte1")).not.toBeNull(); // espaço não conta como especial
    expect(passwordProblem("Senhaforte1!")).toBeNull();
    expect(passwordProblem("Açaí#2026")).toBeNull(); // letras acentuadas valem
  });

  it("o schema devolve a primeira regra que falta e limita o tamanho", () => {
    expect(strongPasswordSchema.safeParse("Senhaforte1!").success).toBe(true);
    const weak = strongPasswordSchema.safeParse("senha123");
    expect(weak.success).toBe(false);
    expect(weak.error?.issues[0]?.message).toContain("caractere especial");
    expect(strongPasswordSchema.safeParse(`A1!${"x".repeat(200)}`).success).toBe(false);
  });

  it("tem as quatro regras mostradas na tela", () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(["length", "letter", "number", "special"]);
  });
});
