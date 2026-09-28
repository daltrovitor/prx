// Hello World
"use client";

import { useState } from "react";
import { Button, EmptyState, Notice, Segmented, Sheet } from "@/components/app/ui";
import { useConfirmToast } from "@/components/ui/confirm-toast";
import { levelProgress } from "@/lib/pass-data";
import { POINT_RULE_PERIOD_LABEL, POINT_SOURCE_LABEL, type MemberPointRule, type PointsWallet } from "@/lib/points/types";
import { cn } from "@/lib/utils";

const integer = new Intl.NumberFormat("pt-BR");
const when = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "short" });

type View = "ganhar" | "extrato";

interface PointsSheetProps {
  open: boolean;
  onClose: () => void;
  wallet: PointsWallet | null;
  error: string | null;
  onCheckin: (ruleId: string) => Promise<{ ok: true; earned?: { coins: number; xp: number } } | { ok: false; error: string }>;
}

/** Como ganhar (check-ins e regras automáticas) e o extrato de coins e XP. */
export function PointsSheet({ open, onClose, wallet, error, onCheckin }: PointsSheetProps) {
  const [view, setView] = useState<View>("ganhar");
  const [busy, setBusy] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { showToast } = useConfirmToast();
  const progress = levelProgress(wallet?.xp ?? 0);

  async function claim(rule: MemberPointRule) {
    setBusy(rule.id);
    setClaimError(null);
    const result = await onCheckin(rule.id);
    setBusy(null);
    if (!result.ok) return setClaimError(result.error);
    showToast("success", `+${integer.format(result.earned?.coins ?? rule.coins)} PRX Coins e +${integer.format(result.earned?.xp ?? rule.xp)} XP`);
  }

  const checkins = wallet?.rules.filter((r) => r.trigger === "checkin") ?? [];
  const automatic = wallet?.rules.filter((r) => r.trigger !== "checkin") ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="PRX Coins" description="Bom comportamento vira coins. Coins viram benefícios." size="lg">
      {!wallet ? (
        error ? <Notice tone="error">{error}</Notice> : <div role="status" aria-label="Carregando pontos" className="h-40 rounded-2xl bg-surface" />
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-3 gap-2">
            <Figure label="Coins" value={integer.format(wallet.coins)} />
            <Figure label="Nível" value={integer.format(progress.level)} />
            <Figure label="XP" value={integer.format(wallet.xp)} />
          </dl>

          <Segmented
            label="Pontos"
            value={view}
            onChange={setView}
            options={[
              { value: "ganhar", label: "Como ganhar" },
              { value: "extrato", label: "Extrato", count: wallet.transactions.length },
            ]}
          />

          {view === "ganhar" ? (
            <div className="space-y-6">
              {checkins.length > 0 && (
                <section aria-labelledby="points-checkins" className="space-y-2">
                  <h3 id="points-checkins" className="text-[13px] font-semibold text-ink">
                    Bom comportamento
                  </h3>
                  <ul className="space-y-2">
                    {checkins.map((rule) => (
                      <li key={rule.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-ink">{rule.title}</p>
                          {rule.description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{rule.description}</p>}
                          <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">
                            {POINT_RULE_PERIOD_LABEL[rule.periodicity]} · <span className="text-primary">+{integer.format(rule.coins)} coins</span> · +{integer.format(rule.xp)} XP
                          </p>
                        </div>
                        {rule.status === "available" ? (
                          <Button size="sm" onClick={() => void claim(rule)} disabled={busy !== null} className="min-h-12 shrink-0">
                            {busy === rule.id ? "Registrando…" : "Fazer check-in"}
                          </Button>
                        ) : (
                          <span className="inline-flex min-h-12 shrink-0 items-center text-[13px] text-muted-foreground">
                            {rule.status === "done" ? "Garantido" : rule.availableAt ? `Volta ${day.format(new Date(rule.availableAt)).replace(".", "")}` : "Feito"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {claimError && <Notice tone="error">{claimError}</Notice>}
                </section>
              )}

              {automatic.length > 0 && (
                <section aria-labelledby="points-auto" className="space-y-2">
                  <h3 id="points-auto" className="text-[13px] font-semibold text-ink">
                    Na hora, sem check-in
                  </h3>
                  <ul className="divide-y divide-line rounded-2xl bg-surface px-4">
                    {automatic.map((rule) => (
                      <li key={rule.id} className="flex items-start justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-ink">{rule.title}</p>
                          {rule.description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{rule.description}</p>}
                        </div>
                        <p className="shrink-0 text-right text-[13px] font-medium text-ink">
                          {rule.coins > 0 && <span className="block text-primary">+{integer.format(rule.coins)} coins</span>}
                          {rule.xp > 0 && <span className="block">+{integer.format(rule.xp)} XP</span>}
                          {rule.trigger === "partner_purchase" && <span className="block text-[12px] font-normal text-muted-foreground">a cada R$ 10</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : wallet.transactions.length === 0 ? (
            <EmptyState title="Extrato vazio" body="Check-ins, compras em parceiros e resgates aparecem aqui." />
          ) : (
            <ul className="divide-y divide-line">
              {wallet.transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-ink">{tx.description || POINT_SOURCE_LABEL[tx.source]}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {POINT_SOURCE_LABEL[tx.source]} · {when.format(new Date(tx.createdAt)).replace(".", "")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[14px] font-medium tabular-nums">
                    {tx.coinsDelta !== 0 && (
                      <span className={cn("block", tx.coinsDelta > 0 ? "text-success" : "text-ink")}>
                        {tx.coinsDelta > 0 ? "+" : "−"}
                        {integer.format(Math.abs(tx.coinsDelta))} coins
                      </span>
                    )}
                    {tx.xpDelta > 0 && <span className="block text-[12px] text-muted-foreground">+{integer.format(tx.xpDelta)} XP</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-3.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-[22px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{value}</dd>
    </div>
  );
}
