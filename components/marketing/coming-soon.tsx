// Hello World
"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PrxRevealMark, addPrxRevealTweens, showPrxRevealFinal } from "@/components/brand/prx-logo-reveal";
import { AppThemeScope } from "@/components/marketing/app-theme-scope";
import { ViraWebCredit } from "@/components/brand/viraweb-credit";

gsap.registerPlugin(useGSAP);

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/**
 * Teaser do prx.app.br: a marca se monta no centro (peças deslizando e se
 * unindo, assinatura revelada), a mensagem de lançamento sobe logo depois e a
 * Lista de Espera VIP fica a um campo de distância.
 */
export function ComingSoon() {
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const emailId = useId();
  const consentId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        showPrxRevealFinal(q, gsap);
        gsap.set(q("[data-logo]"), { autoAlpha: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.2 });
      addPrxRevealTweens(tl, q, gsap);
      gsap.set(q("[data-logo]"), { autoAlpha: 1 });
      // Texto e formulário ficam visíveis desde o primeiro quadro (legíveis e com contraste pleno);
      // só deslizam enquanto a marca se monta.
      tl.from(q("[data-headline]"), { y: 20, duration: 1.1, ease: "power3.out" }, 0)
        .from(q("[data-after]"), { y: 24, duration: 0.9, stagger: 0.12, ease: "power3.out" }, 0.1);
    },
    { scope: rootRef }
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent) return setStatus({ kind: "error", message: "Autorize o contato para entrar na lista." });
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent }) });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) return setStatus({ kind: "error", message: json.error || "Não foi possível entrar na lista agora." });
      setStatus({ kind: "done", message: json.message || "Você está na Lista VIP." });
      setEmail("");
    } catch {
      setStatus({ kind: "error", message: "Sem conexão. Tente de novo em instantes." });
    }
  }

  return (
    <div ref={rootRef} className="prx-app flex min-h-dvh flex-col bg-background text-foreground selection:bg-[#6c0cf0] selection:text-white">
      <AppThemeScope />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
        <h1 className="sr-only">PRX · Experiências que conectam gerações. O futuro paga mais. Em breve em prx.app.br</h1>
        <PrxRevealMark uid={uid} className="h-auto w-[min(84vw,520px)] overflow-visible text-ink" />

        <div className="mt-14 w-full max-w-xl text-center">
          <p data-headline className="text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink min-[380px]:text-[44px] sm:text-6xl">
            O futuro paga mais.
          </p>
          <p data-after className="mt-4 text-lg text-muted-foreground sm:text-xl">
            Em breve em <span className="font-semibold text-ink">prx.app.br</span>
          </p>

          <form data-after onSubmit={submit} className="mx-auto mt-10 max-w-md space-y-3 text-left" noValidate>
            <label htmlFor={emailId} className="block text-[13px] font-medium text-ink">
              Lista de Espera VIP
            </label>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                suppressHydrationWarning
                aria-invalid={status.kind === "error"}
                aria-describedby={`${emailId}-status`}
                className="h-12 w-full min-w-0 rounded-xl border border-input bg-card px-4 min-[420px]:flex-1 text-[16px] text-ink placeholder:text-[#8a8a96] focus:border-[#6c0cf0] focus:outline-none focus:ring-4 focus:ring-[#6c0cf0]/10"
              />
              <button
                type="submit"
                disabled={status.kind === "sending" || !consent}
                className="min-h-12 cursor-pointer rounded-xl bg-[#6c0cf0] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#5708c9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status.kind === "sending" ? "Enviando…" : "Quero entrar"}
              </button>
            </div>
            <div className="flex min-h-12 items-start gap-3">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                suppressHydrationWarning
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#6c0cf0]"
              />
              <label htmlFor={consentId} className="cursor-pointer text-[13px] leading-relaxed text-muted-foreground">
                Autorizo a PRX a me avisar do lançamento por e-mail, conforme a{" "}
                <a href="/privacidade" target="_blank" rel="noopener" className="cursor-pointer font-medium text-[#6c0cf0] underline underline-offset-2 dark:text-[#b288f7]">
                  Política de Privacidade
                </a>
                .
              </label>
            </div>
            <p id={`${emailId}-status`} role="status" aria-live="polite" className={status.kind === "error" ? "text-[13px] text-destructive" : "text-[13px] text-success"}>
              {status.kind === "done" || status.kind === "error" ? status.message : ""}
            </p>
          </form>
        </div>
      </main>
      <footer className="px-4 pb-8 text-center text-[12px] text-muted-foreground">
        <a href="/termos" className="inline-flex min-h-10 cursor-pointer items-center px-2 hover:text-ink">
          Termos de Uso
        </a>
        ·
        <a href="/privacidade" className="inline-flex min-h-10 cursor-pointer items-center px-2 hover:text-ink">
          Privacidade
        </a>
        <ViraWebCredit className="mt-1" />
      </footer>
    </div>
  );
}
