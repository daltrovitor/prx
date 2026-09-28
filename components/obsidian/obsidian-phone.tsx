// Hello World
"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import {
  isMotionValue,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { cn } from "@/lib/utils";
import {
  IconArrowRight,
  IconBarcode,
  IconChevronRight,
  IconCommunity,
  IconHome,
  IconMore,
  IconPaperPlane,
  IconPixDiamonds,
  IconReceive,
  IconSend,
  IconStar,
  IconWallet,
} from "@/components/icons/prx-icons";
import {
  OBSIDIAN_IMAGES,
  OBSIDIAN_PILLARS,
  ObsidianAvatarStack,
  ObsidianBalanceCard,
  ObsidianBell,
  ObsidianCrystal,
  ObsidianDock,
  ObsidianEventCard,
  ObsidianGreeting,
  ObsidianPillarCard,
  ObsidianSectionHeader,
  type ObsidianAction,
  type ObsidianDockItem,
  type PillarId,
} from "@/components/obsidian/obsidian-ui";

/* -------------------------------------------------------------------------- */
/* Geometria do aparelho                                                      */
/* -------------------------------------------------------------------------- */

/** Chassi 372×762 (proporção de um smartphone de 6,1"); a tela desenha o app em 390pt de largura. */
export const PHONE = { width: 372, height: 762, frame: 3, bezel: 9, radius: 60 } as const;
const SCREEN_W = PHONE.width - 2 * (PHONE.frame + PHONE.bezel);
const SCREEN_H = PHONE.height - 2 * (PHONE.frame + PHONE.bezel);
export const APP_WIDTH = 390;
const APP_SCALE = SCREEN_W / APP_WIDTH;
export const APP_HEIGHT = Math.round(SCREEN_H / APP_SCALE);

/** Camadas da lateral de titânio: dão espessura real quando o aparelho gira. */
const EDGE_LAYERS = [1, 2, 3, 4, 5, 6, 7, 8];

/* -------------------------------------------------------------------------- */
/* App de demonstração (a tela viva do PRX)                                   */
/* -------------------------------------------------------------------------- */

type PhoneTab = "home" | "conta" | "experiencias" | "comunidade" | "mais";

const PHONE_DOCK: ReadonlyArray<ObsidianDockItem<PhoneTab>> = [
  { id: "home", label: "Início", Icon: IconHome },
  { id: "conta", label: "Conta", Icon: IconWallet },
  { id: "experiencias", label: "Experiências", Icon: IconStar },
  { id: "comunidade", label: "Comunidade", Icon: IconCommunity },
  { id: "mais", label: "Mais", Icon: IconMore },
];

const DEMO = {
  name: "Rafael",
  balance: 12430.25,
  friends: [
    { initials: "MA", tone: "linear-gradient(135deg,#7c3aed,#2563eb)" },
    { initials: "LU", tone: "linear-gradient(135deg,#334155,#0f172a)" },
    { initials: "JO", tone: "linear-gradient(135deg,#9333ea,#be185d)" },
  ],
  transactions: [
    { id: "t1", label: "Pix recebido", who: "Marina", value: 250, incoming: true },
    { id: "t2", label: "Compra no parceiro", who: "Café Central", value: 18.9, incoming: false },
    { id: "t3", label: "Cashback PRX PASS", who: "PRX", value: 12.4, incoming: true },
    { id: "t4", label: "Pix enviado", who: "Lucas", value: 60, incoming: false },
  ],
  benefits: [
    { id: "b1", discount: "2 por 1", partner: "Cinema", title: "Ingressos de quarta a domingo" },
    { id: "b2", discount: "−30%", partner: "Academia", title: "Primeiro mês com desconto" },
    { id: "b3", discount: "−25%", partner: "Delivery", title: "Pedidos acima de R$ 40" },
  ],
} as const;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Interface viva do PRX na identidade Obsidian, em 390pt de largura. Botões
 * funcionam de verdade: o dock troca de tela, o olho oculta o saldo, os
 * pilares e atalhos navegam. Dados de demonstração (não há conta por trás).
 */
export function ObsidianPhoneApp({ className, height = APP_HEIGHT }: { className?: string; height?: number }) {
  const [tab, setTab] = useState<PhoneTab>("home");
  const [hidden, setHidden] = useState(false);
  const [experience, setExperience] = useState<"pass" | "live">("pass");
  const scroller = useRef<HTMLDivElement>(null);

  const go = (next: PhoneTab) => {
    setTab(next);
    scroller.current?.scrollTo({ top: 0 });
  };
  const openExperience = (which: "pass" | "live") => {
    setExperience(which);
    go("experiencias");
  };
  const openPillar = (id: PillarId) => {
    if (id === "pass" || id === "live") openExperience(id);
    else go("mais");
  };

  const actions: ReadonlyArray<ObsidianAction> = [
    { key: "pix", label: "Pix", Icon: IconPixDiamonds, onClick: () => go("conta") },
    { key: "pagar", label: "Pagar", Icon: IconBarcode, onClick: () => go("conta") },
    { key: "transferir", label: "Transferir", Icon: IconPaperPlane, onClick: () => go("conta") },
  ];

  return (
    <div
      role="region"
      aria-label="Demonstração do app PRX"
      className={cn("prx-obsidian relative isolate flex flex-col overflow-hidden text-left", className)}
      style={{ width: APP_WIDTH, height }}
    >
      {/* Luz volumétrica própria da tela (a do app real é fixa na janela). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(28rem_22rem_at_100%_0%,rgba(124,58,237,0.26),transparent_70%),radial-gradient(24rem_20rem_at_-10%_30%,rgba(0,102,255,0.16),transparent_70%),radial-gradient(30rem_18rem_at_50%_110%,rgba(76,29,149,0.3),transparent_72%)]"
      />
      <StatusBar />

      <div ref={scroller} data-lenis-prevent className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
        {tab === "home" && (
          <div className="relative px-5 pb-[104px]">
            <ObsidianCrystal sizes="320px" className="absolute -right-[92px] -top-[46px] -z-10 h-[400px] w-[340px]" />
            <PhoneHeader onHome={() => go("home")} onProfile={() => go("mais")} />
            <ObsidianGreeting name={DEMO.name} as="p" density="phone" className="mt-2" />
            <ObsidianBalanceCard
              density="phone"
              className="mt-4"
              value={DEMO.balance}
              hidden={hidden}
              onToggleHidden={() => setHidden((h) => !h)}
              onOpen={() => go("conta")}
              actions={actions}
            />
            <ul aria-label="Ecossistema PRX" className="-mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5 scrollbar-none">
              {OBSIDIAN_PILLARS.map((pillar) => (
                <li key={pillar.id} className="w-[120px] shrink-0">
                  <ObsidianPillarCard pillar={pillar} density="phone" sizes="140px" onSelect={openPillar} />
                </li>
              ))}
            </ul>
            <ObsidianSectionHeader title="Próximos eventos" actionLabel="Ver todos" onAction={() => openExperience("live")} className="mt-1" />
            <ObsidianEventCard
              density="phone"
              title="Resenha"
              meta="25 out · Goiânia"
              onOpen={() => openExperience("live")}
              trailing={<ObsidianAvatarStack people={DEMO.friends} extra={120} />}
            />
          </div>
        )}

        {tab === "conta" && (
          <PhonePage title="PRX Bank" onHome={() => go("home")} onProfile={() => go("mais")}>
            <ObsidianBalanceCard density="phone" value={DEMO.balance} hidden={hidden} onToggleHidden={() => setHidden((h) => !h)} actions={actions} />
            <ObsidianSectionHeader title="Atividade" className="mt-5" />
            <ul className="glass mt-1 divide-y divide-white/[0.06] rounded-[20px] px-4">
              {DEMO.transactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                    {tx.incoming ? <IconReceive size={15} /> : <IconSend size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{tx.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{tx.who}</span>
                  </span>
                  <span className={cn("text-[13.5px] font-medium tabular-nums", tx.incoming ? "text-success" : "text-ink")}>
                    {hidden ? "••••" : `${tx.incoming ? "+" : "−"} ${money.format(tx.value)}`}
                  </span>
                </li>
              ))}
            </ul>
          </PhonePage>
        )}

        {tab === "experiencias" && (
          <PhonePage title="Experiências" onHome={() => go("home")} onProfile={() => go("mais")}>
            <div className="glass-chip inline-grid grid-cols-2 rounded-full p-1">
              {(["pass", "live"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExperience(value)}
                  aria-pressed={experience === value}
                  className={cn(
                    "ob-label relative min-h-9 cursor-pointer rounded-full px-4 text-[10px] tracking-[0.16em] transition-colors",
                    experience === value ? "bg-white/[0.1] text-ink" : "text-muted-foreground"
                  )}
                >
                  PRX {value.toUpperCase()}
                </button>
              ))}
            </div>
            {experience === "pass" ? (
              <>
                <Banner image={OBSIDIAN_IMAGES.cardMetal} title="PRX Pass" caption="Benefícios exclusivos" />
                <ul className="mt-3 space-y-2">
                  {DEMO.benefits.map((b) => (
                    <li key={b.id} className="glass flex items-center gap-3 rounded-[18px] p-3.5">
                      <span className="w-[62px] shrink-0 text-[17px] font-light tracking-[-0.01em] text-primary">{b.discount}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{b.partner}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{b.title}</span>
                      </span>
                      <IconChevronRight size={14} className="text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <Banner image={OBSIDIAN_IMAGES.liveConcert} title="PRX Live" caption="Eventos · experiências" />
                <div className="mt-3 space-y-2.5">
                  <ObsidianEventCard density="phone" title="Resenha" meta="25 out · Goiânia" trailing={<ObsidianAvatarStack people={DEMO.friends} extra={120} />} />
                  <ObsidianEventCard density="phone" title="Corrida PRX" meta="12 nov · Goiânia" image={OBSIDIAN_IMAGES.meHorizon} />
                </div>
              </>
            )}
          </PhonePage>
        )}

        {tab === "comunidade" && (
          <PhonePage title="Comunidade" onHome={() => go("home")} onProfile={() => go("mais")}>
            <div className="glass rounded-[22px] p-5">
              <p className="ob-label text-[10px] text-muted-foreground">Convide amigos</p>
              <p className="mt-2 text-[20px] font-light leading-snug text-ink">Cada amigo que entra rende PRX Coins pra vocês dois.</p>
              <button
                type="button"
                onClick={() => openExperience("live")}
                className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-medium text-[#fff]"
              >
                Ver os próximos eventos <IconArrowRight size={14} />
              </button>
            </div>
            <ObsidianSectionHeader title="Vão com você" className="mt-5" />
            <div className="glass flex items-center justify-between rounded-[20px] p-4">
              <ObsidianAvatarStack people={DEMO.friends} extra={12} />
              <span className="text-[12px] text-muted-foreground">amigos na Resenha</span>
            </div>
          </PhonePage>
        )}

        {tab === "mais" && (
          <PhonePage title="Mais" onHome={() => go("home")} onProfile={() => go("mais")}>
            <ul className="glass divide-y divide-white/[0.06] rounded-[22px] px-4">
              {["Perfil e nível", "Conta Pai", "Segurança e biometria", "Aparência", "PRX Invest · em breve", "PRX Me · em breve"].map((item) => (
                <li key={item} className="flex min-h-12 items-center justify-between text-[14px] text-ink">
                  {item}
                  <IconChevronRight size={14} className="text-muted-foreground" />
                </li>
              ))}
            </ul>
          </PhonePage>
        )}
      </div>

      <ObsidianDock
        items={PHONE_DOCK}
        active={tab}
        onSelect={go}
        density="phone"
        label="Navegação do app de demonstração"
        layoutId="ob-phone-dock-dot"
        className="absolute inset-x-3 bottom-[22px] z-20"
      />
      <span aria-hidden className="absolute bottom-[7px] left-1/2 z-20 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-[#fff]/[0.85]" />
    </div>
  );
}

function StatusBar() {
  return (
    <div aria-hidden className="relative z-10 flex h-[50px] shrink-0 items-end justify-between px-8 pb-2 text-[15px] font-semibold text-ink">
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8 .7 10.2 10.2 0 0 0 .8 3.6L2 4.8a8.5 8.5 0 0 1 6-2.4Zm0 3.4c1.4 0 2.7.5 3.6 1.4l1.2-1.2A6.8 6.8 0 0 0 8 4.1 6.8 6.8 0 0 0 3.2 6l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.4c.5 0 .9.2 1.2.5L8 11 6.8 9.7c.3-.3.7-.5 1.2-.5Z" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.2" stroke="currentColor" strokeOpacity="0.45" />
          <rect x="2.2" y="2.2" width="18.6" height="7.6" rx="1.8" fill="currentColor" />
          <path d="M24.2 4v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

function PhoneHeader({ onHome, onProfile }: { onHome: () => void; onProfile: () => void }) {
  return (
    <div className="flex h-[52px] items-center justify-between">
      <button type="button" onClick={onHome} aria-label="PRX — início" className="flex min-h-11 cursor-pointer items-center">
        <PrxLogo variant="compact" title="" className="h-[22px] w-auto text-ink" />
      </button>
      <span className="flex items-center gap-1">
        <ObsidianBell count={1} className="h-11 w-11" />
        <button
          type="button"
          onClick={onProfile}
          aria-label="Perfil de Rafael"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a2342,#0e0f16)] text-[14px] font-semibold text-ink ring-1 ring-white/[0.2]"
        >
          R
        </button>
      </span>
    </div>
  );
}

function PhonePage({ title, children, onHome, onProfile }: { title: string; children: ReactNode; onHome: () => void; onProfile: () => void }) {
  return (
    <div className="px-5 pb-[112px]">
      <PhoneHeader onHome={onHome} onProfile={onProfile} />
      <p className="ob-display mb-5 mt-3 text-[24px] text-ink">{title}</p>
      {children}
    </div>
  );
}

function Banner({ image, title, caption }: { image: (typeof OBSIDIAN_IMAGES)[keyof typeof OBSIDIAN_IMAGES]; title: string; caption: string }) {
  return (
    <div className="relative isolate mt-4 flex h-[168px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.12] p-4 text-[#fff]">
      <Image src={image} alt="" fill sizes="360px" placeholder="blur" className="-z-10 object-cover object-[50%_55%]" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(5,5,8,0.55),rgba(5,5,8,0.05)_45%,rgba(5,5,8,0.85))]" />
      <span className="ob-label text-[15px] tracking-[0.16em]">{title}</span>
      <span className="ob-label text-[10px] tracking-[0.16em] text-[#e6e8ee]">{caption}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Celular 3D                                                                 */
/* -------------------------------------------------------------------------- */

type Angle = number | MotionValue<number>;

function useAngle(value: Angle | undefined, fallback: number): MotionValue<number> {
  const own = useMotionValue(typeof value === "number" ? value : fallback);
  useEffect(() => {
    if (typeof value === "number") own.set(value);
  }, [own, value]);
  return isMotionValue(value) ? value : own;
}

export interface ObsidianPhone3DProps {
  /** Rotação base (graus). Aceita MotionValue para seguir a rolagem da landing. */
  rotationX?: Angle;
  rotationY?: Angle;
  rotationZ?: Angle;
  /** Inclinação 3D sutil acompanhando o cursor, com reflexo de luz na tela. */
  pointerTilt?: boolean;
  /** Arrastar para girar livremente (visualizador do /teste). Duplo clique volta ao início. */
  draggable?: boolean;
  /** Zoom do visualizador (1 = tamanho natural). */
  zoom?: number;
  /** Conteúdo da tela; padrão: o app PRX de demonstração. */
  screen?: ReactNode;
  className?: string;
}

/**
 * Smartphone de alta fidelidade em CSS 3D: chassi de titânio escuro com
 * espessura real (camadas laterais), botões de titânio, Dynamic Island e
 * vidro com reflexo que muda de lugar conforme o aparelho inclina.
 */
export function ObsidianPhone3D({ rotationX, rotationY, rotationZ, pointerTilt = true, draggable = false, zoom = 1, screen, className }: ObsidianPhone3DProps) {
  const reduceMotion = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const baseX = useAngle(rotationX, 8);
  const baseY = useAngle(rotationY, -16);
  const baseZ = useAngle(rotationZ, 0);

  // Cursor normalizado em [-1, 1] relativo ao centro do aparelho, com mola.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.6 });
  const tiltY = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.6 });
  // Arrasto livre (visualizador): graus somados à rotação base.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragXSpring = useSpring(dragX, { stiffness: 300, damping: 28 });
  const dragYSpring = useSpring(dragY, { stiffness: 300, damping: 28 });
  const zoomSpring = useSpring(zoom, { stiffness: 300, damping: 28 });

  useEffect(() => {
    zoomSpring.set(zoom);
  }, [zoom, zoomSpring]);

  const rotateX = useTransform(() => baseX.get() - tiltY.get() * 7 + dragXSpring.get());
  const rotateY = useTransform(() => baseY.get() + tiltX.get() * 9 + dragYSpring.get());
  const rotateZ = baseZ;

  // Reflexo: a mancha de luz corre na direção oposta à inclinação.
  const glareX = useTransform(() => 50 - tiltX.get() * 34 - dragYSpring.get() * 0.6);
  const glareY = useTransform(() => 30 - tiltY.get() * 26 + dragXSpring.get() * 0.4);
  const glare = useMotionTemplate`radial-gradient(520px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.14), transparent 55%)`;

  useEffect(() => {
    if (!pointerTilt || reduceMotion) return;
    const onMove = (event: PointerEvent) => {
      const el = stage.current;
      if (!el || event.pointerType === "touch") return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = (event.clientX - cx) / Math.max(window.innerWidth / 2, 1);
      const ny = (event.clientY - cy) / Math.max(window.innerHeight / 2, 1);
      pointerX.set(Math.max(-1, Math.min(1, nx)));
      pointerY.set(Math.max(-1, Math.min(1, ny)));
    };
    const onLeave = () => {
      pointerX.set(0);
      pointerY.set(0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [pointerTilt, reduceMotion, pointerX, pointerY]);

  const drag = useRef<{ x: number; y: number; rx: number; ry: number; id: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    // Toques e cliques na tela do app continuam funcionando; o giro nasce na moldura ou fora dela.
    if ((event.target as HTMLElement).closest("[data-phone-screen]")) return;
    drag.current = { x: event.clientX, y: event.clientY, rx: dragX.get(), ry: dragY.get(), id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    dragY.set(start.ry + (event.clientX - start.x) * 0.45);
    dragX.set(Math.max(-60, Math.min(60, start.rx - (event.clientY - start.y) * 0.3)));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  return (
    <div
      ref={stage}
      className={cn("relative select-none [perspective:1800px]", draggable && "cursor-grab touch-none active:cursor-grabbing", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => {
        if (!draggable) return;
        dragX.set(0);
        dragY.set(0);
      }}
    >
      {/* Sombra de contato no "chão" do estúdio */}
      <div aria-hidden className="absolute -bottom-10 left-1/2 h-16 w-[78%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,0,0,0.75),transparent)] blur-md" />
      <motion.div style={{ scale: zoomSpring }} className="[transform-style:preserve-3d]">
        <motion.div
          style={{ rotateX, rotateY, rotateZ, width: PHONE.width, height: PHONE.height }}
          className="relative [transform-style:preserve-3d]"
        >
          {/* Lateral de titânio: camadas empilhadas atrás da frente */}
          {EDGE_LAYERS.map((depth) => (
            <div
              key={depth}
              aria-hidden
              className="absolute inset-0"
              style={{
                borderRadius: PHONE.radius,
                transform: `translateZ(${-depth * 1.25}px)`,
                background: depth === EDGE_LAYERS.length ? "linear-gradient(160deg,#2b2c33,#0d0e12 55%,#23242b)" : "linear-gradient(90deg,#4a4c55,#1b1c21 18%,#2e3038 50%,#1b1c21 82%,#4a4c55)",
              }}
            />
          ))}

          {/* Botões laterais de titânio (ação, volume +/−, lateral) */}
          {[
            { side: "left", top: 150, h: 30 },
            { side: "left", top: 205, h: 58 },
            { side: "left", top: 276, h: 58 },
            { side: "right", top: 232, h: 92 },
          ].map((b) => (
            <span
              key={`${b.side}-${b.top}`}
              aria-hidden
              className="absolute w-[5px] rounded-full bg-[linear-gradient(90deg,#5b5d66,#23242a_60%,#3f414a)]"
              style={{ top: b.top, height: b.h, [b.side]: -3, transform: "translateZ(-5px)" } as CSSProperties}
            />
          ))}

          {/* Frente: aro de titânio → borda preta → tela */}
          <div
            className="absolute inset-0 [backface-visibility:hidden]"
            style={{
              borderRadius: PHONE.radius,
              padding: PHONE.frame,
              background: "linear-gradient(145deg,#6b6e78 0%,#25262c 24%,#3d3f47 50%,#16171b 76%,#555862 100%)",
              boxShadow: "0 50px 90px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05), 0 30px 120px -40px rgba(124,58,237,0.55)",
            }}
          >
            <div className="h-full w-full bg-[#010102]" style={{ borderRadius: PHONE.radius - PHONE.frame, padding: PHONE.bezel }}>
              <div
                data-phone-screen
                className="relative h-full w-full overflow-hidden bg-[#050508]"
                style={{ borderRadius: PHONE.radius - PHONE.frame - PHONE.bezel + 2 }}
              >
                <div style={{ width: APP_WIDTH, height: APP_HEIGHT, transform: `scale(${APP_SCALE})`, transformOrigin: "top left" }}>{screen ?? <ObsidianPhoneApp />}</div>

                {/* Dynamic Island */}
                <div aria-hidden className="absolute left-1/2 top-[10px] z-30 flex h-[31px] w-[106px] -translate-x-1/2 items-center justify-end rounded-full bg-[#000] pr-2.5">
                  <span className="h-[9px] w-[9px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b3f58,#0b0c14_70%)] ring-1 ring-white/[0.06]" />
                </div>

                {/* Vidro: reflexo fixo em diagonal + mancha de luz que acompanha a inclinação */}
                <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(118deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.025)_26%,transparent_42%)]" />
                <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30 mix-blend-screen" style={{ backgroundImage: glare }} />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
