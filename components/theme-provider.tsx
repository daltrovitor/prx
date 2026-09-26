"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

/**
 * Dois escopos de tema com preferências independentes:
 *   landing → apresentação pública, abre no escuro;
 *   app     → dashboards (membro, admin, parceiro), abrem no claro.
 * O botão de tema altera só o escopo ativo. Os dashboards ativam o escopo "app"
 * ao montar (useThemeScope) e devolvem para "landing" ao desmontar.
 */
export type ThemeScope = "landing" | "app";

const KEYS: Record<ThemeScope, string> = { landing: "prx-theme", app: "prx-app-theme" };
const DEFAULTS: Record<ThemeScope, Theme> = { landing: "dark", app: "light" };

interface ThemeContextType {
  theme: Theme;
  scope: ThemeScope;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setScope: (scope: ThemeScope) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readTheme(scope: ThemeScope): Theme {
  try {
    const stored = localStorage.getItem(KEYS[scope]);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return DEFAULTS[scope];
}

function applyTheme(newTheme: Theme, scope: ThemeScope) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(newTheme);
  root.setAttribute("data-theme", newTheme);
  root.setAttribute("data-theme-scope", scope);
  root.style.colorScheme = newTheme;
}

const emptySubscribe = () => () => {};

/**
 * Roda antes da hidratação. Adivinha o escopo pela URL (subdomínios de painel)
 * e pela sessão lembrada (membro logado cai direto no app), evitando piscar.
 */
export function ThemeScript() {
  const scriptContent = `
    (function() {
      var root = document.documentElement;
      try {
        var host = location.hostname, path = location.pathname;
        var app = /^(adminprx|partnerprx|staffprx|adminng|partnerng)\\./.test(host) || /^\\/(admin|partner|staff)(\\/|$)/.test(path)
          || localStorage.getItem('prx_remember_me') === 'true' || sessionStorage.getItem('prx_tab_active') === 'true';
        var stored = localStorage.getItem(app ? '${KEYS.app}' : '${KEYS.landing}');
        var theme = stored === 'dark' || stored === 'light' ? stored : (app ? '${DEFAULTS.app}' : '${DEFAULTS.landing}');
        root.classList.remove('dark', 'light');
        root.classList.add(theme);
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-theme-scope', app ? 'app' : 'landing');
        root.style.colorScheme = theme;
      } catch (e) {
        root.classList.add('${DEFAULTS.landing}');
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: scriptContent }} />;
}

function initialScope(): ThemeScope {
  if (typeof document === "undefined") return "landing";
  return document.documentElement.getAttribute("data-theme-scope") === "app" ? "app" : "landing";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [scope, setScopeState] = useState<ThemeScope>(initialScope);
  const [theme, setThemeState] = useState<Theme>(() => (typeof window === "undefined" ? DEFAULTS.landing : readTheme(initialScope())));

  useEffect(() => {
    applyTheme(theme, scope);
  }, [theme, scope]);

  const setScope = useCallback((next: ThemeScope) => {
    setScopeState(next);
    setThemeState(readTheme(next));
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      applyTheme(newTheme, scope);
      try {
        localStorage.setItem(KEYS[scope], newTheme);
      } catch {}
    },
    [scope]
  );

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, scope, setTheme, toggleTheme, setScope, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: DEFAULTS.landing,
      scope: "landing" as ThemeScope,
      setTheme: () => {},
      toggleTheme: () => {},
      setScope: () => {},
      mounted: false,
    };
  }
  return context;
}

/** Dashboards chamam no topo: ativa o tema do app enquanto estiverem montados. */
export function useThemeScope(scope: ThemeScope) {
  const { setScope } = useTheme();
  useEffect(() => {
    setScope(scope);
    return () => setScope("landing");
  }, [scope, setScope]);
}
