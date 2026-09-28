// Hello World
"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { ReactLenis } from "lenis/react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { ViraWebCredit } from "@/components/brand/viraweb-credit";
import { useMainSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

/*
 * Nova landing PRX no estilo Revolut, em três momentos guiados pela rolagem:
 *   1. Céu azul: título monumental à esquerda, texto, botão de baixar o app e,
 *      no centro, o cartão grande com a foto de uma pessoa e o saldo da conta.
 *   2. A página fixa: o cartão encolhe até o tamanho normal, dois cartões entram
 *      pelas bordas (café e contas da casa), o título sobe e some, um novo título
 *      surge centralizado e o azul vira branco puro.
 *   3. Fundo branco: "Your salary, reimagined", subtítulo, botão preto e três
 *      cartões lado a lado.
 * Tudo é ligado à rolagem (nada se move sozinho) com molas stiffness 300 / damping 28.
 */

/** Retrato do cartão principal. Se a imagem remota falhar, entra um retrato ilustrado. */
export const LANDING_PORTRAIT = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80";

const SPRING = { stiffness: 300, damping: 28, mass: 0.6 } as const;
/** A partir de 1024px o título fica ao lado do cartão; abaixo disso, empilhado. */
const DESKTOP = "(min-width: 1024px)";

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  };
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => true,
  );
}

/** Botão de baixar o app: instala o PWA quando o navegador oferece; senão abre o app. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return event;
}

function DownloadButton({ appUrl, tone = "ink", className }: { appUrl: string; tone?: "ink" | "light"; className?: string }) {
  const install = useInstallPrompt();
  return (
    <a
      href={appUrl}
      onClick={(e) => {
        if (!install) return;
        e.preventDefault();
        void install.prompt();
      }}
      className={cn(
        "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-[transform,opacity] duration-150 active:scale-[0.98]",
        tone === "ink"
          ? "bg-[#0b0b10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-12px_rgba(11,11,16,0.6)] hover:opacity-90"
          : "glass-chip text-[#0b0b10]",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v11" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      Baixar o app
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Cabeçalho                                                                  */
/* -------------------------------------------------------------------------- */

const NAV = [
  { href: "#salario", label: "Bank" },
  { href: "#salario", label: "Pass" },
  { href: "#salario", label: "Live" },
];

function Header({ appUrl }: { appUrl: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-4 sm:pt-3">
      <div className="glass-bar mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 rounded-[22px] pl-4 pr-1.5 sm:h-16 sm:pl-6 sm:pr-2">
        <a href="#topo" className="flex min-h-11 cursor-pointer items-center" aria-label="PRX — início">
          <PrxLogo variant="compact" title="" className="h-6 w-auto text-[#0b0b10] sm:h-7" />
        </a>
        <nav aria-label="Menu principal" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[15px] font-medium text-[#3d3d48] transition-colors hover:bg-black/[0.05] hover:text-[#0b0b10]"
            >
              {item.label}
            </a>
          ))}
          <a
            href={`${appUrl.replace(/\/$/, "")}/sou-pai`}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[15px] font-medium text-[#3d3d48] transition-colors hover:bg-black/[0.05] hover:text-[#0b0b10]"
          >
            Sou Pai
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <a
            href={`${appUrl.replace(/\/$/, "")}/sou-pai`}
            className="inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full px-2.5 text-[14px] font-medium text-[#3d3d48] transition-colors hover:bg-black/[0.05] min-[360px]:px-3.5 md:hidden"
          >
            Sou Pai
          </a>
          <a
            href={appUrl}
            className="inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full bg-[#0b0b10] px-4 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 min-[360px]:px-5"
          >
            Entrar
          </a>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Cartões                                                                    */
/* -------------------------------------------------------------------------- */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Portrait() {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // Se a foto falhou antes da hidratação, o onError não dispara: confere ao montar.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#c9b3ff_0%,#8a47f5_45%,#3b0896_100%)]">
        <svg viewBox="0 0 300 400" className="absolute inset-x-0 bottom-0 h-[82%] w-full text-white/25" fill="currentColor" preserveAspectRatio="xMidYMax meet">
          <circle cx="150" cy="140" r="66" />
          <path d="M30 400c0-78 54-138 120-138s120 60 120 138z" />
        </svg>
      </div>
    );
  }
  return (
    // Foto remota, recortada pelo próprio CDN; sem otimização do Next para não depender do servidor de imagens.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imgRef} src={LANDING_PORTRAIT} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" onError={() => setFailed(true)} />
  );
}

/*
 * Os cartões mudam de tamanho com a tela e com a animação; o conteúdo acompanha
 * em unidades do contêiner (cqw), mantendo a mesma proporção do celular ao desktop.
 */

/** Cartão principal: retrato em tela cheia e o saldo em vidro fosco. */
function HeroCard() {
  return (
    // O @container fica no invólucro: cqw no próprio elemento mediria o contêiner de fora.
    <div className="@container w-full">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[9cqw] bg-[#e9e3ff] shadow-[0_2px_6px_rgba(22,12,52,0.08),0_40px_80px_-36px_rgba(22,12,52,0.55)]">
        <Portrait />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(10,6,30,0.45)_100%)]" />
        <div className="glass-chip absolute left-1/2 top-[4.5cqw] flex max-w-[92%] -translate-x-1/2 items-center gap-[2cqw] whitespace-nowrap rounded-full py-[1.4cqw] pl-[1.4cqw] pr-[3.4cqw] text-[clamp(9px,3.1cqw,13px)] font-medium text-[#0b0b10]">
          <span aria-hidden className="flex h-[max(16px,6cqw)] w-[max(16px,6cqw)] shrink-0 items-center justify-center rounded-full bg-[#0f7b4f] text-white">
            <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="m5 12 7 7 7-7" />
            </svg>
          </span>
          <span className="truncate">Pix recebido · + {brl.format(1250)}</span>
        </div>
        <div className="glass absolute inset-x-[3.5cqw] bottom-[3.5cqw] rounded-[6.5cqw] p-[4.8cqw] text-[#0b0b10]">
          <p className="text-[clamp(8px,2.7cqw,11px)] font-semibold uppercase tracking-[0.08em] text-[#3d3d48]">Conta PRX Bank</p>
          <p className="mt-[1.4cqw] whitespace-nowrap text-[10.5cqw] font-normal leading-none tracking-[-0.04em] tabular-nums">
            R$ 3.482<span className="text-[#8a8a96]">,</span>90
          </p>
          <p className="mt-[2.2cqw] text-[clamp(10px,3.1cqw,13px)] leading-snug text-[#3d3d48] @max-[300px]:hidden">Saldo disponível · rende PRX Coins a cada compra em parceiro</p>
        </div>
      </div>
    </div>
  );
}

function SideCard({ title, meta, amount, footer, visual }: { title: string; meta: string; amount: number; footer: ReactNode; visual: ReactNode }) {
  return (
    <div className="@container w-full">
      <div className="glass flex aspect-[3/4] w-full flex-col justify-between rounded-[11cqw] p-[7cqw] text-[#0b0b10]">
        <div className="flex items-start justify-between gap-[4cqw]">
          <div className="min-w-0">
            <p className="truncate text-[clamp(11px,6.4cqw,17px)] font-semibold tracking-[-0.01em]">{title}</p>
            <p className="mt-0.5 truncate text-[clamp(9px,4.9cqw,13px)] text-[#5b5b66]">{meta}</p>
          </div>
          {visual}
        </div>
        <div>
          <p className="whitespace-nowrap text-[12cqw] font-normal leading-none tracking-[-0.04em] tabular-nums">− {brl.format(amount)}</p>
          <div className="mt-[4.5cqw] text-[clamp(9px,4.9cqw,13px)] text-[#3d3d48]">{footer}</div>
        </div>
      </div>
    </div>
  );
}

function CafeCard() {
  return (
    <SideCard
      title="Café Aurora"
      meta="Gastronomia · hoje, 08:42"
      amount={18.9}
      visual={
        <span aria-hidden className="flex h-[15cqw] w-[15cqw] shrink-0 items-center justify-center rounded-full bg-[#6c0cf0]/10 text-[#6c0cf0]">
          <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
            <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
          </svg>
        </span>
      }
      footer={<span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#6c0cf0]/10 px-[4cqw] py-[1.6cqw] font-semibold text-[#6c0cf0]">+ 19 PRX Coins</span>}
    />
  );
}

function BillsCard() {
  const bills = [
    { label: "Luz", pct: 38 },
    { label: "Internet", pct: 27 },
    { label: "Streaming", pct: 15 },
  ];
  return (
    <SideCard
      title="Contas da casa"
      meta="Pagas no automático"
      amount={312.4}
      visual={
        <span aria-hidden className="flex h-[15cqw] w-[15cqw] shrink-0 items-center justify-center rounded-full bg-[#0b0b10]/[0.06] text-[#0b0b10]">
          <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 9-7 9 7" />
            <path d="M5 10v10h14V10" />
          </svg>
        </span>
      }
      footer={
        <ul className="space-y-[2.4cqw]">
          {bills.map((b) => (
            <li key={b.label} className="flex items-center gap-[3cqw]">
              <span className="w-[28cqw] shrink-0 truncate">{b.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                <span className="block h-full rounded-full bg-[#0b0b10]" style={{ width: `${b.pct * 2}%` }} />
              </span>
            </li>
          ))}
        </ul>
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Momentos 1 e 2: seção fixada guiada pela rolagem                           */
/* -------------------------------------------------------------------------- */

function useStage(progress: MotionValue<number>, desktop: boolean) {
  const p = useSpring(progress, SPRING);
  return {
    sky: useTransform(p, [0.3, 0.64], [1, 0]),
    titleY: useTransform(p, [0, 0.32], [0, desktop ? -160 : -110]),
    titleOpacity: useTransform(p, [0.04, 0.28], [1, 0]),
    cardScale: useTransform(p, [0.08, 0.62], [1, desktop ? 0.64 : 0.82]),
    cardX: useTransform(p, [0.08, 0.62], desktop ? ["17vw", "0vw"] : ["0vw", "0vw"]),
    cardY: useTransform(p, [0.08, 0.62], desktop ? ["0dvh", "0dvh"] : ["16dvh", "0dvh"]),
    leftX: useTransform(p, [0.4, 0.8], ["-75vw", "0vw"]),
    rightX: useTransform(p, [0.4, 0.8], ["75vw", "0vw"]),
    sideOpacity: useTransform(p, [0.4, 0.62], [0, 1]),
    newTitleOpacity: useTransform(p, [0.5, 0.74], [0, 1]),
    newTitleY: useTransform(p, [0.5, 0.74], [48, 0]),
  };
}

function PinnedStory({ appUrl }: { appUrl: string }) {
  const ref = useRef<HTMLElement>(null);
  const desktop = useMedia(DESKTOP);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const s = useStage(scrollYProgress, desktop);

  return (
    <section ref={ref} id="topo" aria-label="Banking & Beyond" className="relative h-[300dvh] lg:h-[320dvh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-white">
        {/* Céu azul que se dissolve no branco puro */}
        <motion.div aria-hidden style={{ opacity: s.sky }} className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#5fb4f0_0%,#8fcbf7_38%,#c4e5fc_72%,#eaf6ff_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(40rem_16rem_at_18%_78%,rgba(255,255,255,0.75),transparent_70%),radial-gradient(34rem_14rem_at_82%_88%,rgba(255,255,255,0.7),transparent_70%),radial-gradient(28rem_10rem_at_62%_20%,rgba(255,255,255,0.35),transparent_70%)]" />
        </motion.div>

        {/* Momento 1: título monumental à esquerda */}
        <motion.div
          style={{ y: s.titleY, opacity: s.titleOpacity }}
          className="absolute inset-x-0 top-[84px] z-20 mx-auto w-full max-w-[1200px] px-5 sm:top-[104px] sm:px-8 lg:top-1/2 lg:-translate-y-1/2"
        >
          <div className="max-w-[600px]">
            <h1 className="text-[clamp(52px,13vw,84px)] font-semibold leading-[0.9] tracking-[-0.055em] text-[#0b0b10] lg:text-[clamp(84px,8.6vw,136px)]">
              Banking
              <br />&amp; Beyond
            </h1>
            <p className="mt-4 max-w-[440px] text-[16px] leading-relaxed text-[#1c2a3a] sm:mt-6 sm:text-[18px]">
              Conta digital, cartão, Pix e benefícios em um só app. Cada compra em parceiro vira PRX Coins.
            </p>
            <DownloadButton appUrl={appUrl} className="mt-5 sm:mt-8" />
          </div>
        </motion.div>

        {/* Momento 2: novo título centralizado */}
        <motion.div
          style={{ opacity: s.newTitleOpacity, y: s.newTitleY }}
          className="pointer-events-none absolute inset-x-0 top-[92px] z-20 px-5 text-center sm:top-[112px] lg:top-[13dvh]"
        >
          <h2 className="mx-auto max-w-[820px] text-[clamp(34px,8vw,56px)] font-semibold leading-[0.98] tracking-[-0.045em] text-[#0b0b10] lg:text-[clamp(56px,5.4vw,80px)]">
            Spend smarter.
          </h2>
          <p className="mx-auto mt-3 max-w-[480px] text-[15px] leading-relaxed text-[#5b5b66] sm:text-[17px]">
            Do café às contas da casa: cada gasto cai no nicho certo do PRX Map, e o que é parceiro volta como coins.
          </p>
        </motion.div>

        {/* Fileira de cartões: o central encolhe, os laterais entram pelas bordas */}
        {/* --c: largura do cartão central · --s: escala final · --side: largura dos laterais · --gap: respiro entre eles */}
        <div className="absolute inset-x-0 top-[58%] z-10 [--c:58vw] [--gap:12px] [--s:0.82] [--side:46vw] max-[380px]:[--c:50vw] sm:[--c:40vw] sm:[--side:32vw] lg:top-[56%] lg:[--c:400px] lg:[--gap:24px] lg:[--s:0.64] lg:[--side:256px] xl:[--c:420px] xl:[--side:269px]">
          <motion.div
            style={{ x: s.leftX, opacity: s.sideOpacity }}
            className="absolute left-[calc(50%_-_var(--c)*var(--s)/2_-_var(--gap)_-_var(--side))] top-0 w-[var(--side)] -translate-y-1/2"
          >
            <CafeCard />
          </motion.div>
          <motion.div style={{ x: s.cardX, y: s.cardY, scale: s.cardScale }} className="absolute left-1/2 top-0 w-[var(--c)] -translate-x-1/2 -translate-y-1/2">
            <HeroCard />
          </motion.div>
          <motion.div
            style={{ x: s.rightX, opacity: s.sideOpacity }}
            className="absolute left-[calc(50%_+_var(--c)*var(--s)/2_+_var(--gap))] top-0 w-[var(--side)] -translate-y-1/2"
          >
            <BillsCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Momento 3: fundo branco, três cartões lado a lado                          */
/* -------------------------------------------------------------------------- */

const rise = {
  hidden: { opacity: 0, y: 36 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28, delay: i * 0.08 } }),
};

function SalaryCards() {
  return (
    <ul className="mt-12 grid gap-4 text-left sm:mt-16 md:grid-cols-3 md:gap-5">
      <motion.li custom={0} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
        <article className="prx-holo flex aspect-[5/4] flex-col justify-between rounded-[32px] md:aspect-[4/5] p-6 sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85">Salário e mesada</p>
          <div>
            <p className="text-[40px] font-normal leading-none tracking-[-0.045em] tabular-nums sm:text-[48px]">+ {brl.format(2150)}</p>
            <p className="mt-3 max-w-[260px] text-[15px] leading-relaxed text-white/85">Caiu, está disponível. Pix na hora, 24 horas por dia, sem tarifa.</p>
          </div>
        </article>
      </motion.li>
      <motion.li custom={1} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
        <article className="prx-metal flex aspect-[5/4] flex-col justify-between rounded-[32px] md:aspect-[4/5] p-6 text-[#0b0b10] sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3d3d48]">PRX Coins</p>
          <div>
            <p className="text-[40px] font-normal leading-none tracking-[-0.045em] tabular-nums sm:text-[48px]">+ 120 coins</p>
            <p className="mt-3 max-w-[260px] text-[15px] leading-relaxed text-[#3d3d48]">Cada Pix em parceiro PRX é reconhecido sozinho e vira coins e XP.</p>
          </div>
        </article>
      </motion.li>
      <motion.li custom={2} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
        <article className="glass flex aspect-[5/4] flex-col justify-between rounded-[32px] md:aspect-[4/5] p-6 text-[#0b0b10] sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3d3d48]">PRX Pass</p>
          <div>
            <p className="text-[40px] font-normal leading-none tracking-[-0.045em] text-[#6c0cf0] sm:text-[48px]">−30%</p>
            <p className="mt-3 max-w-[260px] text-[15px] leading-relaxed text-[#3d3d48]">Troque coins por descontos reais em marcas parceiras. Mostre o QR no balcão.</p>
          </div>
        </article>
      </motion.li>
    </ul>
  );
}

function SalarySection({ appUrl }: { appUrl: string }) {
  return (
    <section id="salario" aria-labelledby="salary-title" className="relative scroll-mt-24 bg-white px-5 pb-24 pt-10 sm:px-8 sm:pb-32">
      <div className="mx-auto max-w-[1200px] text-center">
        <motion.h2
          id="salary-title"
          variants={rise}
          custom={0}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
          className="mx-auto max-w-[900px] text-[clamp(40px,9vw,56px)] font-semibold leading-[0.95] tracking-[-0.05em] text-[#0b0b10] md:text-[clamp(56px,6.4vw,96px)]"
        >
          Your salary, reimagined
        </motion.h2>
        <motion.p
          variants={rise}
          custom={1}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
          className="mx-auto mt-5 max-w-[560px] text-[16px] leading-relaxed text-[#5b5b66] sm:text-[19px]"
        >
          Receba no PRX Bank, acompanhe cada real no PRX Map e transforme o que você já gasta em benefícios, eventos e experiências.
        </motion.p>
        <motion.div variants={rise} custom={2} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }} className="mt-8 flex justify-center">
          <a
            href={appUrl}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[#0b0b10] px-7 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-12px_rgba(11,11,16,0.6)] transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            Abrir minha conta
          </a>
        </motion.div>
        <SalaryCards />
      </div>
    </section>
  );
}

function Footer({ appUrl }: { appUrl: string }) {
  const base = appUrl.replace(/\/$/, "");
  return (
    <footer className="border-t border-black/[0.06] bg-white px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 text-[13px] text-[#5b5b66] md:flex-row md:items-center md:justify-between">
        <PrxLogo variant="compact" title="PRX" className="h-6 w-auto text-[#0b0b10]" />
        <nav aria-label="Documentos" className="flex flex-wrap gap-x-5 gap-y-1">
          <a href={`${base}/termos`} className="inline-flex min-h-10 cursor-pointer items-center hover:text-[#0b0b10]">
            Termos de Uso
          </a>
          <a href={`${base}/privacidade`} className="inline-flex min-h-10 cursor-pointer items-center hover:text-[#0b0b10]">
            Política de Privacidade
          </a>
          <a href={`${base}/sou-pai`} className="inline-flex min-h-10 cursor-pointer items-center hover:text-[#0b0b10]">
            Sou Pai
          </a>
        </nav>
        <ViraWebCredit className="md:justify-end" />
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                     */
/* -------------------------------------------------------------------------- */

const REDUCE = "(prefers-reduced-motion: reduce)";

export function RevolutLanding({ preview = false }: { preview?: boolean }) {
  const appUrl = useMainSiteUrl();
  const reduceMotion = useSyncExternalStore(
    subscribeMedia(REDUCE),
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );

  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: !reduceMotion, syncTouch: false }}>
      <div className="prx-rv min-h-dvh overflow-x-clip selection:bg-[#6c0cf0] selection:text-white">
        <Header appUrl={appUrl} />
        <main>
          <PinnedStory appUrl={appUrl} />
          <SalarySection appUrl={appUrl} />
        </main>
        <Footer appUrl={appUrl} />
        {preview && (
          <p className="glass-chip fixed bottom-3 right-3 z-50 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-[#3d3d48]">
            Prévia para aprovação · visível só para o admin
          </p>
        )}
      </div>
    </ReactLenis>
  );
}
