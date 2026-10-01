// Hello World
"use client";

import { useMemo, useState } from "react";
import type { PassData } from "@/components/app/use-pass-data";
import type { AppTab } from "@/components/app/app-nav";
import { EmptyState, Sheet } from "@/components/app/ui";
import { IconBank, IconCalendar, IconChevronRight, IconCoin, IconLevel, IconQr } from "@/components/icons/prx-icons";
import type { BankNoticeItem } from "@/components/app/bank/use-bank-notices";
import type { MemberWallet } from "@/lib/live/service";
import type { PointsWallet } from "@/lib/points/types";

export interface Notice {
  id: string;
  kind: "voucher" | "mission" | "ticket" | "points" | "bank";
  title: string;
  body: string;
  tab: AppTab;
  sub: string | null;
}

const DAY = 86_400_000;
const short = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Avisos do sino: só coisas reais que pedem ação (voucher esperando uso,
 * missões abertas, ingresso nos próximos 14 dias) e as compras em parceiros
 * pontuadas nos últimos 7 dias. Nada de contador inventado.
 */
export function useNotices(pass: PassData, wallet: MemberWallet | null, points: PointsWallet | null = null, bank: ReadonlyArray<BankNoticeItem> = []): Notice[] {
  const [now] = useState(() => Date.now());
  return useMemo(() => {
    // PRX BANK: Pix recebido/enviado, contas e aprovação da conta (últimos 7 dias, não lidos primeiro).
    const banking: Notice[] = bank
      .filter((n) => !n.read || now - new Date(n.createdAt).getTime() <= 7 * DAY)
      .slice(0, 8)
      .map((n) => ({ id: `b-${n.id}`, kind: "bank" as const, title: n.title, body: n.body ? `${n.body} · ${short(n.createdAt)}` : short(n.createdAt), tab: "bank" as const, sub: null }));

    const vouchers: Notice[] = pass.vouchers
      .filter((v) => v.status === "valid")
      .map((v) => ({
        id: `v-${v.id}`,
        kind: "voucher",
        title: `${v.partnerName}: ${v.discountLabel}`,
        body: v.expiresAt ? `Voucher pronto. Use até ${short(v.expiresAt)}.` : "Voucher pronto. Mostre o QR Code no balcão.",
        tab: "pass",
        sub: "vouchers",
      }));

    const openMissions = pass.missions.filter((m) => !m.isCompleted && !m.isAccepted).length;
    const missions: Notice[] =
      openMissions > 0
        ? [
            {
              id: "missions",
              kind: "mission",
              title: `${openMissions} ${openMissions === 1 ? "missão disponível" : "missões disponíveis"}`,
              body: "Complete desafios e suba de nível no PRX Score.",
              tab: "pass",
              sub: "missions",
            },
          ]
        : [];

    const tickets: Notice[] = (wallet?.tickets ?? [])
      .filter((t) => t.status === "valid" || t.status === "pending_payment")
      .flatMap((t) => {
        const event = t.event;
        if (!event || event.status !== "published") return [];
        const starts = new Date(event.startsAt).getTime();
        if (t.status === "pending_payment") {
          return [
            {
              id: `p-${t.id}`,
              kind: "ticket" as const,
              title: `Reserva aguardando pagamento: ${event.title}`,
              body: t.holdUntil ? `Garantida até ${short(t.holdUntil)}.` : "Conclua o pagamento para receber o ingresso.",
              tab: "live" as const,
              sub: "ingressos",
            },
          ];
        }
        if (starts < now || starts - now > 14 * DAY) return [];
        return [{ id: `t-${t.id}`, kind: "ticket" as const, title: `Ingresso: ${event.title}`, body: `${short(event.startsAt)} · ${event.venue}`, tab: "live" as const, sub: "ingressos" }];
      });

    const purchases: Notice[] = (points?.purchases ?? [])
      .filter((p) => now - new Date(p.createdAt).getTime() <= 7 * DAY && (p.coins > 0 || p.xp > 0))
      .slice(0, 5)
      .map((p) => ({
        id: `c-${p.id}`,
        kind: "points" as const,
        title: `Você comprou em ${p.partnerName} e ganhou +${p.coins.toLocaleString("pt-BR")} PRX Coins e +${p.xp.toLocaleString("pt-BR")} XP!`,
        body: `${short(p.createdAt)} · Pix de ${p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        tab: "home" as const,
        sub: "pontos",
      }));

    const reviewed: Notice[] = (points?.claims ?? [])
      .filter((c) => c.status !== "pending" && c.reviewedAt && now - new Date(c.reviewedAt).getTime() <= 7 * DAY)
      .slice(0, 5)
      .map((c) => ({
        id: `r-${c.id}`,
        kind: "points" as const,
        title:
          c.status === "approved"
            ? `Aprovado: ${c.ruleTitle}. +${c.coins.toLocaleString("pt-BR")} PRX Coins e +${c.xp.toLocaleString("pt-BR")} XP`
            : `Não aprovado: ${c.ruleTitle}`,
        body: c.reviewNote || (c.status === "approved" ? "Os pontos já estão na sua carteira." : "Você pode enviar de novo com mais detalhes."),
        tab: "home" as const,
        sub: "pontos",
      }));

    return [...banking, ...purchases, ...reviewed, ...vouchers, ...tickets, ...missions].slice(0, 20);
  }, [bank, pass.vouchers, pass.missions, wallet, points?.purchases, points?.claims, now]);
}

const ICONS = { voucher: IconQr, mission: IconLevel, ticket: IconCalendar, points: IconCoin, bank: IconBank } as const;

export function NoticesSheet({
  open,
  onClose,
  notices,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  notices: Notice[];
  onGo: (tab: AppTab, sub: string | null) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Avisos" description={notices.length > 0 ? "O que está esperando por você." : undefined}>
      {notices.length === 0 ? (
        <EmptyState title="Tudo em dia" body="Pix, contas pagas, vouchers, missões, ingressos e pontos de compras em parceiros aparecem aqui." />
      ) : (
        <ul className="-mx-2 space-y-1">
          {notices.map((notice) => {
            const Icon = ICONS[notice.kind];
            return (
              <li key={notice.id}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGo(notice.tab, notice.sub);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.09] text-primary">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={notice.kind === "points" || notice.kind === "bank" ? "block text-[15px] font-medium leading-snug text-ink" : "block truncate text-[15px] font-medium text-ink"}>
                      {notice.title}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">{notice.body}</span>
                  </span>
                  <IconChevronRight size={18} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
