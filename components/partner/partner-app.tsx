// Hello World
"use client";

import { useCallback, useState } from "react";
import { PartnerLogin } from "@/components/partner/partner-login";
import { PartnerDashboard, type PartnerUser } from "@/components/partner/partner-dashboard";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button } from "@/components/app/ui";
import { useMainSiteUrl } from "@/lib/site";
import { useThemeScope } from "@/components/theme-provider";

export type PartnerAuthStatus = "loading" | "unauthenticated" | "wrong_role" | "authenticated";

interface PartnerMeResponse {
  authenticated?: boolean;
  isPartner?: boolean;
  user?: PartnerUser;
}

export type PartnerAuthResult =
  | { status: "authenticated"; user: PartnerUser }
  | { status: "wrong_role"; user: PartnerUser | null }
  | { status: "unauthenticated"; user: null };

async function fetchPartnerAuth(): Promise<PartnerAuthResult> {
  try {
    const res = await fetch("/api/partner/me", { cache: "no-store" });
    const data = (await res.json()) as PartnerMeResponse;
    if (res.ok && data.authenticated && data.isPartner && data.user) return { status: "authenticated", user: data.user };
    if (data.authenticated && !data.isPartner) return { status: "wrong_role", user: data.user ?? null };
  } catch {
    // tratado como sessão ausente
  }
  return { status: "unauthenticated", user: null };
}

/**
 * Portal do parceiro. A sessão é verificada no servidor (app/partner/page.tsx)
 * e chega pronta em `initial`.
 */
export function PartnerApp({ initial }: { initial: PartnerAuthResult }) {
  useThemeScope("app");
  const [status, setStatus] = useState<PartnerAuthStatus>(initial.status);
  const [partner, setPartner] = useState<PartnerUser | null>(initial.status === "authenticated" ? initial.user : null);
  const [otherUser, setOtherUser] = useState<PartnerUser | null>(initial.status === "wrong_role" ? initial.user : null);
  const homeUrl = useMainSiteUrl();

  const apply = useCallback((result: PartnerAuthResult) => {
    setPartner(result.status === "authenticated" ? result.user : null);
    setOtherUser(result.status === "wrong_role" ? result.user : null);
    setStatus(result.status);
  }, []);

  const check = useCallback(() => fetchPartnerAuth().then(apply), [apply]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      apply({ status: "unauthenticated", user: null });
    }
  }

  if (status === "loading") {
    return (
      <div className="prx-app flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Verificando acesso">
        <PrxLogo variant="symbol" title="" className="h-10 w-auto text-ink" />
      </div>
    );
  }

  if (status === "wrong_role") {
    return (
      <main className="prx-app flex min-h-dvh items-center justify-center bg-background px-5">
        <div className="w-full max-w-md space-y-6">
          <PrxLogo variant="compact" title="PRX" className="h-7 w-auto text-ink" />
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink">Acesso só para parceiros</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Você entrou como <strong className="font-semibold text-ink">{otherUser?.email}</strong>. Este portal é exclusivo para contas de estabelecimentos
            credenciados.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={logout}>Trocar de conta</Button>
            <a href={homeUrl} className="inline-flex min-h-12 items-center justify-center rounded-full bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:bg-line">
              Ir para o app
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (status === "unauthenticated" || !partner) return <PartnerLogin onSuccess={check} />;

  return <PartnerDashboard user={partner} onLogout={logout} />;
}
