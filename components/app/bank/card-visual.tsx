// Hello World
"use client";

import type { PointerEvent } from "react";
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

const cardShell = "prx-holo flex aspect-[1.586/1] w-full select-none flex-col justify-between rounded-[22px] p-5 text-left";

/**
 * A película holográfica acompanha o ponteiro (variáveis CSS, sem re-render).
 * Sem ponteiro, volta ao repouso: nada se move sozinho.
 */
function trackHolo(event: PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--holo-x", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
  el.style.setProperty("--holo-y", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
}

function resetHolo(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--holo-x");
  event.currentTarget.style.removeProperty("--holo-y");
}

/**
 * Cartão virtual PRX em destaque (carrossel da Home e aba Cartões).
 * Sem cartão emitido (conta em ativação) mostra o estado real, sem número inventado.
 */
export function PaymentCard({ card, holder, onClick }: { card: VirtualCard | null; holder: string; onClick?: () => void }) {
  const label = card ? `Cartão virtual final ${card.last4}${card.locked ? ", bloqueado" : ""}. Abrir cartões` : "Cartão virtual PRX Bank. Abrir cartões";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      onPointerMove={trackHolo}
      onPointerLeave={resetHolo}
      className={cn(cardShell, "cursor-pointer", card?.locked && "grayscale")}
      aria-label={label}
    >
      <span className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">PRX Bank</span>
        {card ? (
          <Contactless className="h-6 w-6 text-white/90" />
        ) : (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/20 backdrop-blur-sm">Virtual</span>
        )}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold uppercase tracking-[0.02em]">{holder}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-white/80">
            {!card ? "•••• 4242 · 12/30" : card.locked ? "Bloqueado" : `•••• ${card.last4} · ${card.expiry}`}
          </span>
        </span>
        <PrxLogo variant="symbol" title="" className="h-7 w-auto shrink-0 text-white" />
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
      onPointerMove={trackHolo}
      onPointerLeave={resetHolo}
      className={cn(cardShell, "mx-auto max-w-[380px] sm:mx-0", !card && "opacity-80", card?.locked && "grayscale")}
      aria-label={card ? `Cartão virtual final ${card.last4}${card.locked ? ", bloqueado" : ""}` : "Cartão virtual"}
      role="img"
    >
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">PRX Bank</span>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/20 backdrop-blur-sm">{card?.locked ? "Bloqueado" : "Virtual"}</span>
      </div>
      <p className="font-mono text-base font-medium tracking-[0.12em] text-white min-[360px]:text-lg sm:text-xl">{card ? `•••• •••• •••• ${card.last4}` : "•••• •••• •••• ••••"}</p>
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
