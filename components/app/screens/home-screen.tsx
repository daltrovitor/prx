// Hello World
"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { PassData } from "@/components/app/use-pass-data";
import { useAppNav, type AppTab } from "@/components/app/app-nav";
import { useBankAccount, useHiddenBalance, useLiveData } from "@/components/app/use-prx-stores";
import { EventDate, TextLink, TransactionRow } from "@/components/app/shared";
import { PaymentCard, ScoreCard } from "@/components/app/bank/card-visual";
import { ActionTile, BalanceFigure, EmptyState, IconButton, ProgressBar, SectionHeader, Sheet } from "@/components/app/ui";
import {
  IconCalendar,
  IconCard,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconGift,
  IconLevel,
  IconPix,
  IconQr,
  IconReceive,
  IconSend,
  IconTicket,
  IconUsers,
} from "@/components/icons/prx-icons";
import { levelProgress } from "@/lib/pass-data";

const reveal = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30, delay: i * 0.05 } }),
};

export function HomeScreen({ pass }: { pass: PassData }) {
  const { go } = useAppNav();
  const { member, vouchers, missions, benefits } = pass;
  const { account } = useBankAccount(member.id);
  const { data: live } = useLiveData(member.id);
  const [hidden, toggleHidden] = useHiddenBalance();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeVouchers = vouchers.filter((v) => v.status === "valid");
  const progress = levelProgress(member.prxScore ?? 0);
  const inProgress = missions.filter((m) => m.isAccepted && !m.isCompleted).slice(0, 3);
  const suggestedMissions = inProgress.length > 0 ? inProgress : missions.filter((m) => !m.isCompleted).slice(0, 3);

  const [now] = useState(() => Date.now());
  const nextEvent = useMemo(
    () =>
      (live?.events ?? [])
        .filter((e) => e.status === "published" && new Date(e.startsAt).getTime() > now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [live?.events, now]
  );
  const openTickets = (live?.wallet.tickets ?? []).filter((t) => t.status === "valid" || t.status === "pending_payment");
  const transactions = account?.transactions ?? [];

  const more: ReadonlyArray<{ label: string; Icon: typeof IconCard; tab: AppTab; sub: string | null }> = [
    { label: "Cartões", Icon: IconCard, tab: "bank", sub: "cartoes" },
    { label: "Vouchers", Icon: IconQr, tab: "pass", sub: "vouchers" },
    { label: "Benefícios", Icon: IconGift, tab: "pass", sub: null },
    { label: "Missões", Icon: IconLevel, tab: "pass", sub: "missions" },
    { label: "Eventos", Icon: IconCalendar, tab: "live", sub: null },
    { label: "Ingressos", Icon: IconTicket, tab: "live", sub: "ingressos" },
    { label: "Convidar", Icon: IconUsers, tab: "pass", sub: "convidar" },
    { label: "Chaves Pix", Icon: IconPix, tab: "bank", sub: "chaves" },
  ];

  const scoreCard = (
    <ScoreCard
      level={progress.level}
      score={member.prxScore ?? 0}
      pct={progress.pct}
      remaining={progress.next === null ? null : progress.remaining}
      onClick={() => go("pass", "missions")}
    />
  );
  const paymentCard = <PaymentCard card={account?.virtualCard ?? null} holder={member.name || "Membro PRX"} onClick={() => go("bank", "cartoes")} />;

  return (
    <div className="grid gap-9 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 space-y-9 lg:col-span-7">
        {/* Topo: saldo */}
        <motion.section aria-label="Saldo" initial="hidden" animate="show" custom={0} variants={reveal}>
          <BalanceFigure
            label={account && account.status !== "active" ? "Saldo da conta · em ativação" : "Saldo da conta"}
            value={account?.balance ?? 0}
            hidden={hidden}
            action={
              <IconButton tone="plain" label={hidden ? "Mostrar saldo" : "Ocultar saldo"} aria-pressed={hidden} onClick={toggleHidden} className="-mr-2 h-10 w-10">
                {hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </IconButton>
            }
          />
        </motion.section>

        {/* Cartões em carrossel (no desktop ficam na coluna lateral) */}
        <motion.section aria-label="Cartões" initial="hidden" animate="show" custom={1} variants={reveal} className="lg:hidden">
          {/* pb/-mb: espaço para a sombra dos cartões não ser cortada pela rolagem. */}
          <ul className="-mx-4 -mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 scrollbar-none touch-pan-x overscroll-x-contain sm:-mx-6 sm:px-6">
            <li className="w-[80%] max-w-[320px] shrink-0 snap-center">{paymentCard}</li>
            <li className="w-[80%] max-w-[320px] shrink-0 snap-center">{scoreCard}</li>
          </ul>
        </motion.section>

        {/* Ações rápidas */}
        <motion.nav aria-label="Ações rápidas" initial="hidden" animate="show" custom={2} variants={reveal} className="grid grid-cols-4 gap-3 sm:gap-4">
          <ActionTile label="Enviar" icon={<IconSend size={20} />} onClick={() => go("bank", "pix")} />
          <ActionTile label="Receber" icon={<IconReceive size={20} />} onClick={() => go("bank", "cobrar")} />
          <ActionTile label="Área Pix" icon={<IconPix size={20} />} onClick={() => go("bank", "chaves")} />
          <ActionTile label="Mais" icon={<IconChevronDown size={20} />} onClick={() => setMoreOpen(true)} />
        </motion.nav>

        {/* Base da pirâmide: atividade */}
        <motion.section aria-labelledby="home-activity" initial="hidden" animate="show" custom={3} variants={reveal}>
          <SectionHeader id="home-activity" title="Atividade geral" action={<TextLink onClick={() => go("bank", "extrato")}>Ver todas</TextLink>} />
          {transactions.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Nenhuma movimentação ainda"
                body={account?.status === "active" ? "Pix, compras e cashbacks aparecem aqui." : "Sua conta PRX BANK está em ativação. Pix, compras e cashbacks aparecem aqui depois."}
              />
            </div>
          ) : (
            <ul className="mt-2">
              {transactions.slice(0, 5).map((tx) => (
                <TransactionRow key={tx.id} tx={tx} hidden={hidden} />
              ))}
            </ul>
          )}
        </motion.section>

        {benefits.length > 0 && (
          <motion.section aria-labelledby="home-pass" initial="hidden" animate="show" custom={4} variants={reveal}>
            <SectionHeader id="home-pass" title="No PASS agora" action={<TextLink onClick={() => go("pass")}>Ver todos</TextLink>} />
            <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none touch-pan-x sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              {benefits.slice(0, 8).map((benefit) => (
                <li key={benefit.id} className="w-[64%] min-[420px]:w-[220px] shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => go("pass", `beneficio:${benefit.id}`)}
                    className="flex h-full w-full cursor-pointer flex-col justify-between gap-6 rounded-3xl bg-surface p-5 text-left transition-colors hover:bg-line"
                  >
                    <span className="text-2xl font-semibold leading-none tracking-[-0.03em] text-primary">{benefit.discountLabel}</span>
                    <span>
                      <span className="block truncate text-[15px] font-medium text-ink">{benefit.partnerName}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{benefit.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </div>

      <aside className="min-w-0 space-y-9 lg:col-span-5" aria-label="Resumo">
        <div className="hidden space-y-4 lg:block">
          {paymentCard}
          {scoreCard}
        </div>

        <section aria-labelledby="home-vouchers" className="flex items-center justify-between gap-4 rounded-3xl bg-surface p-5">
          <div>
            <h2 id="home-vouchers" className="text-[13px] font-medium text-muted-foreground">
              Vouchers ativos
            </h2>
            <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.035em] text-ink">{activeVouchers.length}</p>
          </div>
          <TextLink onClick={() => go("pass", activeVouchers.length > 0 ? "vouchers" : null)} className="bg-card hover:bg-background">
            {activeVouchers.length > 0 ? "Mostrar QR" : "Explorar"}
          </TextLink>
        </section>

        <section aria-labelledby="home-missions">
          <SectionHeader id="home-missions" title="Missões" action={<TextLink onClick={() => go("pass", "missions")}>Ver todas</TextLink>} />
          {suggestedMissions.length === 0 ? (
            <p className="mt-3 rounded-3xl bg-surface p-5 text-sm text-muted-foreground">Nenhuma missão aberta agora. Novas missões aparecem aqui.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {suggestedMissions.map((mission) => (
                <li key={mission.id}>
                  <button
                    type="button"
                    onClick={() => go("pass", "missions")}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-3xl bg-surface p-4 text-left transition-colors hover:bg-line"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{mission.title}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="flex-1">
                          <ProgressBar value={mission.progress} max={mission.total || 1} label={`Progresso de ${mission.title}`} />
                        </div>
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {mission.progress}/{mission.total}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/[0.09] px-2.5 py-1 text-[12px] font-semibold text-primary">+{mission.xpReward} XP</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {nextEvent && (
          <section aria-labelledby="home-next-event">
            <SectionHeader id="home-next-event" title="Próximo evento" action={<TextLink onClick={() => go("live")}>Agenda</TextLink>} />
            <button
              type="button"
              onClick={() => go("live")}
              className="mt-3 flex w-full cursor-pointer items-end justify-between gap-5 rounded-3xl bg-surface p-5 text-left transition-colors hover:bg-line"
            >
              <div className="min-w-0 space-y-3">
                <span className="inline-flex rounded-full bg-primary/[0.09] px-2.5 py-0.5 text-[12px] font-semibold text-primary">{nextEvent.seriesLabel}</span>
                <div>
                  <p className="text-lg font-semibold leading-snug tracking-[-0.02em] text-ink">{nextEvent.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {nextEvent.venue} · {nextEvent.city}
                  </p>
                </div>
              </div>
              <EventDate iso={nextEvent.startsAt} />
            </button>
            {openTickets.length > 0 && (
              <TextLink onClick={() => go("live", "ingressos")} className="mt-3">
                Meus ingressos
              </TextLink>
            )}
          </section>
        )}
      </aside>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais ações">
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 pb-2">
          {more.map(({ label, Icon, tab, sub }) => (
            <ActionTile
              key={label}
              label={label}
              icon={<Icon size={20} />}
              onClick={() => {
                setMoreOpen(false);
                go(tab, sub);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
