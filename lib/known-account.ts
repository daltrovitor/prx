// Hello World
"use client";

import { useSyncExternalStore } from "react";

/**
 * Conta lembrada neste aparelho ("Lembrar de mim"). Com ela, as próximas
 * visitas pulam a landing e abrem a tela de login dedicada (foto, nome e só a
 * senha ou a biometria). Guarda apenas dados de exibição — nunca senha nem token.
 */
export interface KnownAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  provider: "password" | "google";
  /** Biometria cadastrada neste aparelho. */
  passkey: boolean;
  /** Id da credencial deste aparelho: a entrada pede só ela (sem escolher aparelho ou app). */
  passkeyId?: string;
}

const KEY = "prx_known_account";
/** Marca de desbloqueio da aba atual: some ao fechar a aba, e a próxima visita pede senha ou biometria. */
const UNLOCKED_KEY = "prx_unlocked";
/** Entrada pelo Google em andamento (sobrevive ao redirecionamento na mesma aba). */
const PENDING_KEY = "prx_unlock_pending";
const EVENT = "prx-known-account";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function parse(raw: string | null): KnownAccount | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<KnownAccount>;
    if (!value || typeof value.id !== "string" || typeof value.email !== "string") return null;
    return {
      id: value.id,
      email: value.email,
      name: typeof value.name === "string" ? value.name : "",
      avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : "",
      provider: value.provider === "google" ? "google" : "password",
      passkey: value.passkey === true,
      ...(typeof value.passkeyId === "string" && value.passkeyId ? { passkeyId: value.passkeyId } : {}),
    };
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
let cachedValue: KnownAccount | null = null;

export function readKnownAccount(): KnownAccount | null {
  const raw = safe(() => localStorage.getItem(KEY), null);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function notify() {
  safe(() => window.dispatchEvent(new Event(EVENT)), undefined);
}

export function saveKnownAccount(account: Omit<KnownAccount, "passkey"> & { passkey?: boolean }) {
  const previous = readKnownAccount();
  const same = previous?.id === account.id;
  const passkey = account.passkey ?? (same ? previous.passkey : false);
  const passkeyId = account.passkeyId ?? (same ? previous.passkeyId : undefined);
  safe(() => localStorage.setItem(KEY, JSON.stringify({ ...account, passkey, ...(passkeyId ? { passkeyId } : {}) })), undefined);
  notify();
}

export function updateKnownAccount(patch: Partial<KnownAccount>) {
  const current = readKnownAccount();
  if (!current) return;
  safe(() => localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch })), undefined);
  notify();
}

export function forgetKnownAccount() {
  safe(() => localStorage.removeItem(KEY), undefined);
  notify();
}

export const unlock = {
  isUnlocked: () => safe(() => sessionStorage.getItem(UNLOCKED_KEY) === "true", false),
  mark: () => safe(() => sessionStorage.setItem(UNLOCKED_KEY, "true"), undefined),
  clear: () => safe(() => sessionStorage.removeItem(UNLOCKED_KEY), undefined),
  setPending: () => safe(() => sessionStorage.setItem(PENDING_KEY, "true"), undefined),
  /** Consome a entrada pendente do Google: devolve true uma única vez. */
  takePending: () =>
    safe(() => {
      const pending = sessionStorage.getItem(PENDING_KEY) === "true";
      sessionStorage.removeItem(PENDING_KEY);
      return pending;
    }, false),
};

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Conta lembrada, reativa e segura para SSR (no servidor é sempre null). */
export function useKnownAccount(): KnownAccount | null {
  return useSyncExternalStore(subscribe, readKnownAccount, () => null);
}
