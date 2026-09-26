// Hello World
"use client";

import { useCallback, useEffect, useState } from "react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, EmptyState, Notice, Segmented } from "@/components/app/ui";
import { IconLogout } from "@/components/icons/prx-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { PartnerValidator } from "@/components/partner/partner-validator";
import { PartnerContracts } from "@/components/partner/partner-contracts";
import { PartnerCompany, type PartnerProfile } from "@/components/partner/partner-company";
import { MetricsPanel } from "@/components/partners/metrics-panel";
import type { PartnerCampaignView } from "@/lib/partners/service";

export interface PartnerUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

type Tab = "validar" | "contratos" | "metricas" | "empresa";

interface ProfileState {
  partner: PartnerProfile | null;
  missing: string[];
  error: string | null;
}

async function fetchProfile(): Promise<ProfileState> {
  try {
    const res = await fetch("/api/partner/profile", { cache: "no-store" });
    const data = (await res.json()) as { partner?: PartnerProfile; missing?: string[]; error?: string };
    if (!res.ok || !data.partner) return { partner: null, missing: [], error: data.error || "Não foi possível carregar o cadastro." };
    return { partner: data.partner, missing: data.missing ?? [], error: null };
  } catch {
    return { partner: null, missing: [], error: "Sem conexão com o servidor." };
  }
}

async function fetchCampaigns(): Promise<PartnerCampaignView[]> {
  try {
    const res = await fetch("/api/partner/campaigns", { cache: "no-store" });
    const data = (await res.json()) as { campaigns?: PartnerCampaignView[] };
    return res.ok && Array.isArray(data.campaigns) ? data.campaigns : [];
  } catch {
    return [];
  }
}

export function PartnerDashboard({ user, onLogout }: { user: PartnerUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("validar");
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [campaigns, setCampaigns] = useState<PartnerCampaignView[] | null>(null);

  const refreshCampaigns = useCallback(async () => setCampaigns(await fetchCampaigns()), []);

  useEffect(() => {
    let active = true;
    Promise.all([fetchProfile(), fetchCampaigns()]).then(([p, c]) => {
      if (!active) return;
      setProfile(p);
      setCampaigns(c);
      // Contrato esperando aceite abre direto na aba de contratos.
      if (c.some((campaign) => campaign.status === "sent")) setTab("contratos");
    });
    return () => {
      active = false;
    };
  }, []);

  const pending = campaigns?.filter((c) => c.status === "sent").length ?? 0;
  const partner = profile?.partner ?? null;

  return (
    <div className="prx-app min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <PrxLogo variant="compact" title="PRX" className="h-6 w-auto shrink-0 text-ink sm:h-7" />
            <span className="hidden truncate border-l border-line pl-4 text-sm font-medium text-muted-foreground sm:inline">{partner?.tradeName ?? "Parceiros"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-[13px] leading-tight md:block">
              <span className="block font-medium text-ink">{user.name}</span>
              <span className="block text-muted-foreground">{user.email}</span>
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Sair do portal">
              <IconLogout size={18} />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
        <h1 className="sr-only">Área do Parceiro PRX</h1>

        {profile?.error && !partner ? (
          <EmptyState title="Conta ainda sem parceiro vinculado" body={profile.error} />
        ) : (
          <>
            {partner && (partner.status === "SUSPENSO" || partner.status === "BLOQUEADO") && (
              <Notice tone="warning">A parceria está suspensa: o validador e os benefícios ficam pausados. Fale com a equipe PRX.</Notice>
            )}
            <Segmented
              label="Área do parceiro"
              value={tab}
              onChange={setTab}
              options={[
                { value: "validar", label: "Validar" },
                { value: "contratos", label: "Contratos", count: pending > 0 ? pending : undefined },
                { value: "metricas", label: "Métricas" },
                { value: "empresa", label: "Empresa" },
              ]}
            />

            {tab === "validar" && <PartnerValidator />}
            {tab === "contratos" && <PartnerContracts campaigns={campaigns} onChanged={refreshCampaigns} onCompleteProfile={() => setTab("empresa")} />}
            {tab === "metricas" && <MetricsPanel endpoint="/api/partner/metrics" />}
            {tab === "empresa" &&
              (partner ? (
                <PartnerCompany
                  profile={partner}
                  missing={profile?.missing ?? []}
                  onSaved={(data) => {
                    setProfile({ partner: data.partner, missing: data.missing, error: null });
                    void refreshCampaigns();
                  }}
                />
              ) : (
                <div className="h-32 bg-surface" aria-hidden />
              ))}
          </>
        )}
      </main>
    </div>
  );
}
