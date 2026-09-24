// Hello World
"use client";

import React from "react";
import { useTheme } from "./theme-provider";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "header" | "inline";
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  variant: _variant = "header",
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Prevent hydration mismatch by rendering a consistent default until mounted
  const isDark = mounted ? theme === "dark" : true;

  // Header / Inline variant
  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
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

      {showLabel && (
        <span className="ml-2 text-xs font-mono font-medium hidden sm:inline">
          {isDark ? "Modo Claro" : "Modo Escuro"}
        </span>
      )}
    </button>
  );
}
