// Hello World
"use client";

import React from "react";
import { useTheme } from "./theme-provider";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** "header": landing (vidro escuro). "app": botão redondo dos dashboards. */
  variant?: "header" | "inline" | "app";
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ variant = "header", className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Até montar, renderiza um estado estável para não divergir do HTML do servidor.
  const isDark = mounted ? theme === "dark" : variant !== "app";
  const label = isDark ? "Alternar para modo claro" : "Alternar para modo escuro";

  if (variant === "app") {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-ink transition-colors hover:bg-line",
          showLabel ? "px-4 text-sm font-medium" : "w-11",
          className
        )}
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        {showLabel && <span>{isDark ? "Modo claro" : "Modo escuro"}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={label}
      title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
      className={cn(
        "relative p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer border",
        isDark
          ? "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white"
          : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900",
        className
      )}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:scale-110" />
        ) : (
          <Moon className="w-4 h-4 text-purple-600 transition-transform duration-200 hover:scale-110" />
        )}
      </div>

      {showLabel && <span className="ml-2 text-xs font-mono font-medium hidden sm:inline">{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
    </button>
  );
}
