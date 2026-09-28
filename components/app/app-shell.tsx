// Hello World
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import type { User } from "@/hooks/use-auth";
import { PrxLogo } from "@/components/brand/prx-logo";
import { IconCommunity, IconHome, IconLogout, IconMore, IconStar, IconWallet } from "@/components/icons/prx-icons";
import { AppNavProvider, useAppNav, type AppTab } from "@/components/app/app-nav";
import { SmoothScroll } from "@/components/app/smooth-scroll";
import { usePassData } from "@/components/app/use-pass-data";
import { useLiveData, usePointsWallet } from "@/components/app/use-prx-stores";
import { NoticesSheet, useNotices } from "@/components/app/notifications";
import { Avatar, initialsOf } from "@/components/app/ui";
import { ReelsScreen } from "@/components/app/screens/reels-screen";
import { CircleLoader } from "@/components/ui/circle-loader";
import { HomeScreen } from "@/components/app/screens/home-screen";
import { PassScreen } from "@/components/app/screens/pass-screen";
import { BankScreen } from "@/components/app/screens/bank-screen";
import { LiveScreen } from "@/components/app/screens/live-screen";
import { ProfileScreen } from "@/components/app/screens/profile-screen";
import { ObsidianBell, ObsidianCrystal, ObsidianDock, type ObsidianDockItem } from "@/components/obsidian/obsidian-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { useThemeScope } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { calculatePrxLevel } from "@/lib/pass-data";

/**
 * Dock de 5 destinos (Cyber-Luxury Obsidian). As abas internas continuam as
 * mesmas (links #bank/pix etc. seguem valendo); o dock só as agrupa:
 * Experiências reúne PASS e LIVE, Comunidade abre os Destaques e Mais é o perfil.
 */
type DockId = "home" | "conta" | "experiencias" | "comunidade" | "mais";

const DOCK: ReadonlyArray<ObsidianDockItem<DockId>> = [
  { id: "home", label: "Início", Icon: IconHome },
  { id: "conta", label: "Conta", Icon: IconWallet },
  { id: "experiencias", label: "Experiências", Icon: IconStar },
  { id: "comunidade", label: "Comunidade", Icon: IconCommunity },
  { id: "mais", label: "Mais", Icon: IconMore },
];

const TAB_OF_DOCK: Record<DockId, AppTab> = { home: "home", conta: "bank", experiencias: "pass", comunidade: "reels", mais: "profile" };

function dockOf(tab: AppTab): DockId {
  if (tab === "bank") return "conta";
  if (tab === "pass" || tab === "live") return "experiencias";
  if (tab === "reels") return "comunidade";
  if (tab === "profile") return "mais";
  return "home";
}

interface AppShellProps {
  user: User;
  onLogout: () => void;
  onViewShowcase: () => void;
  /** Aviso da conta (ex.: menor aguardando o responsável), acima do conteúdo de todas as abas. */
  notice?: ReactNode;
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

/** true depois que a página rola: o cabeçalho transparente ganha o vidro fumê. */
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

function ShellLayout({ user, onLogout, onViewShowcase, notice }: AppShellProps) {
  useThemeScope("app");
  const { tab, go } = useAppNav();
  const pass = usePassData(user);
  const { data: live } = useLiveData(user.id);
  const { wallet: points } = usePointsWallet(user.id);
  const notices = useNotices(pass, live?.wallet ?? null, points);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const lenis = useLenis();
  const previousTab = useRef(tab);
  const scrolled = useScrolled();

  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    setIsTabLoading(true);
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0 });
    const timer = setTimeout(() => {
      setIsTabLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [tab, lenis]);

  const member = pass.member;
  const name = member.name || "Membro PRX";
  const level = points?.level ?? member.prxLevel ?? calculatePrxLevel(member.prxScore ?? 0);
  const immersive = tab === "reels";
  const activeDock = dockOf(tab);
  const selectDock = (id: DockId) => {
    // Experiências lembra se a pessoa estava no LIVE.
    if (id === "experiencias" && (tab === "pass" || tab === "live")) return;
    go(TAB_OF_DOCK[id]);
  };

  return (
    <div className="prx-app relative isolate min-h-dvh overflow-x-clip bg-background text-foreground">
      {/* Luz volumétrica (cobalto e violeta) atrás do vidro fumê. */}
      <div aria-hidden className="prx-ambient" />
      {/* Escultura de cristal no canto superior direito da Início, fundida ao breu. */}
      {tab === "home" && (
        <ObsidianCrystal
          priority
          sizes="(min-width: 1024px) 50vw, 88vw"
          className="absolute -right-[22%] top-0 z-0 hidden h-[430px] w-[88vw] dark:block sm:-right-[8%] sm:h-[560px] sm:w-[62vw] lg:right-0 lg:h-[700px] lg:w-[46vw] lg:opacity-90"
        />
      )}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-background"
      >
        Pular para o conteúdo
      </a>

      {/* Trilho lateral (desktop): vidro fumê flutuante com os mesmos 5 destinos do dock */}
      <aside className="glass-bar fixed inset-y-3 left-3 z-40 hidden w-[232px] flex-col rounded-[28px] px-3 py-7 lg:flex">
        <button type="button" onClick={() => go("home")} className="cursor-pointer self-start px-3" aria-label="PRX — ir para o início">
          <PrxLogo variant="compact" title="" className="h-7 w-auto text-ink" />
        </button>

        <nav aria-label="Seções do app" className="mt-12 flex flex-col gap-1">
          {DOCK.map(({ id, label, Icon }) => {
            const active = activeDock === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectDock(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 cursor-pointer items-center gap-3.5 rounded-[18px] px-4 transition-colors",
                  active ? "text-ink" : "text-muted-foreground hover:bg-surface hover:text-ink"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="rail-pill"
                    className="absolute inset-0 rounded-[18px] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(22,12,52,0.06),0_8px_18px_-10px_rgba(22,12,52,0.28)] dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                )}
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 1.9 : 1.5} />
                  {active && <span aria-hidden className="absolute -right-1.5 -top-1 h-1.5 w-1.5 rounded-full bg-[#9468fa] shadow-[0_0_8px_rgba(148,104,250,0.95)]" />}
                </span>
                <span className="ob-label relative text-[12px] tracking-[0.16em]">{label}</span>
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

      <div className="relative z-10 lg:pl-64">
        {/* Cabeçalho minimalista: marca · sino com ponto violeta · avatar. Transparente no topo,
            vidro fumê depois que a página rola. */}
        <header className="sticky top-0 z-30 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 lg:px-9 lg:pt-3">
          <div
            className={cn(
              "mx-auto flex h-16 w-full max-w-[1096px] items-center justify-between gap-2 rounded-[22px] border border-transparent pl-3 pr-1.5 transition-[background-color,border-color,box-shadow] duration-300 lg:pl-4",
              scrolled && "glass-bar"
            )}
          >
            <button type="button" onClick={() => go("home")} className="flex min-h-12 shrink-0 cursor-pointer items-center lg:invisible" aria-label="PRX — ir para o início">
              <PrxLogo variant="compact" title="" className="h-7 w-auto text-ink" />
            </button>
            <div className="flex min-w-0 items-center gap-1.5">
              <ObsidianBell count={notices.length} onClick={() => setNoticesOpen(true)} />
              <button
                type="button"
                onClick={() => go("profile")}
                aria-current={tab === "profile" ? "page" : undefined}
                aria-label={`Perfil de ${name}, nível ${level}`}
                className={cn(
                  "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full transition-shadow",
                  tab === "profile" && "ring-2 ring-primary/60"
                )}
              >
                <Avatar name={name} src={member.avatarUrl} size={44} className="ring-1 ring-black/10 dark:ring-white/[0.18]" />
              </button>
            </div>
          </div>
        </header>

        <main id="conteudo" className="overflow-x-hidden">
          <div
            className={cn(
              "mx-auto w-full max-w-[1120px]",
              immersive ? "px-0 pb-[calc(78px+max(0.5rem,env(safe-area-inset-bottom)))] sm:px-6 lg:px-12 lg:pb-6" : "px-4 pb-36 pt-2 sm:px-6 lg:px-12 lg:pb-20 lg:pt-4"
            )}
          >
            {notice && !immersive && <div className="mb-6">{notice}</div>}
            {activeDock === "experiencias" && <ExperienceSwitch tab={tab} onChange={(next) => go(next)} />}
            {isTabLoading ? (
              <CircleLoader minHeight={380} label="Carregando janela..." />
            ) : (
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
            )}
          </div>
        </main>
      </div>

      {/* Floating Bottom Navigation Dock (mobile e tablet) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <ObsidianDock items={DOCK} active={activeDock} onSelect={selectDock} className="pointer-events-auto mx-auto max-w-lg" />
      </div>

      <NoticesSheet open={noticesOpen} onClose={() => setNoticesOpen(false)} notices={notices} onGo={go} />
    </div>
  );
}

/** Experiências = PRX PASS + PRX LIVE: alternância em pílula acima da tela. */
function ExperienceSwitch({ tab, onChange }: { tab: AppTab; onChange: (tab: "pass" | "live") => void }) {
  const options = [
    { value: "pass" as const, label: "PRX PASS" },
    { value: "live" as const, label: "PRX LIVE" },
  ];
  return (
    <div role="group" aria-label="Experiências" className="glass-chip mb-7 inline-grid grid-cols-2 rounded-full p-1">
      {options.map(({ value, label }) => {
        const active = tab === value;
        return (
          <button
            key={value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(value)}
            className={cn("ob-label relative min-h-11 cursor-pointer rounded-full px-5 text-[11px] tracking-[0.16em] transition-colors", active ? "text-ink" : "text-muted-foreground hover:text-ink")}
          >
            {active && (
              <motion.span
                layoutId="experience-pill"
                className="absolute inset-0 rounded-full bg-card shadow-[0_1px_2px_rgba(22,12,52,0.08)] dark:bg-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
