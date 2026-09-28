// Hello World
"use client";

import { motion } from "motion/react";
import { BalanceFigure, IconButton, ProgressBar } from "@/components/app/ui";
import { IconChevronRight, IconEye, IconEyeOff } from "@/components/icons/prx-icons";
import { levelProgress } from "@/lib/pass-data";
import { cn } from "@/lib/utils";

const integer = new Intl.NumberFormat("pt-BR");

interface WalletTriadProps {
  balance: number;
  balanceLabel: string;
  coins: number | null;
  xp: number;
  hidden: boolean;
  onToggleHidden: () => void;
  onOpenPoints: () => void;
  onOpenLevel: () => void;
  /** compact: sem o saldo gigante (usado dentro do PRX BANK, que já mostra o saldo). */
  compact?: boolean;
  className?: string;
}

/**
 * Carteira Central em três leituras: dinheiro (PRX Bank), moeda de resgate
 * (PRX Coins) e prestígio (nível e XP). Tipografia conduz; nada de ícone extra.
 */
export function WalletTriad({ balance, balanceLabel, coins, xp, hidden, onToggleHidden, onOpenPoints, onOpenLevel, compact = false, className }: WalletTriadProps) {
  const progress = levelProgress(xp);
  return (
    <div className={cn("space-y-4", className)}>
      {!compact && (
        <BalanceFigure
          label={balanceLabel}
          value={balance}
          hidden={hidden}
          action={
            <IconButton tone="plain" label={hidden ? "Mostrar saldo" : "Ocultar saldo"} aria-pressed={hidden} onClick={onToggleHidden} className="-mr-2 h-12 w-12">
              {hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </IconButton>
          }
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          onClick={onOpenPoints}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="group flex min-h-[132px] min-w-0 cursor-pointer flex-col justify-between rounded-2xl bg-surface p-4 text-left transition-colors hover:bg-line sm:p-5"
          aria-label={`PRX Coins: ${coins === null ? "carregando" : integer.format(coins)}. Abrir extrato de pontos`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">PRX Coins</span>
            <IconChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </span>
          <span>
            <span className="block truncate text-[30px] font-light leading-none tracking-[-0.035em] text-ink [font-feature-settings:'pnum'] sm:text-[34px]">
              {coins === null ? "—" : hidden ? "••••" : integer.format(coins)}
            </span>
            <span className="mt-2 block truncate text-[12px] text-muted-foreground">Resgate no PASS</span>
          </span>
        </motion.button>

        <motion.button
          type="button"
          onClick={onOpenLevel}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="group flex min-h-[132px] min-w-0 cursor-pointer flex-col justify-between rounded-2xl bg-surface p-4 text-left transition-colors hover:bg-line sm:p-5"
          aria-label={`PRX Level ${progress.level}, ${integer.format(xp)} XP. Faltam ${integer.format(progress.remaining)} XP para o nível ${progress.level + 1}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">PRX Level</span>
          <span>
            <span className="block truncate text-[30px] font-light leading-none tracking-[-0.035em] text-ink [font-feature-settings:'pnum'] sm:text-[34px]">
              Nível {integer.format(progress.level)}
            </span>
            <span className="mt-3 block">
              <ProgressBar value={progress.pct} label={`Progresso até o nível ${progress.level + 1}`} />
            </span>
            <span className="mt-2 block truncate text-[12px] text-muted-foreground">
              {integer.format(xp)} XP · faltam {integer.format(progress.remaining)}
            </span>
          </span>
        </motion.button>
      </div>
    </div>
  );
}
