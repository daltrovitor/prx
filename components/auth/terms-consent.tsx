// Hello World
"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Aceite obrigatório dos Termos de Uso e da Política de Privacidade (LGPD).
 * Enquanto desmarcado, Entrar, Criar Conta e Google ficam bloqueados.
 * Os links abrem em outra aba para não perder o que já foi digitado.
 */
export function TermsConsent({ checked, onChange, className }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex min-h-12 items-start gap-3 rounded-xl py-1 text-left", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        aria-describedby={`${id}-hint`}
        suppressHydrationWarning
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md accent-[#6c0cf0]"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-[12px] leading-relaxed text-foreground sm:text-[13px]">
          Li e concordo com os{" "}
          <a href="/termos" target="_blank" rel="noopener" className="cursor-pointer font-semibold text-[#6c0cf0] underline underline-offset-2 dark:text-[#b288f7]">
            Termos de Uso
          </a>{" "}
          e com a{" "}
          <a href="/privacidade" target="_blank" rel="noopener" className="cursor-pointer font-semibold text-[#6c0cf0] underline underline-offset-2 dark:text-[#b288f7]">
            Política de Privacidade (LGPD)
          </a>{" "}
          do PRX e autorizo o tratamento dos meus dados cadastrais.
        </label>
        {!checked && (
          <p id={`${id}-hint`} className="mt-1 text-[12px] text-muted-foreground">
            Marque para liberar Entrar, Criar Conta e Google.
          </p>
        )}
      </div>
    </div>
  );
}
