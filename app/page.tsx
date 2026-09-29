// Hello World
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RevolutLanding } from "@/components/marketing/revolut-landing";
import { AppShell } from "@/components/app/app-shell";
import { QuickLogin } from "@/components/auth/quick-login";
import { ParentShell } from "@/components/family/parent-shell";
import { useFamilyState } from "@/components/family/family-client";
import { familyNotice } from "@/components/family/family-notice";
import { useKnownAccount } from "@/lib/known-account";
import { PrxLoader } from "@/components/brand/prx-loader";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user, loading, logout, unlocked } = useAuth();
  const known = useKnownAccount();
  // Contas de equipe (admin, parceiro, staff) não passam pelas regras de família.
  const member = user && user.role === "user" ? user : null;
  const { state: family, unavailable: familyUnavailable } = useFamilyState(member?.id ?? null);
  const [viewMode, setViewMode] = useState<"app" | "showcase">("app");
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (!loading && member && (!member.cpf || !member.phone)) {
      window.location.href = "/cadastro/completar";
    }
  }, [loading, member]);

  let content: ReactNode = null;

  if (!loading && known && (!user || !unlocked)) {
    // "Lembrar de mim": pula a landing e abre a tela de login dedicada (senha ou biometria).
    content = <QuickLogin account={known} />;
  } else if (!loading && member && !family && !familyUnavailable) {
    // Carregando a situação da conta na família (tipo e pendências).
    content = null;
  } else if (!loading && member && family?.identity?.accountType === "parent") {
    content = <ParentShell user={member} onLogout={() => void logout()} />;
  } else if (!loading && user && viewMode === "app") {
    content = <AppShell user={user} onLogout={() => void logout()} onViewShowcase={() => setViewMode("showcase")} notice={familyNotice(family)} />;
  } else if (!loading && user) {
    // Membro logado revendo a apresentação (landing) do PRX.
    content = <RevolutLanding onBackToApp={() => setViewMode("app")} />;
  } else if (!loading) {
    // Visitante: a landing Obsidian, com Entrar e Criar conta na própria página (#entrar / #criar-conta).
    content = <RevolutLanding onEnterApp={() => setViewMode("app")} />;
  }

  return (
    <>
      {!introDone && <PrxLoader ready={!loading} onComplete={() => setIntroDone(true)} />}
      {content}
    </>
  );
}
