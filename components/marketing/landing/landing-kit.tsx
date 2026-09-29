// Hello World
"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Peças visuais compartilhadas da nova landing PRX (Cyber-Luxury Obsidian + Liquid Glass).
 * As superfícies "surface" leem os tokens --rv-* do globals.css e acompanham o tema
 * (branco no claro, obsidiana no escuro); "dark" e "light" são fixas.
 */

export type Tone = "dark" | "light";

export const SPRING_UI = { type: "spring", stiffness: 300, damping: 28 } as const;

/**
 * Vidro líquido: desfoque profundo, borda especular (mais clara no topo, quase
 * apagada na base) e sombra de levitação.
 */
export const LIQUID = {
  dark: "border border-x-white/10 border-t-white/30 border-b-white/5 bg-white/[0.06] backdrop-blur-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]",
  light:
    "border border-x-black/[0.06] border-t-white border-b-black/[0.08] bg-white/70 backdrop-blur-2xl shadow-[0_24px_48px_-20px_rgba(22,12,52,0.22),inset_0_1px_1px_rgba(255,255,255,0.9)]",
  surface:
    "border border-x-[var(--rv-glass-x)] border-t-[var(--rv-glass-t)] border-b-[var(--rv-glass-b)] bg-[var(--rv-glass)] backdrop-blur-2xl shadow-[var(--rv-glass-shadow)]",
  /** Mesmo vidro sem desfoque: para listas longas (FAQ, passos) não pesarem na GPU do celular. */
  soft: "border border-x-[var(--rv-glass-x)] border-t-[var(--rv-glass-t)] border-b-[var(--rv-glass-b)] bg-[var(--rv-glass)] shadow-[var(--rv-glass-shadow)]",
} as const;

/** Reflexo especular no canto superior esquerdo: a luz refratada no vidro curvo. Pede um pai relative + overflow-hidden. */
export function Specular({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgba(148,104,250,0.18),transparent)]", className)}
    />
  );
}

export const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Botão de destaque Cyber-Luxury: violeta profundo (5.7:1 com o branco) e um reflexo de luz que atravessa no hover. */
export function LuxuryButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "group/lux relative inline-flex min-h-12 cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap rounded-full bg-[#7c3aed] px-5 text-[14px] font-semibold text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_28px_-10px_rgba(124,58,237,0.8)] transition-[background-color,transform] duration-200 hover:bg-[#6d28d9] active:scale-[0.98]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] opacity-0 transition-[translate,opacity] duration-700 ease-out group-hover/lux:translate-x-[300%] group-hover/lux:opacity-100 motion-reduce:hidden"
      />
      <span className="relative">{children}</span>
    </a>
  );
}

/** Botão secundário em vidro, legível no claro e no escuro. */
export function GlassButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex min-h-12 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-5 text-[14px] font-semibold text-[var(--rv-ink)] transition-transform duration-200 hover:-translate-y-px active:scale-[0.98]",
        LIQUID.surface,
        className,
      )}
    >
      {children}
    </a>
  );
}

export const rise = {
  hidden: { opacity: 0, y: 36 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...SPRING_UI, delay: i * 0.08 } }),
};

export const IN_VIEW = { once: true, amount: 0.35 } as const;

/** Revela o bloco ao entrar na tela (mola 300/28); com movimento reduzido, só o fade. */
export function Reveal({ children, index = 0, className, amount = 0.35 }: { children: ReactNode; index?: number; className?: string; amount?: number }) {
  return (
    <motion.div custom={index} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount }} className={className}>
      {children}
    </motion.div>
  );
}

/** Título de seção: h2 monumental, com a segunda linha opcional em violeta. */
export function SectionHeading({
  id,
  title,
  accent,
  lead,
  align = "center",
  className,
}: {
  id: string;
  title: ReactNode;
  accent?: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto text-center" : "text-left", "max-w-[860px]", className)}>
      <Reveal amount={0.6}>
        <h2
          id={id}
          className="text-balance text-[clamp(28px,7vw,44px)] font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--rv-ink)] md:text-[clamp(40px,4.4vw,60px)]"
        >
          {title}
          {accent && (
            <>
              <br />
              <span className="text-[#7c3aed] dark:text-[#a78bfa]">{accent}</span>
            </>
          )}
        </h2>
      </Reveal>
      {lead && (
        <Reveal index={1} amount={0.6}>
          <p className={cn("mt-5 text-pretty text-[16px] leading-relaxed text-[var(--rv-muted)] sm:text-[18px]", align === "center" && "mx-auto max-w-[640px]")}>{lead}</p>
        </Reveal>
      )}
    </div>
  );
}
