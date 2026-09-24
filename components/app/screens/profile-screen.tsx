// Hello World
"use client";

import type { ReactNode } from "react";
import type { PassData } from "@/components/app/use-pass-data";
import { useAppNav } from "@/components/app/app-nav";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, ProgressBar } from "@/components/app/ui";
import { IconChevronRight } from "@/components/icons/prx-icons";
import { levelProgress } from "@/lib/pass-data";

interface ProfileScreenProps {
  pass: PassData;
  initials: string;
  onLogout: () => void;
  onViewShowcase: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  user: "Membro",
  partner: "Parceiro",
  staff: "Equipe",
  admin: "Administrador",
};

export function ProfileScreen({ pass, initials, onLogout, onViewShowcase }: ProfileScreenProps) {
  const { go } = useAppNav();
  const { member, vouchers, referralInfo } = pass;
  const progress = levelProgress(member.prxScore ?? 0);

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-ink font-display text-3xl font-semibold tracking-[-0.03em] text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink sm:text-5xl">{member.name || "Membro PRX"}</h1>
            <p className="mt-2 truncate text-[15px] text-muted-foreground">
              {member.email} · {ROLE_LABEL[member.role] ?? "Membro"}
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Resumo do membro" className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        <Metric label="Nível" value={String(member.prxLevel || progress.level)} />
        <Metric label="PRX Score" value={`${(member.prxScore ?? 0).toLocaleString("pt-BR")}`} />
        <Metric label="Vouchers usados" value={String(vouchers.filter((v) => v.status !== "valid").length)} />
        <Metric label="Amigos indicados" value={String(referralInfo.friendsInvitedCount)} />
      </section>

      <section aria-labelledby="profile-progress" className="max-w-xl space-y-3">
        <h2 id="profile-progress" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
          Progresso
        </h2>
        <ProgressBar value={progress.pct} label="Progresso até o próximo nível" />
        <p className="text-sm text-muted-foreground">
          {progress.next === null
            ? "Você chegou ao topo da régua do PRX Score."
            : `Mais ${progress.remaining.toLocaleString("pt-BR")} XP e você sobe para o nível ${progress.level + 1}. Missões e convites são o caminho mais rápido.`}
        </p>
      </section>

      <section aria-labelledby="profile-shortcuts" className="max-w-xl">
        <h2 id="profile-shortcuts" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
          Atalhos
        </h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          <Row onClick={() => go("pass", "convidar")}>Convidar amigos</Row>
          <Row onClick={() => go("bank", "chaves")}>Minhas chaves Pix</Row>
          <Row onClick={() => go("bank", "cartoes")}>Cartões</Row>
          <Row onClick={() => go("live", "ingressos")}>Ingressos</Row>
          <Row onClick={onViewShowcase}>Conhecer o PRX</Row>
        </ul>
      </section>

      <div className="flex flex-col items-start gap-8 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <PrxLogo variant="full" title="PRX — Experiências que conectam gerações" className="h-12 w-auto text-ink" />
        <Button variant="danger" onClick={onLogout}>
          Sair da conta
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink tabular-nums">{value}</p>
    </div>
  );
}

function Row({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full cursor-pointer items-center justify-between text-left text-[15px] text-ink">
        {children}
        <IconChevronRight size={18} className="text-muted-foreground" />
      </button>
    </li>
  );
}
