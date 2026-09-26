// Hello World
"use client";

import type { ReactNode } from "react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Avatar } from "@/components/app/ui";

/**
 * Cabeçalho dos painéis (admin e parceiro) no mesmo padrão do app do membro:
 * avatar, saudação, identificação curta e ações em botões redondos.
 */
export function DashboardHeader({
  name,
  subtitle,
  area,
  actions,
}: {
  name: string;
  subtitle?: string | null;
  /** Nome da área ao lado da marca no desktop ("Admin", nome do parceiro). */
  area: string;
  actions: ReactNode;
}) {
  const first = (name || "").trim().split(/\s+/)[0] || "equipe";
  return (
    <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size={44} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-ink">Olá, {first}</p>
            <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
          </div>
          <span className="ml-3 hidden items-center gap-2 rounded-full bg-surface py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium text-ink lg:inline-flex">
            <PrxLogo variant="symbol" title="" className="h-4 w-auto" />
            {area}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

/** Link com aparência de botão redondo (ex.: abrir o app em outra aba). */
export const roundLinkClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-line cursor-pointer";
