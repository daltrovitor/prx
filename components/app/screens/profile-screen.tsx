// Hello World
"use client";

import type { ReactNode } from "react";
import type { PassData } from "@/components/app/use-pass-data";
import { useAppNav } from "@/components/app/app-nav";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Avatar, Button, ProgressBar } from "@/components/app/ui";
import { IconCard, IconChevronRight, IconExternal, IconPix, IconTicket, IconUsers } from "@/components/icons/prx-icons";
import { ThemeToggle } from "@/components/theme-toggle";
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

export function ProfileScreen({ pass, onLogout, onViewShowcase }: ProfileScreenProps) {
  const { go } = useAppNav();
  const { member, vouchers, referralInfo } = pass;
  const progress = levelProgress(member.prxScore ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex flex-col items-center gap-4 pt-2 text-center">
        <Avatar name={member.name || "Membro PRX"} src={member.avatarUrl} size={88} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{member.name || "Membro PRX"}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {member.email} · {ROLE_LABEL[member.role] ?? "Membro"}
          </p>
        </div>
      </header>

      <section aria-label="Resumo do membro" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Nível" value={String(member.prxLevel || progress.level)} />
        <Metric label="PRX Score" value={(member.prxScore ?? 0).toLocaleString("pt-BR")} />
        <Metric label="Vouchers usados" value={String(vouchers.filter((v) => v.status !== "valid").length)} />
        <Metric label="Amigos" value={String(referralInfo.friendsInvitedCount)} />
      </section>

      <section aria-labelledby="profile-progress" className="space-y-3 rounded-3xl bg-surface p-5">
        <h2 id="profile-progress" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Progresso
        </h2>
        <ProgressBar value={progress.pct} label="Progresso até o próximo nível" />
        <p className="text-sm text-muted-foreground">
          {progress.next === null
            ? "Você chegou ao topo da régua do PRX Score."
            : `Mais ${progress.remaining.toLocaleString("pt-BR")} XP e você sobe para o nível ${progress.level + 1}. Missões e convites são o caminho mais rápido.`}
        </p>
      </section>

      <section aria-labelledby="profile-shortcuts">
        <h2 id="profile-shortcuts" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          Atalhos
        </h2>
        <ul className="mt-3 space-y-2">
          <Row icon={<IconUsers size={18} />} onClick={() => go("pass", "convidar")}>
            Convidar amigos
          </Row>
          <Row icon={<IconPix size={18} />} onClick={() => go("bank", "chaves")}>
            Minhas chaves Pix
          </Row>
          <Row icon={<IconCard size={18} />} onClick={() => go("bank", "cartoes")}>
            Cartões
          </Row>
          <Row icon={<IconTicket size={18} />} onClick={() => go("live", "ingressos")}>
            Ingressos
          </Row>
          <Row icon={<IconExternal size={18} />} onClick={onViewShowcase}>
            Conhecer o PRX
          </Row>
        </ul>
      </section>

      <section aria-labelledby="profile-appearance" className="flex items-center justify-between gap-4 rounded-3xl bg-surface p-4 pl-5">
        <h2 id="profile-appearance" className="text-[15px] font-medium text-ink">
          Aparência
        </h2>
        <ThemeToggle variant="app" showLabel />
      </section>

      <div className="flex flex-col items-center gap-6 pt-2">
        <Button variant="danger" onClick={onLogout} className="w-full sm:w-auto">
          Sair da conta
        </Button>
        <PrxLogo variant="full" title="PRX — Experiências que conectam gerações" className="h-8 w-auto text-ink opacity-80" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 sm:p-5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">{value}</p>
    </div>
  );
}

function Row({ children, icon, onClick }: { children: ReactNode; icon: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-3xl bg-surface px-4 text-left text-[15px] text-ink transition-colors hover:bg-line"
      >
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink">
          {icon}
        </span>
        <span className="flex-1">{children}</span>
        <IconChevronRight size={18} className="text-muted-foreground" />
      </button>
    </li>
  );
}
