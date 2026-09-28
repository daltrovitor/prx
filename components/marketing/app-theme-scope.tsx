// Hello World
"use client";

import { useThemeScope } from "@/components/theme-provider";

/** Páginas públicas seguem o Modelo Padrão (fundo branco por padrão, respeitando o tema escolhido no app). */
export function AppThemeScope() {
  useThemeScope("app");
  return null;
}
