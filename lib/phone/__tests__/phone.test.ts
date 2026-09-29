// Hello World
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetNotificationMemory, memoryDeliveries } from "@/lib/notifications/log";
import { getPhoneRepository, resetPhoneMemory } from "@/lib/phone/repository";
import { confirmPhoneCode, generatePhoneCode, hashPhoneCode, phoneVerificationState, requestPhoneCode } from "@/lib/phone/service";
import { brPhoneSchema, confirmCodeSchema, PHONE_CODE_MAX_ATTEMPTS } from "@/lib/phone/types";

const PHONE = "11988887777";
const T0 = new Date("2026-09-30T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

beforeEach(() => {
  resetPhoneMemory();
  resetNotificationMemory();
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function sendCode(userId = "u1", phone = PHONE, now = T0): Promise<string> {
  const result = await requestPhoneCode(userId, phone, now);
  if (!result.devCode) throw new Error("sem código de desenvolvimento");
  return result.devCode;
}

describe("validação do celular e do código", () => {
  it("aceita as formas comuns e recusa DDD ou fixo inválidos", () => {
    expect(brPhoneSchema.parse("(11) 98888-7777")).toBe(PHONE);
    expect(brPhoneSchema.parse("+55 11 98888-7777")).toBe(PHONE);
    expect(brPhoneSchema.safeParse("(20) 98888-7777").success).toBe(false);
    expect(brPhoneSchema.safeParse("(11) 3888-7777").success).toBe(false);
    expect(confirmCodeSchema.safeParse({ phone: PHONE, code: "12345" }).success).toBe(false);
    expect(confirmCodeSchema.parse({ phone: PHONE, code: "123 456" }).code).toBe("123456");
  });

  it("gera 6 dígitos e o HMAC depende do membro e do número", () => {
    for (let i = 0; i < 50; i++) expect(generatePhoneCode()).toMatch(/^\d{6}$/);
    const hash = hashPhoneCode("u1", PHONE, "123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPhoneCode("u2", PHONE, "123456")).not.toBe(hash);
    expect(hashPhoneCode("u1", "11977776666", "123456")).not.toBe(hash);
  });
});

describe("confirmação pelo WhatsApp", () => {
  it("envia, guarda só o hash e confirma com o código certo", async () => {
    const code = await sendCode();
    const stored = await getPhoneRepository().latestOpenCode("u1");
    expect(stored?.codeHash).not.toContain(code);
    expect(memoryDeliveries()[0]).toMatchObject({ channel: "whatsapp", template: "phone_code", recipient: "(11) *****-7777", status: "simulated" });

    const pending = await phoneVerificationState("u1", at(1000));
    expect(pending.pending?.phone).toBe("(11) *****-7777");
    expect(pending.verified).toBe(false);

    const state = await confirmPhoneCode("u1", PHONE, code, at(5000));
    expect(state).toMatchObject({ verified: true, phone: "(11) 98888-7777", pending: null });
  });

  it("segura reenvio por 60s e limita 5 códigos por hora", async () => {
    await sendCode();
    await expect(requestPhoneCode("u1", PHONE, at(30_000))).rejects.toThrow(/Aguarde 30s/);
    for (let i = 1; i < 5; i++) await sendCode("u1", PHONE, at(i * 61_000));
    await expect(requestPhoneCode("u1", PHONE, at(5 * 61_000))).rejects.toThrow(/muitos códigos/);
  });

  it("um código novo invalida o anterior", async () => {
    const first = await sendCode();
    await sendCode("u1", PHONE, at(61_000));
    await expect(confirmPhoneCode("u1", PHONE, first, at(62_000))).rejects.toThrow(/incorreto/);
  });

  it("conta tentativas erradas e queima o código na última", async () => {
    const code = await sendCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 1; i < PHONE_CODE_MAX_ATTEMPTS; i++) {
      await expect(confirmPhoneCode("u1", PHONE, wrong, at(i * 1000))).rejects.toThrow(/Resta|Restam/);
    }
    await expect(confirmPhoneCode("u1", PHONE, wrong, at(10_000))).rejects.toThrow(/Peça um novo código/);
    await expect(confirmPhoneCode("u1", PHONE, code, at(11_000))).rejects.toThrow(/Peça um código/);
  });

  it("expira em 10 minutos", async () => {
    const code = await sendCode();
    await expect(confirmPhoneCode("u1", PHONE, code, at(10 * 60_000 + 1))).rejects.toThrow(/expirou/);
  });

  it("não aceita código de outro número", async () => {
    const code = await sendCode();
    await expect(confirmPhoneCode("u1", "11977776666", code, at(1000))).rejects.toThrow(/Peça um código/);
  });

  it("um número confirmado pertence a uma só conta", async () => {
    const code = await sendCode("u1");
    await confirmPhoneCode("u1", PHONE, code, at(1000));
    await expect(requestPhoneCode("u1", PHONE, at(2000))).rejects.toThrow(/já está confirmado na sua conta/);
    await expect(requestPhoneCode("u2", PHONE, at(2000))).rejects.toThrow(/outra conta PRX/);
  });

  it("em produção sem WhatsApp configurado, avisa e não segura o reenvio", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(requestPhoneCode("u1", PHONE, T0)).rejects.toThrow(/ainda não está disponível/);
    expect(await getPhoneRepository().latestOpenCode("u1")).toBeNull();
    expect(memoryDeliveries()[0]).toMatchObject({ status: "skipped" });
  });
});
