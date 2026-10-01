// Hello World
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/asaas/secrets";
import { MemoryAsaasBankStore } from "@/lib/bank/asaas/store-memory";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
/** Mesmo padrão do CHECK de bank_subaccounts.api_key na migração. */
const SQL_FORMAT = /^v1:[a-z]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

describe("cifra da apiKey da subconta", () => {
  const env = { BANK_ENCRYPTION_KEY: "k".repeat(40) };

  it("cifra e decifra, no formato aceito pela migração e sem o texto aberto", () => {
    const sealed = encryptSecret("$aact_hmlg_subconta", env);
    expect(sealed).toMatch(SQL_FORMAT);
    expect(sealed).not.toContain("aact");
    expect(decryptSecret(sealed, env)).toBe("$aact_hmlg_subconta");
    expect(encryptSecret("$aact_hmlg_subconta", env)).not.toBe(sealed);
  });

  it("detecta adulteração", () => {
    const sealed = encryptSecret("segredo", env);
    const parts = sealed.split(":");
    parts[4] = Buffer.from("outro").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), env)).toThrow();
  });

  it("guarda qual chave cifrou: ligar BANK_ENCRYPTION_KEY depois não perde as antigas", () => {
    const before = { SUPABASE_SERVICE_ROLE_KEY: "eyJservice" };
    const sealed = encryptSecret("antiga", before);
    expect(sealed.split(":")[1]).toBe("s");
    const after = { ...before, ...env };
    expect(decryptSecret(sealed, after)).toBe("antiga");
    expect(encryptSecret("nova", after).split(":")[1]).toBe("k");
  });

  it("sem nenhuma chave configurada, recusa cifrar", () => {
    expect(() => encryptSecret("x", {})).toThrow(/BANK_ENCRYPTION_KEY/);
  });
});

describe("espelho do Asaas (memória)", () => {
  it("trava a abertura da subconta: uma vez por vez, retomável depois de esquecida", async () => {
    const store = new MemoryAsaasBankStore();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(await store.reserveSubaccount(USER, "sandbox", past)).toBe(true);
    expect(await store.reserveSubaccount(USER, "sandbox", past)).toBe(false);
    // Trava mais nova que o limite de "esquecida": continua presa.
    expect(await store.reserveSubaccount(USER, "sandbox", new Date(Date.now() - 600_000).toISOString())).toBe(false);
    // Trava velha: outro processo pode retomar.
    expect(await store.reserveSubaccount(USER, "sandbox", new Date(Date.now() + 1_000).toISOString())).toBe(true);
    await store.releaseSubaccount(USER);
    expect(await store.reserveSubaccount(USER, "sandbox", past)).toBe(true);

    await store.saveSubaccount(USER, { asaasAccountId: "acc_1", apiKeySealed: "v1:k:a:b:c", provisioningStartedAt: null });
    expect(await store.reserveSubaccount(USER, "sandbox", new Date(Date.now() + 1_000).toISOString())).toBe(false);
    expect((await store.findSubaccountByAsaasId("acc_1"))?.userId).toBe(USER);
  });

  it("webhook: novo, depois retry enquanto não processado, depois duplicado", async () => {
    const store = new MemoryAsaasBankStore();
    const event = { eventId: "evt_1", eventType: "PAYMENT_RECEIVED", asaasAccountId: "acc_1", payload: {} };
    expect(await store.recordWebhook(event)).toBe("new");
    await store.finishWebhook("evt_1", "falhou");
    expect(await store.recordWebhook(event)).toBe("retry");
    await store.finishWebhook("evt_1", null);
    expect(await store.recordWebhook(event)).toBe("duplicate");
  });

  it("um aviso por evento e leitura só do próprio membro", async () => {
    const store = new MemoryAsaasBankStore();
    const base = { userId: USER, eventType: "PAYMENT_RECEIVED", title: "Pix recebido", body: "", amount: 10 };
    expect(await store.insertNotification({ ...base, eventId: "evt_1" })).toBe(true);
    expect(await store.insertNotification({ ...base, eventId: "evt_1" })).toBe(false);
    await store.insertNotification({ ...base, userId: OTHER, eventId: "evt_2" });
    await store.markNotificationsRead(USER, "all");
    expect((await store.listNotifications(USER, 10)).every((n) => n.readAt)).toBe(true);
    expect((await store.listNotifications(OTHER, 10))[0].readAt).toBeNull();
  });

  it("pedido de saída: troca de status atômica e soma só o que foi comprometido", async () => {
    const store = new MemoryAsaasBankStore();
    const since = new Date(Date.now() - 1_000).toISOString();
    const a = await store.insertOutgoing({ userId: USER, kind: "pix_key", amount: 100.126, counterparty: "Ana", target: "ana@prx.dev", description: "" });
    expect(a.amount).toBe(100.13);
    expect(await store.outgoingTotalSince(USER, since)).toBe(0);

    expect(await store.transitionOutgoing(a.id, ["awaiting_confirmation"], "requested", { confirmedAt: new Date().toISOString() })).not.toBeNull();
    // Segunda confirmação do mesmo pedido não passa.
    expect(await store.transitionOutgoing(a.id, ["awaiting_confirmation"], "requested")).toBeNull();
    await store.transitionOutgoing(a.id, ["requested"], "requested", { providerRef: "tra_1" });
    expect((await store.findOutgoingByProviderRef("tra_1"))?.id).toBe(a.id);
    expect(await store.outgoingTotalSince(USER, since)).toBe(100.13);

    await store.transitionOutgoing(a.id, ["requested", "approved"], "failed", { failReason: "Recusado" });
    expect(await store.outgoingTotalSince(USER, since)).toBe(0);
  });
});
