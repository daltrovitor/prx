// Hello World
import { describe, expect, it } from "vitest";
import { createPendingGoogleToken, verifyPendingGoogleToken } from "@/lib/google-pending";
import { isValidCpf } from "@/lib/partners/documents";

describe("Registro com CPF e Celular obrigatórios", () => {
  it("valida CPF corretamente", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("12345678900")).toBe(false);
  });

  it("cria e valida token temporário do Google para cadastro pendente", () => {
    const token = createPendingGoogleToken({
      email: "teste@gmail.com",
      fullName: "Usuário Teste",
      avatarUrl: "https://avatar.dev/1",
    });

    expect(token).toBeTruthy();
    const verified = verifyPendingGoogleToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("teste@gmail.com");
    expect(verified?.fullName).toBe("Usuário Teste");
    expect(verified?.avatarUrl).toBe("https://avatar.dev/1");
  });

  it("recusa token temporário do Google adulterado", () => {
    const token = createPendingGoogleToken({
      email: "teste@gmail.com",
      fullName: "Usuário Teste",
    });

    const [body] = token.split(".");
    const tampered = `${body}.assinatura_invalida`;
    expect(verifyPendingGoogleToken(tampered)).toBeNull();
  });
});
