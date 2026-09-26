// Hello World
"use client";

import { useState, type FormEvent } from "react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, Field, Input, Notice } from "@/components/app/ui";
import { useMainSiteUrl } from "@/lib/site";

interface PanelLoginProps {
  onSuccess: () => void;
}

interface LoginResponse {
  success?: boolean;
  error?: string;
}

/**
 * Tela de acesso compartilhada pelos painéis restritos (admin e parceiro).
 * Composição em proporção áurea: bloco grafite com a marca (38,2%) e o formulário (61,8%).
 */
export function PanelLogin({
  endpoint,
  title,
  description,
  sideTitle,
  sideBody,
  emailPlaceholder,
  submitLabel,
  onSuccess,
}: PanelLoginProps & {
  endpoint: string;
  title: string;
  description: string;
  sideTitle: string;
  sideBody: string;
  emailPlaceholder: string;
  submitLabel: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const homeUrl = useMainSiteUrl();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as LoginResponse;
      if (!res.ok || !data.success) {
        setError(data.error || "Credenciais inválidas.");
        return;
      }
      try {
        sessionStorage.setItem("prx_tab_active", "true");
        localStorage.setItem("prx_remember_me", "true");
      } catch {
        // storage indisponível
      }
      onSuccess();
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="prx-app grid min-h-dvh bg-background lg:grid-cols-[38.2fr_61.8fr]">
      {/* bg-ink/text-background inverte no modo escuro: o bloco da marca mantém contraste nos dois temas. */}
      <aside className="flex flex-col justify-between gap-10 bg-ink p-8 text-background sm:p-12">
        <PrxLogo variant="full" title="PRX" className="h-10 w-auto self-start text-background sm:h-12" />
        <div className="max-w-sm space-y-3">
          <p className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{sideTitle}</p>
          <p className="text-[15px] leading-relaxed text-background/75">{sideBody}</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.04em] text-ink">{title}</h1>
            <p className="mt-3 text-[15px] text-muted-foreground">{description}</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <Field label="E-mail">
              {(id) => (
                <Input id={id} type="email" autoComplete="email" required value={email} placeholder={emailPlaceholder} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <Field label="Senha">
              {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" block disabled={loading}>
              {loading ? "Entrando…" : submitLabel}
            </Button>
          </form>

          <a href={homeUrl} className="inline-flex min-h-10 items-center text-sm text-muted-foreground underline-offset-4 hover:text-ink hover:underline">
            ← Voltar para o app PRX
          </a>
        </div>
      </main>
    </div>
  );
}

export function AdminLogin({ onSuccess }: PanelLoginProps) {
  return (
    <PanelLogin
      endpoint="/api/admin/login"
      title="Painel administrativo"
      description="Membros, níveis, benefícios, missões e vouchers do PRX."
      sideTitle="Acesso restrito à equipe PRX."
      sideBody="Use apenas a sua conta de administrador e não compartilhe o acesso."
      emailPlaceholder="voce@empresa.com"
      submitLabel="Entrar no painel"
      onSuccess={onSuccess}
    />
  );
}
