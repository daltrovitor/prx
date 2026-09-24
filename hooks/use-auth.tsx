// Hello World
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "partner" | "staff" | "admin";
  prxScore: number;
  prxLevel: number;
  walletBalance: number;
  avatarUrl: string;
}

type AuthResult = { success: boolean; error?: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<AuthResult>;
  signup: (fullName: string, email: string, pass: string) => Promise<AuthResult>;
  loginWithGoogle: (rememberMe?: boolean) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REMEMBER_KEY = "prx_remember_me";
const TAB_KEY = "prx_tab_active";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* Acesso protegido ao storage: em aba privada ou com cookies bloqueados, falha em silêncio. */
const storage = {
  remembered: () => safe(() => localStorage.getItem(REMEMBER_KEY) === "true", false),
  tabActive: () => safe(() => sessionStorage.getItem(TAB_KEY) === "true", false),
  mark: (remember: boolean) =>
    safe(() => {
      if (remember) localStorage.setItem(REMEMBER_KEY, "true");
      else localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.setItem(TAB_KEY, "true");
    }, undefined),
  clear: () =>
    safe(() => {
      localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.removeItem(TAB_KEY);
    }, undefined),
};

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Resolve a sessão atual. Contas sem "lembrar de mim" encerram quando a aba
 * é fechada; administradores e parceiros nunca são deslogados automaticamente.
 */
async function resolveSession(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: User | null; rememberMe?: boolean };
    const user = data.user;
    if (!user) return null;

    if (user.role === "admin" || user.role === "partner") {
      storage.mark(true);
      return user;
    }

    const remembered = typeof data.rememberMe === "boolean" ? data.rememberMe : storage.remembered();
    if (!remembered && !storage.tabActive() && !storage.remembered()) {
      await fetch("/api/auth/logout", { method: "POST" });
      storage.clear();
      return null;
    }

    storage.mark(remembered);
    return user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setUser(await resolveSession());
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    resolveSession().then((sessionUser) => {
      if (!active) return;
      setUser(sessionUser);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, pass: string, rememberMe = true): Promise<AuthResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, rememberMe }),
      });
      const data = (await res.json()) as { user?: User; error?: string };
      if (!res.ok || !data.user) return { success: false, error: data.error || "Falha no login" };
      storage.mark(rememberMe);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Erro de conexão") };
    }
  }, []);

  const signup = useCallback(async (fullName: string, email: string, pass: string): Promise<AuthResult> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password: pass }),
      });
      const data = (await res.json()) as { user?: User; error?: string };
      if (!res.ok || !data.user) return { success: false, error: data.error || "Falha ao criar conta" };
      storage.mark(true);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Erro de conexão") };
    }
  }, []);

  const loginWithGoogle = useCallback(async (rememberMe = true): Promise<AuthResult> => {
    try {
      storage.mark(rememberMe);
      document.cookie = `prx_remember_pending=${rememberMe ? 1 : 0}; path=/; max-age=1800; SameSite=Lax`;

      const { supabase, isUsingLiveSupabase } = await import("@/lib/supabase/client");
      if (isUsingLiveSupabase && supabase) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { access_type: "offline", prompt: "consent" },
          },
        });
        if (error) return { success: false, error: error.message };
        if (data?.url) window.location.href = data.url;
        return { success: true };
      }

      // Sem Supabase no navegador: fluxo simulado, disponível só em desenvolvimento local.
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberMe }),
      });
      const data = (await res.json()) as { user?: User; error?: string };
      if (!res.ok || !data.user) return { success: false, error: data.error || "Falha ao autenticar com o Google" };
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Erro ao conectar com o Google") };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      storage.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, loginWithGoogle, logout, refreshUser }),
    [user, loading, login, signup, loginWithGoogle, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
