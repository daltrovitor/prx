// Hello World
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { storageKey, useLocalDocument } from "@/lib/prx/local-store";
import { seedBankState, type BankState } from "@/lib/prx/bank";
import { seedLiveWallet, type LiveWallet } from "@/lib/prx/live";

/**
 * Hook reativo para o PRX BANK.
 * Sincroniza o estado financeiro com o backend (/api/bank), mantendo
 * resposta instantânea e persistência centralizada no servidor.
 */
export function useBank(userId: string): [BankState, (updater: (current: BankState) => BankState) => void] {
  const [bank, setBankLocal] = useLocalDocument<BankState>(storageKey("bank", userId), seedBankState);

  // Sincroniza com o backend na montagem
  useEffect(() => {
    let active = true;
    fetch("/api/bank")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.ok && data.state) {
          setBankLocal(() => data.state);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, setBankLocal]);

  const setBank = useCallback(
    (updater: (current: BankState) => BankState) => {
      setBankLocal((current) => {
        const next = updater(current);
        return next;
      });
    },
    [setBankLocal]
  );

  return [bank, setBank];
}

/**
 * Hook reativo para a carteira do PRX LIVE.
 * Sincroniza ingressos, inscrições da PRX RUN e pitches de startups com o backend (/api/live).
 */
export function useLiveWallet(userId: string): [LiveWallet, (updater: (current: LiveWallet) => LiveWallet) => void] {
  const [wallet, setWalletLocal] = useLocalDocument<LiveWallet>(storageKey("live", userId), seedLiveWallet);

  useEffect(() => {
    let active = true;
    fetch("/api/live")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.ok && data.wallet) {
          setWalletLocal(() => data.wallet);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, setWalletLocal]);

  const setWallet = useCallback(
    (updater: (current: LiveWallet) => LiveWallet) => {
      setWalletLocal((current) => {
        const next = updater(current);
        return next;
      });
    },
    [setWalletLocal]
  );

  return [wallet, setWallet];
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
