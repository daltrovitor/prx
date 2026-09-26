// Hello World
"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminMembersTab, type AdminUser } from "@/components/admin/admin-members-tab";
import { AdminBenefitsTab } from "@/components/admin/admin-benefits-tab";
import { AdminMissionsTab } from "@/components/admin/admin-missions-tab";
import { AdminVouchersTab } from "@/components/admin/admin-vouchers-tab";
import { AdminPartnersTab } from "@/components/admin/admin-partners-tab";
import { AdminEventsTab } from "@/components/admin/admin-events-tab";
import { AdminFoundersTab } from "@/components/admin/admin-founders-tab";
import { AdminStaffTab } from "@/components/admin/admin-staff-tab";
import type { PartnerOverview } from "@/lib/partners/service";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, IconButton, Segmented } from "@/components/app/ui";
import { DashboardHeader, roundLinkClass } from "@/components/app/dashboard-header";
import { IconExternal, IconLogout, IconRefresh } from "@/components/icons/prx-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { useThemeScope } from "@/components/theme-provider";
import type { Benefit, PassMission } from "@/lib/pass-data";
import type { SystemVoucher } from "@/lib/pass-store";
import { useMainSiteUrl } from "@/lib/site";

type TabKey = "members" | "partners" | "benefits" | "missions" | "vouchers" | "events" | "founders" | "staff";

export interface AdminIdentity {
  name?: string;
  email?: string;
}

interface AdminData {
  users?: AdminUser[];
  benefits?: Benefit[];
  missions?: PassMission[];
  vouchers?: SystemVoucher[];
  partners?: PartnerOverview[];
}

async function fetchAdminIdentity(): Promise<AdminIdentity | null> {
  try {
    const res = await fetch("/api/admin/me", { cache: "no-store" });
    const data = (await res.json()) as { authenticated?: boolean; isAdmin?: boolean; user?: AdminIdentity };
    return res.ok && data.authenticated && data.isAdmin ? data.user ?? {} : null;
  } catch {
    return null;
  }
}

async function fetchAdminData(): Promise<AdminData> {
  try {
    const [u, b, m, v, p] = await Promise.all(
      ["/api/admin/users", "/api/admin/benefits", "/api/admin/missions", "/api/admin/vouchers", "/api/admin/partners"].map((url) =>
        fetch(url, { cache: "no-store" })
          .then((r) => r.json() as Promise<AdminData>)
          .catch((): AdminData => ({}))
      )
    );
    return {
      users: Array.isArray(u.users) ? u.users : undefined,
      benefits: Array.isArray(b.benefits) ? b.benefits : undefined,
      missions: Array.isArray(m.missions) ? m.missions : undefined,
      vouchers: Array.isArray(v.vouchers) ? v.vouchers : undefined,
      partners: Array.isArray(p.partners) ? p.partners : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Painel administrativo. A sessão é verificada no servidor (app/admin/page.tsx)
 * e chega pronta em `initialAdmin`: sem tela de carregamento nem "piscada" de login.
 */
export function AdminApp({ initialAdmin }: { initialAdmin: AdminIdentity | null }) {
  useThemeScope("app");
  const [auth, setAuth] = useState<"checking" | "guest" | "admin">(initialAdmin ? "admin" : "guest");
  const [admin, setAdmin] = useState<AdminIdentity | null>(initialAdmin);
  const [tab, setTab] = useState<TabKey>("members");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [missions, setMissions] = useState<PassMission[]>([]);
  const [vouchers, setVouchers] = useState<SystemVoucher[]>([]);
  const [partners, setPartners] = useState<PartnerOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const homeUrl = useMainSiteUrl();

  const applyAuth = useCallback((identity: AdminIdentity | null) => {
    setAdmin(identity);
    setAuth(identity ? "admin" : "guest");
  }, []);

  const checkAuth = useCallback(() => fetchAdminIdentity().then(applyAuth), [applyAuth]);

  const applyData = useCallback((data: AdminData) => {
    if (data.users) setUsers(data.users);
    if (data.benefits) setBenefits(data.benefits);
    if (data.missions) setMissions(data.missions);
    if (data.vouchers) setVouchers(data.vouchers);
    if (data.partners) setPartners(data.partners);
    setLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    applyData(await fetchAdminData());
  }, [applyData]);

  useEffect(() => {
    if (auth !== "admin") return;
    let active = true;
    fetchAdminData().then((data) => {
      if (active) applyData(data);
    });
    return () => {
      active = false;
    };
  }, [auth, applyData]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      applyAuth(null);
    }
  }

  if (auth === "checking") {
    return (
      <div className="prx-app flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Verificando acesso">
        <PrxLogo variant="symbol" title="" className="h-10 w-auto text-ink" />
      </div>
    );
  }

  if (auth === "guest") return <AdminLogin onSuccess={checkAuth} />;

  const validVouchers = vouchers.filter((v) => v.status === "valid").length;
  const kpis = [
    { label: "Membros", value: users.length },
    { label: "Parceiros ativos", value: partners.filter((p) => p.status === "ATIVO").length },
    { label: "Benefícios no catálogo", value: benefits.filter((b) => b.partnerId).length },
    { label: "Vouchers válidos", value: validVouchers },
    { label: "Vouchers utilizados", value: vouchers.length - validVouchers },
  ];

  return (
    <div className="prx-app min-h-dvh bg-background text-foreground">
      <DashboardHeader
        name={admin?.name || "Administrador"}
        subtitle={admin?.email}
        area="Admin"
        actions={
          <>
            <ThemeToggle variant="app" />
            <a href={homeUrl} target="_blank" rel="noopener noreferrer" className={roundLinkClass} aria-label="Abrir o app PRX em outra aba" title="Abrir o app">
              <IconExternal size={18} />
            </a>
            <IconButton label="Sair do painel" onClick={logout}>
              <IconLogout size={18} />
            </IconButton>
          </>
        }
      />

      <main className="mx-auto max-w-7xl space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">Painel PRX</h1>
          <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={loading}>
            <IconRefresh size={16} />
            {loading ? "Atualizando…" : "Atualizar dados"}
          </Button>
        </div>

        {/* Topo da pirâmide: indicadores */}
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-3xl bg-surface p-5">
              <p className="text-[13px] text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-[34px] font-light leading-none tracking-[-0.035em] text-ink [font-feature-settings:'pnum']">{kpi.value}</p>
            </div>
          ))}
        </section>

        <Segmented
          label="Seções do painel"
          value={tab}
          onChange={setTab}
          options={[
            { value: "members", label: "Membros", count: users.length },
            { value: "partners", label: "Parceiros", count: partners.length },
            { value: "benefits", label: "Benefícios", count: benefits.length },
            { value: "missions", label: "Missões", count: missions.length },
            { value: "vouchers", label: "Vouchers", count: vouchers.length },
            { value: "events", label: "Eventos" },
            { value: "founders", label: "Founders" },
            { value: "staff", label: "Equipe" },
          ]}
        />

        {tab === "members" && <AdminMembersTab users={users} onRefresh={loadData} />}
        {tab === "partners" && (
          <AdminPartnersTab partners={partners} benefits={benefits} users={users} onRefresh={loadData} onGoToBenefits={() => setTab("benefits")} />
        )}
        {tab === "benefits" && <AdminBenefitsTab benefits={benefits} partners={partners} onRefresh={loadData} />}
        {tab === "missions" && <AdminMissionsTab missions={missions} onRefresh={loadData} />}
        {tab === "vouchers" && <AdminVouchersTab vouchers={vouchers} onRefresh={loadData} />}
        {tab === "events" && <AdminEventsTab />}
        {tab === "founders" && <AdminFoundersTab />}
        {tab === "staff" && <AdminStaffTab />}
      </main>
    </div>
  );
}
