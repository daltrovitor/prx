// Hello World
"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { updateKnownAccount } from "@/lib/known-account";

/** Biometria/reconhecimento facial do próprio aparelho (Face ID, Touch ID, Windows Hello, digital do Android). */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

function ceremonyError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError" || err.name === "AbortError") return "Biometria cancelada. Tente de novo ou use a senha.";
    if (err.name === "InvalidStateError") return "Este aparelho já tem a biometria ativada para a sua conta.";
    if (err.name === "SecurityError") return "A biometria só funciona no endereço oficial do PRX, com conexão segura.";
  }
  return fallback;
}

async function json<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

/** Ativa a entrada por biometria neste aparelho (exige sessão ativa). */
export async function registerPasskey(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const start = await fetch("/api/auth/passkeys/register", { cache: "no-store" });
    const { options, error } = await json<{ options?: PublicKeyCredentialCreationOptionsJSON }>(start);
    if (!start.ok || !options) return { ok: false, error: error || "Não foi possível iniciar a biometria." };
    const response = await startRegistration({ optionsJSON: options });
    const finish = await fetch("/api/auth/passkeys/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    const result = await json<{ success?: boolean }>(finish);
    if (!finish.ok || !result.success) return { ok: false, error: result.error || "Não foi possível ativar a biometria." };
    updateKnownAccount({ passkey: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: ceremonyError(err, "Não foi possível ativar a biometria.") };
  }
}

/** Entra na conta lembrada com a biometria do aparelho. */
export async function authenticatePasskey<U>(userId: string): Promise<{ ok: true; user: U } | { ok: false; error: string; missing?: boolean }> {
  try {
    const start = await fetch(`/api/auth/passkeys/login?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    const { options, error } = await json<{ options?: PublicKeyCredentialRequestOptionsJSON }>(start);
    if (!start.ok || !options) return { ok: false, error: error || "Não foi possível iniciar a biometria.", missing: start.status === 404 };
    const response = await startAuthentication({ optionsJSON: options });
    const finish = await fetch("/api/auth/passkeys/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    const result = await json<{ user?: U }>(finish);
    if (!finish.ok || !result.user) return { ok: false, error: result.error || "Biometria não confirmada." };
    return { ok: true, user: result.user };
  } catch (err) {
    return { ok: false, error: ceremonyError(err, "Biometria não confirmada.") };
  }
}
