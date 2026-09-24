// Hello World
"use client";

import { motion } from "motion/react";
import { PrxLogo } from "@/components/brand/prx-logo";
import type { CardData } from "@/lib/prx/bank";
import { cn } from "@/lib/utils";

function groupDigits(number: string): string {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/**
 * Cartão virtual PRX. Grafite sólido, símbolo da marca e dados em fonte mono.
 * Inclinação sutil ao passar o mouse (física de mola), nunca em movimento contínuo.
 */
export function CardVisual({ card, holder, revealed }: { card: CardData; holder: string; revealed: boolean }) {
  return (
    <motion.div
      whileHover={{ rotateX: 4, rotateY: -6, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={{ transformPerspective: 900 }}
      className={cn(
        "relative flex aspect-[1.586/1] w-full max-w-[380px] select-none flex-col justify-between overflow-hidden bg-ink p-5 text-white sm:p-6",
        card.locked && "grayscale"
      )}
      aria-label={`Cartão virtual final ${card.last4}${card.locked ? ", bloqueado" : ""}`}
      role="img"
    >
      {/* Faixa diagonal de 45°, eco do símbolo */}
      <span aria-hidden className="pointer-events-none absolute -right-16 top-0 h-[180%] w-28 origin-top rotate-45 bg-white/[0.04]" />
      <div className="flex items-start justify-between">
        <PrxLogo variant="symbol" title="" className="h-7 w-auto text-white" />
        <span className="font-mono text-[12px] tracking-[0.12em] text-white/70">{card.locked ? "BLOQUEADO" : "VIRTUAL"}</span>
      </div>
      <p className="font-mono text-lg tracking-[0.14em] sm:text-xl">
        {revealed ? groupDigits(card.number) : `•••• •••• •••• ${card.last4}`}
      </p>
      <div className="flex items-end justify-between gap-4 font-mono text-[12px] tracking-[0.08em]">
        <div className="min-w-0">
          <span className="block text-white/60">TITULAR</span>
          <span className="block truncate uppercase">{holder}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-white/60">VAL · CVV</span>
          <span className="block">{revealed ? `${card.expiry} · ${card.cvv}` : "••/•• · •••"}</span>
        </div>
      </div>
    </motion.div>
  );
}
