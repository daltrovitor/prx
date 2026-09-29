// Hello World
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ShieldCheck, UserCheck, ArrowRight, Loader2, Lock, Smartphone, CreditCard } from "lucide-react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Avatar, Button, Notice } from "@/components/app/ui";
import { TermsConsent } from "@/components/auth/terms-consent";
import { maskCpfInput } from "@/lib/cpf-mask";
import { isValidCpf } from "@/lib/partners/documents";
import { useAuth } from "@/hooks/use-auth";

const maskPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};

interface PendingUser {
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export default function CompletarCadastroPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/google/pending", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { pending?: boolean; user?: PendingUser | null };
        if (!alive) return;
        if (json.pending && json.user) {
          setPendingUser(json.user);
        } else if (user && (!user.cpf || !user.phone)) {
          // Usuário logado mas sem CPF/celular no perfil
          setPendingUser({ email: user.email, fullName: user.name, avatarUrl: user.avatarUrl });
          if (user.cpf) setCpf(maskCpfInput(user.cpf));
          if (user.phone) setPhone(maskPhone(user.phone));
        } else if (user && user.cpf && user.phone) {
          // Já está 100% completo, volta para o app
          router.replace("/");
          return;
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");

    if (!isValidCpf(cleanCpf)) {
      return setError("CPF inválido. Confira os 11 números digitados.");
    }
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
      return setError("Celular inválido. Informe o número com DDD.");
    }
    if (!termsAccepted) {
      return setError("Você precisa aceitar os Termos e a Política de Privacidade para concluir.");
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: cleanCpf,
          phone: cleanPhone,
          termsAccepted: true,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Não foi possível concluir o cadastro.");
      }

      await refreshUser();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao concluir cadastro.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#ffffff] p-4 text-[#09090b]">
        <Loader2 className="h-7 w-7 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#ffffff] text-[#09090b] selection:bg-[#7c3aed] selection:text-white">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200/80 px-6 sm:h-20 sm:px-10">
        <PrxLogo variant="compact" title="PRX" className="h-6 w-auto text-ink sm:h-7" />
        <a
          href="/"
          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          Cancelar e voltar
        </a>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed]/10 px-3.5 py-1 text-[12px] font-semibold text-[#7c3aed]">
              <ShieldCheck className="h-4 w-4" /> Passo final do cadastro
            </span>
            <h1 className="text-[28px] font-bold tracking-tight text-zinc-900 sm:text-[32px]">
              Complete seu cadastro
            </h1>
            <p className="text-[14px] leading-relaxed text-zinc-600">
              Para sua segurança, abertura de benefícios e cumprimento regulatório, informe seu CPF e celular para ativar sua conta.
            </p>
          </div>

          {pendingUser && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3.5">
              <Avatar name={pendingUser.fullName || pendingUser.email} src={pendingUser.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#7c3aed]" />
                  <p className="truncate text-[14px] font-semibold text-zinc-900">{pendingUser.fullName}</p>
                </div>
                <p className="truncate text-[12px] text-zinc-500">{pendingUser.email}</p>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm sm:p-7">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="cpf-input" className="block text-[13px] font-medium text-zinc-700">
                  CPF
                </label>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <input
                    id="cpf-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                    className="h-12 w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-[#7c3aed] focus:outline-none focus:ring-4 focus:ring-[#7c3aed]/15"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">Um CPF para uma única conta PRX exclusiva.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="phone-input" className="block text-[13px] font-medium text-zinc-700">
                  Celular / WhatsApp com DDD
                </label>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="(11) 98888-7777"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="h-12 w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-4 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-[#7c3aed] focus:outline-none focus:ring-4 focus:ring-[#7c3aed]/15"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">Usado para segurança, alertas e avisos importantes.</p>
              </div>

              <div className="pt-2">
                <TermsConsent
                  checked={termsAccepted}
                  onChange={(val) => {
                    setTermsAccepted(val);
                    if (val) setError(null);
                  }}
                />
              </div>

              {error && <Notice tone="error">{error}</Notice>}

              <Button
                type="submit"
                disabled={busy}
                className="w-full min-h-12 cursor-pointer bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-xl text-[15px]"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Concluindo cadastro…
                  </>
                ) : (
                  <>
                    Concluir cadastro e entrar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="flex items-center justify-center gap-2 text-center text-[12px] text-zinc-400">
            <Lock className="h-3.5 w-3.5" /> Seus dados pessoais estão protegidos conforme a LGPD.
          </div>
        </motion.div>
      </main>
    </div>
  );
}
