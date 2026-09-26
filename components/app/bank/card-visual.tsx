// Hello World
"use client";

import { motion } from "motion/react";
import { PrxLogo } from "@/components/brand/prx-logo";
import type { VirtualCard } from "@/lib/prx/bank";
import { cn } from "@/lib/utils";

/** Ondas de pagamento por aproximação. */
function Contactless({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className} aria-hidden>
      <path d="M8.5 9.5a4 4 0 0 1 0 5" />
      <path d="M12 7.5a7 7 0 0 1 0 9" />
      <path d="M15.5 5.5a10 10 0 0 1 0 13" />
    </svg>
  );
}

const cardShell =
  "relative flex aspect-[1.586/1] w-full select-none flex-col justify-between overflow-hidden rounded-[20px] p-5 text-left text-white shadow-[0_12px_32px_-16px_rgba(11,11,16,0.45)]";

/**
 * Cartão virtual PRX em destaque (carrossel da Home e aba Cartões).
 * Sem cartão emitido (conta em ativação) mostra o estado real, sem número inventado.
 */
export function PaymentCard({ card, holder, onClick }: { card: VirtualCard | null; holder: string; onClick?: () => void }) {
  const label = card ? `Cartão virtual final ${card.last4}${card.locked ? ", bloqueado" : ""}. Abrir cartões` : "Cartão virtual em ativação. Abrir cartões";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(cardShell, "cursor-pointer bg-primary", card?.locked && "grayscale")}
      aria-label={label}
    >
      <span className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">PRX Bank</span>
        {card ? <Contactless className="h-6 w-6 text-white/90" /> : <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">Em ativação</span>}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.02em]">{holder}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-white/80">
            {!card ? "Emitido na ativação da conta" : card.locked ? "Bloqueado" : `•••• ${card.last4} · ${card.expiry}`}
          </span>
        </span>
        <PrxLogo variant="symbol" title="" className="h-7 w-auto shrink-0 text-white" />
      </span>
    </motion.button>
  );
}

/** Cartão do PRX Score: nível, XP e quanto falta para o próximo nível. */
export function ScoreCard({
  level,
  score,
  pct,
  remaining,
  onClick,
}: {
  level: number;
  score: number;
  pct: number;
  remaining: number | null;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className={cn(cardShell, "cursor-pointer bg-[#0b0b10] dark:bg-[#1d1d28]")}
      aria-label={`PRX Score: nível ${level}, ${score.toLocaleString("pt-BR")} XP. Ver missões`}
    >
      <span className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">PRX Score</span>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold">Nível {level}</span>
      </span>
      <span className="block">
        <span className="block text-[30px] font-light leading-none tracking-[-0.03em] [font-feature-settings:'pnum']">
          {score.toLocaleString("pt-BR")} <span className="text-base font-normal text-white/70">XP</span>
        </span>
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-white" style={{ width: `${Math.max(2, pct)}%` }} />
        </span>
        <span className="mt-2 block text-[11px] font-medium text-white/75">
          {remaining === null ? "Topo da régua alcançado" : `Faltam ${remaining.toLocaleString("pt-BR")} XP para o nível ${level + 1}`}
        </span>
      </span>
    </motion.button>
  );
}

/**
 * Cartão virtual na aba Cartões. Número completo e CVV ficam só no emissor e
 * serão exibidos pelo componente seguro do banco parceiro; aqui, final e validade.
 * Inclinação sutil ao passar o mouse (física de mola), nunca em movimento contínuo.
 */
export function CardVisual({ card, holder }: { card: VirtualCard | null; holder: string }) {
  return (
    <motion.div
      whileHover={{ rotateX: 4, rotateY: -6, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={{ transformPerspective: 900 }}
      className={cn(cardShell, "mx-auto max-w-[380px] sm:mx-0", card ? "bg-primary" : "bg-primary/70", card?.locked && "grayscale")}
      aria-label={card ? `Cartão virtual final ${card.last4}${card.locked ? ", bloqueado" : ""}` : "Cartão virtual ainda não emitido"}
      role="img"
    >
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">PRX Bank</span>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">{!card ? "Em ativação" : card.locked ? "Bloqueado" : "Virtual"}</span>
      </div>
      <p className="font-mono text-base tracking-[0.12em] min-[360px]:text-lg sm:text-xl">{card ? `•••• •••• •••• ${card.last4}` : "•••• •••• •••• ••••"}</p>
      <div className="flex items-end justify-between gap-3 text-[11px] sm:text-[12px]">
        <div className="min-w-0">
          <span className="block font-medium text-white/70">Titular</span>
          <span className="block truncate font-semibold uppercase">{holder}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="block font-medium text-white/70">Validade</span>
          <span className="block font-mono">{card ? card.expiry : "••/••"}</span>
        </div>
      </div>
    </motion.div>
  );
}
