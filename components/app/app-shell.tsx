// Hello World
"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
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
}

/** Barra de abas: Reels fica exatamente no meio, entre Pass e Bank. O Perfil vive no cabeçalho. */
const NAV: ReadonlyArray<NavItem> = [
  { tab: "home", label: "Início", Icon: IconHome },
  { tab: "pass", label: "Pass", Icon: IconPass },
  { tab: "reels", label: "Reels", Icon: IconReels },
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
    <div className="prx-app min-h-dvh bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-background"
      >
        Pular para o conteúdo
      </a>

      {/* Trilho lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-card px-4 py-7 lg:flex">
        <button type="button" onClick={() => go("home")} className="cursor-pointer self-start px-3" aria-label="PRX — ir para o início">
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
                  "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 text-[15px] transition-colors",
                  active ? "font-semibold text-ink" : "text-muted-foreground hover:bg-surface hover:text-ink"
                )}
              >
                {active && (
                  <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-2xl bg-surface" transition={{ type: "spring", stiffness: 300, damping: 28 }} />
                )}
                <span className={cn("relative", active && "text-primary")}>
                  <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
                </span>
                <span className="relative">{label}</span>
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
        {/* Cabeçalho: marca (mobile) ou título da seção (desktop) · QR · avisos · perfil */}
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center justify-between gap-2 px-4 sm:px-6 lg:h-24 lg:px-12">
            <button type="button" onClick={() => go("home")} className="flex min-h-12 shrink-0 cursor-pointer items-center lg:hidden" aria-label="PRX — ir para o início">
              <PrxLogo variant="compact" title="" className="h-6 w-auto text-ink" />
            </button>
            <p className="hidden text-[22px] font-semibold tracking-[-0.02em] text-ink lg:block">Olá, {firstName(member)}</p>
            <div className="flex min-w-0 items-center gap-2">
              <IconButton label="Meus QR Codes" onClick={() => go("pass", "vouchers")} className="h-12 w-12">
                <IconQr size={19} />
              </IconButton>
              <IconButton label="Avisos" badge={notices.length} onClick={() => setNoticesOpen(true)} className="h-12 w-12">
                <IconBell size={19} />
              </IconButton>
              <button
                type="button"
                onClick={() => go("profile")}
                aria-current={tab === "profile" ? "page" : undefined}
                aria-label={`Perfil de ${name}, nível ${level}`}
                className={cn(
                  "flex h-12 min-w-12 max-w-[190px] shrink cursor-pointer items-center gap-2.5 rounded-full p-1 text-left transition-colors min-[380px]:pr-4",
                  tab === "profile" ? "bg-primary/[0.1]" : "bg-surface hover:bg-line"
                )}
              >
                <Avatar name={name} src={member.avatarUrl} size={40} />
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
              immersive ? "px-0 pb-[calc(62px+max(0.25rem,env(safe-area-inset-bottom)))] sm:px-6 lg:px-12 lg:pb-6" : "px-4 pb-32 pt-3 sm:px-6 lg:px-12 lg:pb-20 lg:pt-2"
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
          </div>
        </main>
      </div>

      {/* Barra de abas inferior (mobile e tablet) */}
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
                    "flex h-[62px] w-full cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors select-none",
                    active ? "font-semibold text-ink" : "text-muted-foreground"
                  )}
                >
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active && (
                      <motion.span
                        layoutId="tabbar-pill"
                        className="absolute inset-0 rounded-full bg-primary/[0.1]"
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      />
                    )}
                    <motion.span
                      className={cn("relative", active && "text-primary")}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                    </motion.span>
                  </span>
                  {label}
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
