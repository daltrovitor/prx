// Hello World
"use client";

import { useState, type ReactNode } from "react";
import { ScrollytellingContainer } from "@/components/scrollytelling-container";
import { AppShell } from "@/components/app/app-shell";
import { PrxLoader } from "@/components/brand/prx-loader";
import { PrxLogo } from "@/components/brand/prx-logo";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const [viewMode, setViewMode] = useState<"app" | "showcase">("app");
  const [introDone, setIntroDone] = useState(false);

  let content: ReactNode = null;

  if (!loading && user && viewMode === "app") {
    content = <AppShell user={user} onLogout={() => void logout()} onViewShowcase={() => setViewMode("showcase")} />;
  } else if (!loading && user) {
    // Membro logado revendo a apresentação (landing) do PRX.
    content = (
      <main className="prx-landing min-h-screen bg-background text-foreground">
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border px-6 sm:px-10 py-2.5 sm:py-3.5 flex items-center justify-between transition-colors">
          <button type="button" className="flex items-center cursor-pointer" onClick={() => setViewMode("app")} aria-label="Voltar ao app PRX">
            <PrxLogo variant="full" title="" className="h-8 sm:h-9 md:h-11 w-auto text-white drop-shadow-[0_0_20px_rgba(139,92,246,0.35)]" />
          </button>
          <div className="flex items-center space-x-3 font-mono text-xs">
            <ThemeToggle variant="header" />
            <button
              type="button"
              onClick={() => setViewMode("app")}
              className="px-4 py-3 rounded-md bg-[#6c0cf0] text-white font-semibold transition-colors hover:bg-[#5708c9] cursor-pointer"
            >
              VOLTAR AO APP
            </button>
          </div>
        </header>
        <ScrollytellingContainer onGoToDashboard={() => setViewMode("app")} />
      </main>
    );
  } else if (!loading) {
    content = (
      <main className="prx-landing min-h-screen bg-background text-foreground">
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border px-6 sm:px-10 py-2.5 sm:py-3.5 flex items-center justify-between transition-colors">
          <button
            type="button"
            className="flex items-center group cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="PRX — voltar ao topo"
          >
            <PrxLogo
              variant="full"
              title=""
              className="h-8 sm:h-9 md:h-11 w-auto text-white transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_20px_rgba(139,92,246,0.35)]"
            />
          </button>

          <nav aria-label="Seções da apresentação" className="flex items-center space-x-3 sm:space-x-5 text-gray-400 text-xs font-mono">
            <a href="#secao-pass" className="hover:text-cyan-400 transition-colors hidden sm:inline">
              PRX PASS
            </a>
            <a href="#secao-gamificacao" className="hover:text-purple-400 transition-colors hidden sm:inline">
              GAMIFICAÇÃO
            </a>

            <ThemeToggle variant="header" />

            <a
              href="#secao-login"
              className="relative group px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/40 via-violet-600/40 to-cyan-500/30 hover:from-purple-600 hover:to-cyan-500 text-white border border-purple-500/50 font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_30px_rgba(139,92,246,0.7)] hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
            >
              <span className="relative z-10 flex items-center space-x-2">
                <span>ENTRAR / CADASTRO</span>
              </span>
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
            </a>
          </nav>
        </header>

        <ScrollytellingContainer onGoToDashboard={() => setViewMode("app")} />
      </main>
    );
  }

  return (
    <>
      {!introDone && <PrxLoader ready={!loading} onComplete={() => setIntroDone(true)} />}
      {content}
    </>
  );
}
