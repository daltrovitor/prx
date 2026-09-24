// Hello World
"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Armazenamento local tipado por usuário, usado pelos módulos em modo
 * demonstração (PRX BANK sandbox, carteira de ingressos do PRX LIVE).
 * Cada chave vira `prx:<escopo>:<userId>` no localStorage. Leituras e escritas
 * são protegidas: sem storage (aba privada), o estado vive só em memória.
 */
type Listener = () => void;

const memory = new Map<string, string>();
const listeners = new Map<string, Set<Listener>>();
const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // storage indisponível
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage indisponível: mantém em memória
  }
  listeners.get(key)?.forEach((listener) => listener());
}

export function storageKey(scope: string, userId: string): string {
  return `prx:${scope}:${userId}`;
}

export function readStore<T>(key: string, seed: () => T): T {
  const raw = readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  let value: T;
  if (raw === null) {
    value = seed();
    const serialized = JSON.stringify(value);
    memory.set(key, serialized);
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      // ignora
    }
    snapshotCache.set(key, { raw: serialized, value });
    return value;
  }
  try {
    value = JSON.parse(raw) as T;
  } catch {
    value = seed();
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

export function writeStore<T>(key: string, value: T) {
  writeRaw(key, JSON.stringify(value));
}

function subscribe(key: string, listener: Listener) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshots = new Map<string, unknown>();

/**
 * Hook reativo para um documento local. Retorna [estado, atualizar].
 * `seed` deve ser uma função estável (definida no módulo) que cria o estado inicial.
 */
export function useLocalDocument<T>(key: string, seed: () => T): [T, (updater: (current: T) => T) => void] {
  const subscribeToKey = useCallback((listener: Listener) => subscribe(key, listener), [key]);
  const getSnapshot = useCallback(() => readStore(key, seed), [key, seed]);
  const getServerSnapshot = useCallback(() => {
    if (!serverSnapshots.has(key)) serverSnapshots.set(key, seed());
    return serverSnapshots.get(key) as T;
  }, [key, seed]);

  const value = useSyncExternalStore(subscribeToKey, getSnapshot, getServerSnapshot);

  const update = useCallback(
    (updater: (current: T) => T) => {
      writeStore(key, updater(readStore(key, seed)));
    },
    [key, seed]
  );

  return [value, update];
}
