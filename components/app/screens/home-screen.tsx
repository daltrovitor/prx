// Hello World
"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { PassData } from "@/components/app/use-pass-data";
import { useAppNav } from "@/components/app/app-nav";
import { useBank, useHiddenBalance, useLiveWallet } from "@/components/app/use-prx-stores";
import { EventDate, StatCell, TextLink, TransactionRow } from "@/components/app/shared";
import { ProgressBar, SectionHeader, formatBRL } from "@/components/app/ui";
import { IconCard, IconEye, IconEyeOff, IconPix, IconQr, IconReceive } from "@/components/icons/prx-icons";
import { levelProgress } from "@/lib/pass-data";
import { LIVE_EVENTS, SERIES_LABEL } from "@/lib/prx/live";
import { BANK_MODE } from "@/lib/prx/bank";

interface HomeScreenProps {
  pass: PassData;
  firstName: string;
}

const reveal = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30, delay: i * 0.05 } }),
};

export function HomeScreen({ pass, firstName }: HomeScreenProps) {
  const { go } = useAppNav();
  const { member, vouchers, missions, benefits } = pass;
  const [bank] = useBank(member.id);
  const [wallet] = useLiveWallet(member.id);
  const [hidden, toggleHidden] = useHiddenBalance();

  const activeVouchers = vouchers.filter((v) => v.status === "valid");
  const progress = levelProgress(member.prxScore ?? 0);
  const inProgress = missions.filter((m) => m.isAccepted && !m.isCompleted).slice(0, 3);
  const suggestedMissions = inProgress.length > 0 ? inProgress : missions.filter((m) => !m.isCompleted).slice(0, 3);

  const [now] = useState(() => Date.now());
  const nextEvent = useMemo(
    () => [...LIVE_EVENTS].filter((e) => new Date(e.startsAt).getTime() > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [now]
  );
  const upcomingTickets = wallet.tickets.filter((t) => !t.checkedIn);

  const quickActions = [
    { label: "Pix", Icon: IconPix, onClick: () => go("bank", "pix") },
    { label: "Cobrar", Icon: IconReceive, onClick: () => go("bank", "cobrar") },
    { label: "Cartão", Icon: IconCard, onClick: () => go("bank", "cartoes") },
    { label: "Vouchers", Icon: IconQr, onClick: () => go("pass", "vouchers") },
  ];

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      <motion.header initial="hidden" animate="show" custom={0} variants={reveal}>
        <h1 className="font-display text-3xl min-[380px]:text-4xl sm:text-6xl lg:text-7xl font-semibold leading-[0.95] tracking-[-0.045em] text-ink">
          Olá, {firstName}.
        </h1>
        <p className="mt-2.5 max-w-md text-sm sm:text-[15px] text-muted-foreground">
          Seu saldo, seus benefícios e o que vem por aí, em um lugar só.
        </p>
      </motion.header>

      {/* Topo da pirâmide: saldo e métricas */}
      <motion.section
        aria-label="Resumo da conta"
        initial="hidden"
        animate="show"
        custom={1}
        variants={reveal}
        className="grid gap-px border border-line bg-line lg:grid-cols-12"
      >
        <div className="flex flex-col justify-between gap-6 sm:gap-10 bg-[#0b0b10] dark:bg-[#12121c] p-5 min-[380px]:p-6 text-white sm:p-8 lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs sm:text-[13px] font-medium text-white/70">
              Saldo PRX BANK{BANK_MODE === "sandbox" ? " · demonstração" : ""}
            </p>
            <button
              type="button"
              onClick={toggleHidden}
              aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
              aria-pressed={hidden}
              className="-mr-2 -mt-2 flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center text-white/80 transition-colors hover:text-white"
            >
              {hidden ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
          <p className="font-display text-3xl min-[380px]:text-4xl sm:text-6xl font-semibold leading-none tracking-[-0.05em] tabular-nums break-words">
            {hidden ? "R$ ••••" : formatBRL(bank.balance)}
          </p>
          <div className="grid grid-cols-4 gap-px bg-white/10">
            {quickActions.map(({ label, Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex min-h-[64px] sm:min-h-[72px] cursor-pointer flex-col items-center justify-center p-2 min-[360px]:p-2.5 sm:p-3 sm:items-start text-center sm:text-left transition-colors hover:bg-white/10 bg-[#0b0b10] dark:bg-[#12121c]"
              >
                <Icon size={19} />
                <span className="mt-1.5 text-[11px] min-[360px]:text-[12px] sm:text-[13px] font-medium leading-none truncate max-w-full">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-px bg-line grid-cols-1 min-[520px]:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <StatCell label="Vouchers ativos" value={activeVouchers.length}>
            <TextLink onClick={() => go("pass", "vouchers")}>{activeVouchers.length > 0 ? "Mostrar no balcão" : "Explorar benefícios"}</TextLink>
          </StatCell>
          <StatCell label={`PRX Score · nível ${progress.level}`} value={`${(member.prxScore ?? 0).toLocaleString("pt-BR")} XP`}>
            <ProgressBar value={progress.pct} label={`Progresso até o nível ${progress.level + 1}`} />
            <p className="mt-2 text-[13px] text-muted-foreground">
              {progress.next === null ? "Nível máximo alcançado." : `Faltam ${progress.remaining.toLocaleString("pt-BR")} XP para o nível ${progress.level + 1}.`}
            </p>
          </StatCell>
          <StatCell label="Ingressos" value={upcomingTickets.length}>
            <TextLink onClick={() => go("live", upcomingTickets.length > 0 ? "ingressos" : "eventos")}>
              {upcomingTickets.length > 0 ? "Abrir carteira" : "Ver agenda"}
            </TextLink>
          </StatCell>
        </div>
      </motion.section>

      {/* Meio: o que fazer agora */}
      <motion.div initial="hidden" animate="show" custom={2} variants={reveal} className="grid gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-10">
        {nextEvent && (
          <section aria-labelledby="home-next-event" className="lg:col-span-7">
            <SectionHeader id="home-next-event" title="Próximo na PRX LIVE" action={<TextLink onClick={() => go("live", "eventos")}>Agenda</TextLink>} />
            <button
              type="button"
              onClick={() => go("live", "eventos")}
              className="group mt-4 sm:mt-5 flex w-full cursor-pointer flex-col-reverse items-start justify-between gap-4 sm:gap-6 border border-line p-4 min-[380px]:p-5 sm:p-7 text-left transition-colors hover:border-ink sm:flex-row sm:items-end"
            >
              <div className="min-w-0 space-y-3 sm:space-y-5">
                <p className="font-mono text-[11px] sm:text-[12px] tracking-[0.08em] text-primary">{SERIES_LABEL[nextEvent.series].toUpperCase()}</p>
                <div>
                  <p className="font-display text-xl min-[380px]:text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-3xl">{nextEvent.title}</p>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                    {nextEvent.venue} · {nextEvent.city}
                  </p>
                </div>
              </div>
              <EventDate iso={nextEvent.startsAt} />
            </button>
          </section>
        )}

        <section aria-labelledby="home-missions" className="lg:col-span-5">
          <SectionHeader id="home-missions" title="Missões" action={<TextLink onClick={() => go("pass", "missions")}>Todas</TextLink>} />
          {suggestedMissions.length === 0 ? (
            <p className="mt-5 border border-dashed border-line p-6 text-sm text-muted-foreground">
              Nenhuma missão aberta agora. Novas missões aparecem aqui assim que forem publicadas.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {suggestedMissions.map((mission) => (
                <li key={mission.id}>
                  <button
                    type="button"
                    onClick={() => go("pass", "missions")}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{mission.title}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="flex-1">
                          <ProgressBar value={mission.progress} max={mission.total || 1} label={`Progresso de ${mission.title}`} tone="ink" />
                        </div>
                        <span className="font-mono text-[12px] text-muted-foreground">
                          {mission.progress}/{mission.total}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[13px] text-primary">+{mission.xpReward} XP</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>

      {benefits.length > 0 && (
        <motion.section aria-label="Benefícios em destaque" initial="hidden" animate="show" custom={3} variants={reveal}>
          <SectionHeader title="No PASS agora" action={<TextLink onClick={() => go("pass")}>Catálogo</TextLink>} />
          <ul className="-mx-3.5 min-[380px]:-mx-4 mt-4 sm:mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 min-[380px]:px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0 touch-pan-x">
            {benefits.slice(0, 8).map((benefit) => (
              <li key={benefit.id} className="w-[78%] min-[420px]:w-[260px] shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => go("pass", `beneficio:${benefit.id}`)}
                  className="flex h-full w-full cursor-pointer flex-col justify-between gap-6 sm:gap-8 border border-line p-4 sm:p-5 text-left transition-colors hover:border-ink"
                >
                  <span className="font-display text-2xl sm:text-[28px] font-semibold leading-none tracking-[-0.04em] text-primary">{benefit.discountLabel}</span>
                  <div>
                    <span className="block text-sm sm:text-[15px] font-medium text-ink">{benefit.partnerName}</span>
                    <span className="mt-0.5 block truncate text-xs sm:text-[13px] text-muted-foreground">{benefit.title}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Base: movimentações detalhadas */}
      <motion.section aria-labelledby="home-activity" initial="hidden" animate="show" custom={4} variants={reveal}>
        <SectionHeader id="home-activity" title="Movimentações" action={<TextLink onClick={() => go("bank", "extrato")}>Extrato completo</TextLink>} />
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {bank.transactions.slice(0, 4).map((tx) => (
            <TransactionRow key={tx.id} tx={tx} hidden={hidden} />
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
