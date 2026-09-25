// Hello World
"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminMembersTab, type AdminUser } from "@/components/admin/admin-members-tab";
import { AdminBenefitsTab } from "@/components/admin/admin-benefits-tab";
import { AdminMissionsTab } from "@/components/admin/admin-missions-tab";
import { AdminVouchersTab } from "@/components/admin/admin-vouchers-tab";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, Segmented } from "@/components/app/ui";
import { IconExternal, IconLogout, IconRefresh } from "@/components/icons/prx-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Benefit, PassMission } from "@/lib/pass-data";
import type { SystemVoucher } from "@/lib/pass-store";
import { useMainSiteUrl } from "@/lib/site";

type TabKey = "members" | "benefits" | "missions" | "vouchers";

export interface AdminIdentity {
  name?: string;
  email?: string;
}

interface AdminData {
  users?: AdminUser[];
  benefits?: Benefit[];
  missions?: PassMission[];
  vouchers?: SystemVoucher[];
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
    const [u, b, m, v] = await Promise.all(
      ["/api/admin/users", "/api/admin/benefits", "/api/admin/missions", "/api/admin/vouchers"].map((url) =>
        fetch(url, { cache: "no-store" }).then((r) => r.json() as Promise<AdminData>)
      )
    );
    return {
      users: Array.isArray(u.users) ? u.users : undefined,
      benefits: Array.isArray(b.benefits) ? b.benefits : undefined,
      missions: Array.isArray(m.missions) ? m.missions : undefined,
      vouchers: Array.isArray(v.vouchers) ? v.vouchers : undefined,
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
  const [auth, setAuth] = useState<"checking" | "guest" | "admin">(initialAdmin ? "admin" : "guest");
  const [admin, setAdmin] = useState<AdminIdentity | null>(initialAdmin);
  const [tab, setTab] = useState<TabKey>("members");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [missions, setMissions] = useState<PassMission[]>([]);
  const [vouchers, setVouchers] = useState<SystemVoucher[]>([]);
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
      <div className="prx-app flex min-h-dvh items-center justify-center bg-white" role="status" aria-label="Verificando acesso">
        <PrxLogo variant="symbol" title="" className="h-10 w-auto text-ink" />
      </div>
    );
  }

  if (auth === "guest") return <AdminLogin onSuccess={checkAuth} />;

  const validVouchers = vouchers.filter((v) => v.status === "valid").length;
  const kpis = [
    { label: "Membros", value: users.length },
    { label: "Benefícios no catálogo", value: benefits.length },
    { label: "Vouchers válidos", value: validVouchers },
    { label: "Vouchers utilizados", value: vouchers.length - validVouchers },
    { label: "Missões ativas", value: missions.length },
  ];

  return (
    <div className="prx-app min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <PrxLogo variant="compact" title="PRX" className="h-6 w-auto text-ink sm:h-7" />
            <span className="hidden border-l border-line pl-4 text-sm font-medium text-muted-foreground sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-[13px] leading-tight md:block">
              <span className="block font-medium text-ink">{admin?.name || "Administrador"}</span>
              <span className="block text-muted-foreground">{admin?.email}</span>
            </span>
            <ThemeToggle />
            <a
              href={homeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden min-h-10 items-center gap-2 rounded-[3px] border border-line px-3.5 text-sm text-ink transition-colors hover:border-ink sm:inline-flex"
            >
              App
              <IconExternal size={16} />
            </a>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair do painel">
              <IconLogout size={18} />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink sm:text-5xl">Painel PRX</h1>
          <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={loading}>
            <IconRefresh size={16} />
            {loading ? "Atualizando…" : "Atualizar dados"}
          </Button>
        </div>

        <section aria-label="Indicadores" className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white p-5">
              <p className="text-[13px] text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </section>

        <Segmented
          label="Seções do painel"
          value={tab}
          onChange={setTab}
          options={[
            { value: "members", label: "Membros", count: users.length },
            { value: "benefits", label: "Benefícios", count: benefits.length },
            { value: "missions", label: "Missões", count: missions.length },
            { value: "vouchers", label: "Vouchers", count: vouchers.length },
          ]}
        />

        {tab === "members" && <AdminMembersTab users={users} onRefresh={loadData} />}
        {tab === "benefits" && <AdminBenefitsTab benefits={benefits} onRefresh={loadData} />}
        {tab === "missions" && <AdminMissionsTab missions={missions} onRefresh={loadData} />}
        {tab === "vouchers" && <AdminVouchersTab vouchers={vouchers} onRefresh={loadData} />}
      </main>
    </div>
  );
}
