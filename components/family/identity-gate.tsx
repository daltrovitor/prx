// Hello World
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { PrxLogo } from "@/components/brand/prx-logo";
import { Button, Notice } from "@/components/app/ui";
import { DocumentPicker } from "@/components/family/document-picker";
import { postJson } from "@/components/family/family-client";
import { EMPTY_IDENTITY, SignupIdentityFields, identityProblem, type SignupIdentity } from "@/components/auth/signup-identity";
import { useThemeScope } from "@/components/theme-provider";
import type { DocumentRef } from "@/lib/family/types";

export const APP_INPUT_CLASS =
  "w-full h-12 rounded-2xl border border-transparent bg-surface text-[15px] text-ink placeholder:text-[#8a8a96] transition-[background-color,border-color,box-shadow] hover:border-input focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10";

/** Moldura das telas de pendência da conta: vidro sobre branco, marca no topo e rodapé ViraWeb. */
export function GateFrame({ title, subtitle, children, onLogout }: { title: string; subtitle: string; children: ReactNode; onLogout: () => void }) {
  useThemeScope("app");
  return (
    <div className="prx-app isolate flex min-h-dvh flex-col bg-background text-foreground selection:bg-[#6c0cf0] selection:text-white">
      <div aria-hidden className="prx-ambient" />
      <header className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-5 sm:h-20">
        <PrxLogo variant="compact" title="PRX" className="h-6 w-auto text-ink sm:h-7" />
        <button type="button" onClick={onLogout} className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-[14px] font-medium text-muted-foreground transition-colors hover:text-ink">
          Sair
        </button>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-10 pt-4 sm:items-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="w-full max-w-lg">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="glass mt-6 space-y-4 rounded-[28px] p-5 sm:p-6">{children}</div>
        </motion.div>
      </main>
    </div>
  );
}

/**
 * CPF e nascimento de quem entrou pelo Google (ou tem conta antiga sem esses
 * dados). A mesma regra de idade do cadastro vale aqui.
 */
export function IdentityGate({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [identity, setIdentity] = useState<SignupIdentity>(EMPTY_IDENTITY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<"PARENT_REQUIRED" | "OVER_AGE" | null>(null);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = identityProblem(identity);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const result = await postJson("/api/family/identity", { cpf: identity.cpf, birthDate: identity.birthDate, teenPath: identity.teenPath || undefined, parentEmail: identity.parentEmail || "" });
    setBusy(false);
    if (!result.ok) {
      if (result.code === "PARENT_REQUIRED" || result.code === "OVER_AGE") setBlocked(result.code);
      return setError(result.error);
    }
    onDone();
  }

  if (blocked === "PARENT_REQUIRED") {
    return (
      <GateFrame title="Peça ao seu responsável" subtitle="Menores de 16 anos entram no PRX pela Conta Pai: o responsável cria e acompanha a sua conta." onLogout={onLogout}>
        <Button block onClick={() => router.push("/sou-pai")}>
          Ir para a Conta Pai
        </Button>
        <Button block variant="ghost" onClick={onLogout}>
          Sair desta conta
        </Button>
      </GateFrame>
    );
  }

  return (
    <GateFrame title="Complete seu cadastro" subtitle="Precisamos do seu CPF e da data de nascimento para liberar a conta. Cada CPF abre uma única conta PRX." onLogout={onLogout}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <SignupIdentityFields value={identity} onChange={setIdentity} inputClass={APP_INPUT_CLASS} />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" block disabled={busy || blocked === "OVER_AGE"}>
          {busy ? "Salvando…" : "Continuar"}
        </Button>
      </form>
    </GateFrame>
  );
}

/** 16–17 que escolheu emancipação: certidão + documento com foto, analisados pela equipe PRX. */
export function EmancipationUpload({ onDone, onLogout, note }: { onDone: () => void; onLogout: () => void; note?: string }) {
  const [certificate, setCertificate] = useState<DocumentRef | null>(null);
  const [idDocument, setIdDocument] = useState<DocumentRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!certificate || !idDocument) return setError("Envie a certidão de emancipação e um documento com foto.");
    setBusy(true);
    setError(null);
    const result = await postJson("/api/family/emancipation", { documents: [certificate, idDocument] });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onDone();
  }

  return (
    <GateFrame title="Comprove sua emancipação" subtitle="Com 16 ou 17 anos, a conta sem responsável exige a certidão de emancipação. A equipe PRX confere em até 2 dias úteis." onLogout={onLogout}>
      {note && <Notice tone="warning">Análise anterior: {note}</Notice>}
      <DocumentPicker kind="emancipation_certificate" value={certificate} onChange={setCertificate} hint="Foto da certidão inteira, sem cortes" />
      <DocumentPicker kind="id_document" value={idDocument} onChange={setIdDocument} hint="RG ou CNH, frente e verso legíveis" />
      {error && <Notice tone="error">{error}</Notice>}
      <Button block onClick={() => void submit()} disabled={busy || !certificate || !idDocument}>
        {busy ? "Enviando…" : "Enviar para análise"}
      </Button>
    </GateFrame>
  );
}
