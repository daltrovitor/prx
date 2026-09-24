// Hello World
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppTab = "home" | "pass" | "bank" | "live" | "profile";

const TABS: ReadonlyArray<AppTab> = ["home", "pass", "bank", "live", "profile"];

interface AppNavState {
  tab: AppTab;
  /** Sub-seção da aba (ex.: "pix" em #bank/pix). */
  sub: string | null;
  go: (tab: AppTab, sub?: string | null) => void;
}

const AppNavContext = createContext<AppNavState | null>(null);

function parseHash(hash: string): { tab: AppTab; sub: string | null } {
  const [rawTab, rawSub] = hash.replace(/^#/, "").split("/");
  const tab = (TABS as ReadonlyArray<string>).includes(rawTab) ? (rawTab as AppTab) : "home";
  return { tab, sub: rawSub ? decodeURIComponent(rawSub) : null };
}

/**
 * Navegação do app por hash (#bank/pix). O domínio principal é uma rota única
 * (o proxy redireciona qualquer caminho para "/"), então o hash dá ao usuário
 * botão voltar, links diretos e estado preservado no recarregamento.
 */
export function AppNavProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ tab: AppTab; sub: string | null }>({ tab: "home", sub: null });

  useEffect(() => {
    const sync = () => setState(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = useCallback((tab: AppTab, sub: string | null = null) => {
    const hash = sub ? `#${tab}/${encodeURIComponent(sub)}` : `#${tab}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    setState({ tab, sub });
  }, []);

  const value = useMemo(() => ({ ...state, go }), [state, go]);
  return <AppNavContext.Provider value={value}>{children}</AppNavContext.Provider>;
}

export function useAppNav(): AppNavState {
  const ctx = useContext(AppNavContext);
  if (!ctx) throw new Error("useAppNav precisa estar dentro de <AppNavProvider>");
  return ctx;
}
