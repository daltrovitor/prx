// Hello World
import Link from "next/link";
import type { ReactNode } from "react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { AppThemeScope } from "@/components/marketing/app-theme-scope";
import { ViraWebCredit } from "@/components/brand/viraweb-credit";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

/*
 * Moldura das páginas públicas (documentos legais e Sou Pai):
 * cabeçalho em vidro, rodapé corporativo e o tema do Modelo Padrão.
 * Server Component: nada aqui precisa de JavaScript no navegador.
 */

const NAV = [
  { href: "/", label: "Início" },
  { href: "/sou-pai", label: "Sou Pai" },
  { href: "/termos", label: "Termos" },
  { href: "/privacidade", label: "Privacidade" },
];

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="glass-bar sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-10">
        <Link href="/" className="flex min-h-12 cursor-pointer items-center" aria-label="PRX — página inicial">
          <PrxLogo variant="compact" title="" className="h-6 w-auto text-ink sm:h-7" />
        </Link>
        <nav aria-label="Produtos PRX" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3.5 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>
        {cta && (
          <Link
            href="/"
            className="inline-flex min-h-12 cursor-pointer items-center rounded-xl bg-ink px-5 text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Abrir o app
          </Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = 2026;
  const columns: ReadonlyArray<{ title: string; links: ReadonlyArray<{ href: string; label: string }> }> = [
    {
      title: "Produtos",
      links: [
        { href: "/", label: "PRX PASS" },
        { href: "/#bank", label: "PRX BANK" },
        { href: "/#live", label: "PRX LIVE" },
        { href: "/#reels", label: "Destaques" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { href: "/", label: "Sobre a PRX" },
        { href: "/sou-pai", label: "Sou Pai" },
        { href: "/em-breve", label: "Lista VIP" },
        { href: `mailto:${COMPANY.supportEmail}`, label: "Contato" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/termos", label: "Termos de Uso" },
        { href: "/privacidade", label: "Política de Privacidade" },
        { href: `mailto:${COMPANY.dpoEmail}`, label: "Encarregado de Dados (LGPD)" },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <PrxLogo variant="full" title="PRX" className="h-10 w-auto text-ink" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Benefícios, conta digital, eventos e cultura para as gerações Z e Alpha. Build. Don&apos;t Bet.</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[13px] font-semibold text-ink">{column.title}</h2>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="inline-flex min-h-10 cursor-pointer items-center text-sm text-muted-foreground transition-colors hover:text-ink">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[13px] leading-relaxed text-muted-foreground md:flex-row md:items-start md:justify-between">
          <p>
            © {year} {COMPANY.legalName}
            {COMPANY.cnpj ? ` · CNPJ ${COMPANY.cnpj}` : ""}. Todos os direitos reservados.
          </p>
          <p className="max-w-xl md:text-right">
            A PRX não é instituição financeira. A conta de pagamento do PRX BANK será oferecida por instituição parceira autorizada pelo Banco Central, identificada no app
            antes da ativação.
          </p>
        </div>
        <ViraWebCredit className="mt-6 md:justify-start" />
      </div>
    </footer>
  );
}

/** Página pública completa: tema, cabeçalho, conteúdo e rodapé. */
export function SitePage({ children, className, cta = true }: { children: ReactNode; className?: string; cta?: boolean }) {
  return (
    <div className={cn("prx-app isolate flex min-h-dvh flex-col bg-background text-foreground selection:bg-[#6c0cf0] selection:text-white", className)}>
      <AppThemeScope />
      <div aria-hidden className="prx-ambient" />
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-background">
        Pular para o conteúdo
      </a>
      <SiteHeader cta={cta} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
