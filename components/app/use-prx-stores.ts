// Hello World
"use client";

import { useCallback, useSyncExternalStore } from "react";
import { storageKey, useLocalDocument } from "@/lib/prx/local-store";
import { seedBankState, type BankState } from "@/lib/prx/bank";
import { seedLiveWallet, type LiveWallet } from "@/lib/prx/live";

export function useBank(userId: string) {
  return useLocalDocument<BankState>(storageKey("bank", userId), seedBankState);
}

export function useLiveWallet(userId: string) {
  return useLocalDocument<LiveWallet>(storageKey("live", userId), seedLiveWallet);
}

/* Preferência de "ocultar saldo" — conveniência por aparelho. */
const HIDE_KEY = "prx:hide-balance";
const hideListeners = new Set<() => void>();
let memoryHidden = false;

function readHidden(): boolean {
  try {
    const stored = window.localStorage.getItem(HIDE_KEY);
    return stored === null ? memoryHidden : stored === "1";
  } catch {
    return memoryHidden;
  }
}

export function useHiddenBalance(): [boolean, () => void] {
  const hidden = useSyncExternalStore(
    (listener) => {
      hideListeners.add(listener);
      return () => hideListeners.delete(listener);
    },
    readHidden,
    () => false
  );
  const toggle = useCallback(() => {
    memoryHidden = !readHidden();
    try {
      window.localStorage.setItem(HIDE_KEY, memoryHidden ? "1" : "0");
    } catch {
      // sem storage: a preferência vale só nesta sessão
    }
    hideListeners.forEach((listener) => listener());
  }, []);
  return [hidden, toggle];
}
