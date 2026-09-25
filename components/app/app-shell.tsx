// Hello World
"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import type { User } from "@/hooks/use-auth";
import { PrxLogo } from "@/components/brand/prx-logo";
import {
  IconBank,
  IconHome,
  IconLive,
  IconLogout,
  IconPass,
  IconProfile,
} from "@/components/icons/prx-icons";
import { AppNavProvider, useAppNav, type AppTab } from "@/components/app/app-nav";
import { SmoothScroll } from "@/components/app/smooth-scroll";
import { usePassData, firstName } from "@/components/app/use-pass-data";
import { HomeScreen } from "@/components/app/screens/home-screen";
import { PassScreen } from "@/components/app/screens/pass-screen";
import { BankScreen } from "@/components/app/screens/bank-screen";
import { LiveScreen } from "@/components/app/screens/live-screen";
import { ProfileScreen } from "@/components/app/screens/profile-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  tab: AppTab;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

const NAV: ReadonlyArray<NavItem> = [
  { tab: "home", label: "Início", Icon: IconHome },
  { tab: "pass", label: "Pass", Icon: IconPass },
  { tab: "bank", label: "Bank", Icon: IconBank },
  { tab: "live", label: "Live", Icon: IconLive },
  { tab: "profile", label: "Perfil", Icon: IconProfile },
];

interface AppShellProps {
  user: User;
  onLogout: () => void;
  onViewShowcase: () => void;
}

export function AppShell(props: AppShellProps) {
  return (
    <AppNavProvider>
      <SmoothScroll>
        <ShellLayout {...props} />
      </SmoothScroll>
    </AppNavProvider>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "P") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function ShellLayout({ user, onLogout, onViewShowcase }: AppShellProps) {
  const { tab, go } = useAppNav();
  const pass = usePassData(user);
  const lenis = useLenis();
  const previousTab = useRef(tab);

  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0 });
  }, [tab, lenis]);

  const member = pass.member;

  return (
    <div className="prx-app min-h-dvh bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      {/* Trilho lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-card px-4 py-7 lg:flex">
        <button type="button" onClick={() => go("home")} className="cursor-pointer self-start px-2" aria-label="PRX — ir para o início">
          <PrxLogo variant="compact" title="" className="h-7 w-auto text-ink" />
        </button>

        <nav aria-label="Seções do app" className="mt-10 flex flex-col gap-1">
          {NAV.map(({ tab: itemTab, label, Icon }) => {
            const active = tab === itemTab;
            return (
              <button
                key={itemTab}
                type="button"
                onClick={() => go(itemTab)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-[3px] px-3 text-[15px] transition-colors",
                  active ? "bg-surface font-semibold text-ink" : "text-muted-foreground hover:bg-surface hover:text-ink"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-indicator"
                    className="absolute inset-y-2.5 left-0 w-[2px] bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                )}
                <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-5">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink font-display text-sm font-semibold text-white">
              {initials(member.name || "PRX")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{member.name || "Membro PRX"}</p>
              <p className="truncate text-[13px] text-muted-foreground">Nível {member.prxLevel || 1}</p>
            </div>
          </div>
          <div className="mt-3">
            <ThemeToggle showLabel className="w-full justify-start rounded-[3px] border-line text-[14px]" />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[3px] px-3 text-[15px] text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
          >
            <IconLogout size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Barra superior (mobile e tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card/95 px-3 min-[380px]:px-4 backdrop-blur lg:hidden">
        <button type="button" onClick={() => go("home")} className="-ml-1 flex min-h-12 cursor-pointer items-center px-1" aria-label="PRX — ir para o início">
          <PrxLogo variant="compact" title="" className="h-6 w-auto text-ink" />
        </button>
        <div className="flex items-center gap-1.5 min-[360px]:gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => go("pass", "missions")}
            className="flex min-h-12 cursor-pointer items-center gap-1.5 pl-1 text-xs min-[360px]:text-[13px] text-muted-foreground"
            aria-label={`Nível ${member.prxLevel || 1}, ${member.prxScore.toLocaleString("pt-BR")} XP. Ver missões`}
          >
            <span className="font-mono text-ink hidden min-[360px]:inline">{member.prxScore.toLocaleString("pt-BR")} XP</span>
            <span className="bg-ink px-1.5 py-0.5 font-mono text-[11px] min-[360px]:text-[12px] leading-5 text-white">LV {member.prxLevel || 1}</span>
          </button>
        </div>
      </header>

      <main id="conteudo" className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1120px] px-3.5 min-[380px]:px-4 pb-28 min-[380px]:pb-32 pt-5 sm:px-6 lg:px-12 lg:pb-20 lg:pt-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {tab === "home" && <HomeScreen pass={pass} firstName={firstName(member)} />}
              {tab === "pass" && <PassScreen pass={pass} />}
              {tab === "bank" && <BankScreen member={member} />}
              {tab === "live" && <LiveScreen member={member} />}
              {tab === "profile" && (
                <ProfileScreen pass={pass} onLogout={onLogout} onViewShowcase={onViewShowcase} initials={initials(member.name || "PRX")} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Barra de abas inferior (mobile e tablet), no estilo dos apps sociais */}
      <nav
        aria-label="Seções do app"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ tab: itemTab, label, Icon }) => {
            const active = tab === itemTab;
            return (
              <li key={itemTab}>
                <button
                  type="button"
                  onClick={() => go(itemTab)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-[58px] min-[380px]:h-[62px] w-full cursor-pointer flex-col items-center justify-center gap-1 text-[10px] min-[360px]:text-[11px] font-medium transition-colors select-none",
                    active ? "text-ink font-semibold" : "text-muted-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tabbar-indicator"
                      className="absolute left-1/2 top-0 h-[2.5px] w-7 min-[380px]:w-8 -translate-x-1/2 bg-primary"
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  )}
                  <motion.span whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                    <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                  </motion.span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
