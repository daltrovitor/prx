// Hello World
"use client";

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import type { User } from "@/hooks/use-auth";
import { PrxLogo } from "@/components/brand/prx-logo";
import { IconBank, IconBell, IconHome, IconLive, IconLogout, IconPass, IconQr, IconReels } from "@/components/icons/prx-icons";
import { AppNavProvider, useAppNav, type AppTab } from "@/components/app/app-nav";
import { SmoothScroll } from "@/components/app/smooth-scroll";
import { usePassData, firstName } from "@/components/app/use-pass-data";
import { useLiveData, usePointsWallet } from "@/components/app/use-prx-stores";
import { NoticesSheet, useNotices } from "@/components/app/notifications";
import { Avatar, IconButton, initialsOf } from "@/components/app/ui";
import { ReelsScreen } from "@/components/app/screens/reels-screen";
import { ViraWebCredit } from "@/components/brand/viraweb-credit";
import { HomeScreen } from "@/components/app/screens/home-screen";
import { PassScreen } from "@/components/app/screens/pass-screen";
import { BankScreen } from "@/components/app/screens/bank-screen";
import { LiveScreen } from "@/components/app/screens/live-screen";
import { ProfileScreen } from "@/components/app/screens/profile-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { useThemeScope } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { calculatePrxLevel } from "@/lib/pass-data";

interface NavItem {
  tab: AppTab;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Brilho suave para chamar atenção (aba Destaques). */
  shine?: boolean;
}

/** Barra de abas: Destaques fica exatamente no meio, entre Pass e Bank. O Perfil vive no cabeçalho. */
const NAV: ReadonlyArray<NavItem> = [
  { tab: "home", label: "Início", Icon: IconHome },
  { tab: "pass", label: "Pass", Icon: IconPass },
  { tab: "reels", label: "Destaques", Icon: IconReels, shine: true },
  { tab: "bank", label: "Bank", Icon: IconBank },
  { tab: "live", label: "Live", Icon: IconLive },
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

function ShellLayout({ user, onLogout, onViewShowcase }: AppShellProps) {
  useThemeScope("app");
  const { tab, go } = useAppNav();
  const pass = usePassData(user);
  const { data: live } = useLiveData(user.id);
  const { wallet: points } = usePointsWallet(user.id);
  const notices = useNotices(pass, live?.wallet ?? null, points);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const lenis = useLenis();
  const previousTab = useRef(tab);

  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0 });
  }, [tab, lenis]);

  const member = pass.member;
  const name = member.name || "Membro PRX";
  const level = points?.level ?? member.prxLevel ?? calculatePrxLevel(member.prxScore ?? 0);
  const immersive = tab === "reels";

  return (
    <div className="prx-app isolate min-h-dvh bg-background text-foreground">
      {/* Luz ambiente discreta atrás do vidro; o fundo continua branco. */}
      <div aria-hidden className="prx-ambient" />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-background"
      >
        Pular para o conteúdo
      </a>

      {/* Trilho lateral (desktop): painel de vidro flutuante */}
      <aside className="glass-bar fixed inset-y-3 left-3 z-40 hidden w-[232px] flex-col rounded-[28px] px-3 py-6 lg:flex">
        <button type="button" onClick={() => go("home")} className="cursor-pointer self-start px-3" aria-label="PRX — ir para o início">
          <PrxLogo variant="compact" title="" className="h-7 w-auto text-ink" />
        </button>

        <nav aria-label="Seções do app" className="mt-10 flex flex-col gap-1">
          {NAV.map(({ tab: itemTab, label, Icon, shine }) => {
            const active = tab === itemTab;
            return (
              <button
                key={itemTab}
                type="button"
                onClick={() => go(itemTab)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-[18px] px-4 text-[15px] transition-colors",
                  active ? "font-semibold text-ink" : "text-muted-foreground hover:bg-surface hover:text-ink"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-pill"
                    className="absolute inset-0 rounded-[18px] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(22,12,52,0.06),0_8px_18px_-10px_rgba(22,12,52,0.28)] dark:bg-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                )}
                <span className={cn("relative", active && "text-primary", shine && "prx-glow")}>
                  <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
                </span>
                <span
                  className={cn("relative", shine && "prx-sheen")}
                  style={shine ? ({ "--sheen-base": active ? "var(--ink)" : "var(--muted-foreground)" } as CSSProperties) : undefined}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <ThemeToggle variant="app" showLabel className="w-full justify-start" />
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
          >
            <IconLogout size={18} />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Cabeçalho em cápsula de vidro: marca (mobile) ou saudação (desktop) · QR · avisos · perfil.
            O conteúdo rola por baixo e aparece desfocado. Altura total: 72px (mobile) e 96px (desktop). */}
        <header className="sticky top-0 z-30 px-2 py-2 sm:px-4 lg:px-9 lg:py-3">
          <div className="glass-bar mx-auto flex h-14 w-full max-w-[1096px] items-center justify-between gap-2 rounded-[22px] pl-4 pr-1.5 lg:h-[72px] lg:rounded-[26px] lg:pl-6 lg:pr-3">
            <button type="button" onClick={() => go("home")} className="flex min-h-12 shrink-0 cursor-pointer items-center lg:hidden" aria-label="PRX — ir para o início">
              <PrxLogo variant="compact" title="" className="h-6 w-auto text-ink" />
            </button>
            <p className="hidden text-[20px] font-semibold tracking-[-0.02em] text-ink lg:block">Olá, {firstName(member)}</p>
            <div className="flex min-w-0 items-center gap-2">
              <IconButton label="Meus QR Codes" onClick={() => go("pass", "vouchers")} className="h-11 w-11 lg:h-12 lg:w-12">
                <IconQr size={19} />
              </IconButton>
              <IconButton label="Avisos" badge={notices.length} onClick={() => setNoticesOpen(true)} className="h-11 w-11 lg:h-12 lg:w-12">
                <IconBell size={19} />
              </IconButton>
              <button
                type="button"
                onClick={() => go("profile")}
                aria-current={tab === "profile" ? "page" : undefined}
                aria-label={`Perfil de ${name}, nível ${level}`}
                className={cn(
                  "flex h-11 min-w-11 max-w-[190px] shrink cursor-pointer items-center gap-2.5 rounded-full p-1 text-left transition-colors min-[380px]:pr-4 lg:h-12",
                  tab === "profile" ? "bg-primary/[0.1] ring-1 ring-primary/20" : "glass-chip"
                )}
              >
                <Avatar name={name} src={member.avatarUrl} size={36} />
                <span className="hidden min-w-0 min-[380px]:block">
                  <span className="block truncate text-[14px] font-semibold leading-tight text-ink">{firstName(member)}</span>
                  <span className="block truncate text-[12px] leading-tight text-muted-foreground">Nível {level.toLocaleString("pt-BR")}</span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <main id="conteudo" className="overflow-x-hidden">
          <div
            className={cn(
              "mx-auto w-full max-w-[1120px]",
              immersive ? "px-0 pb-[calc(62px+max(0.5rem,env(safe-area-inset-bottom)))] sm:px-6 lg:px-12 lg:pb-6" : "px-4 pb-32 pt-3 sm:px-6 lg:px-12 lg:pb-20 lg:pt-4"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {tab === "home" && <HomeScreen pass={pass} />}
                {tab === "pass" && <PassScreen pass={pass} />}
                {tab === "reels" && <ReelsScreen member={member} />}
                {tab === "bank" && <BankScreen member={member} />}
                {tab === "live" && <LiveScreen member={member} />}
                {tab === "profile" && <ProfileScreen pass={pass} onLogout={onLogout} onViewShowcase={onViewShowcase} initials={initialsOf(name)} />}
              </motion.div>
            </AnimatePresence>
            {!immersive && <ViraWebCredit className="mt-14" />}
          </div>
        </main>
      </div>

      {/* Barra de abas inferior (mobile e tablet): cápsula de vidro flutuante, 62px + margem segura */}
      <nav aria-label="Seções do app" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <ul className="glass-bar pointer-events-auto mx-auto grid h-[62px] max-w-lg grid-cols-5 rounded-[26px] px-1">
          {NAV.map(({ tab: itemTab, label, Icon, shine }) => {
            const active = tab === itemTab;
            return (
              <li key={itemTab}>
                <button
                  type="button"
                  onClick={() => go(itemTab)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors select-none",
                    active ? "font-semibold text-ink" : "text-muted-foreground"
                  )}
                >
                  <span className="relative flex h-8 w-[52px] items-center justify-center">
                    {active && (
                      <motion.span
                        layoutId="tabbar-pill"
                        className="absolute inset-0 rounded-full bg-primary/[0.1]"
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      />
                    )}
                    <motion.span
                      className={cn("relative", active && "text-primary", shine && "prx-glow")}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    >
                      <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                    </motion.span>
                  </span>
                  <span
                    className={cn(shine && "prx-sheen")}
                    style={shine ? ({ "--sheen-base": active ? "var(--ink)" : "var(--muted-foreground)" } as CSSProperties) : undefined}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <NoticesSheet open={noticesOpen} onClose={() => setNoticesOpen(false)} notices={notices} onGo={go} />
    </div>
  );
}
