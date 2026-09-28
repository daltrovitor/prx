// Hello World
"use client";

import { ageGroup } from "@/lib/family/age";
import { isValidCpf } from "@/lib/prx/pix";
import type { AgeGroup, TeenPath } from "@/lib/family/types";
import { cn } from "@/lib/utils";

export interface SignupIdentity {
  cpf: string;
  birthDate: string;
  teenPath: TeenPath | "";
  parentEmail: string;
}

export const EMPTY_IDENTITY: SignupIdentity = { cpf: "", birthDate: "", teenPath: "", parentEmail: "" };

/** Máscara de CPF enquanto digita: 000.000.000-00. */
export function maskCpfInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function groupOf(birthDate: string): AgeGroup | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const year = Number(birthDate.slice(0, 4));
  if (year < 1900 || new Date(`${birthDate}T12:00:00Z`).getTime() > Date.now()) return null;
  return ageGroup(birthDate);
}

/** Motivo que impede criar a conta agora (null = pode seguir). */
export function identityProblem(value: SignupIdentity): string | null {
  const digits = value.cpf.replace(/\D/g, "");
  if (digits.length < 11) return "Informe seu CPF.";
  if (!isValidCpf(digits)) return "CPF inválido. Confira os 11 números.";
  const group = groupOf(value.birthDate);
  if (!group) return "Informe sua data de nascimento.";
  if (group === "child") return "Menores de 16 anos entram pela Conta Pai.";
  if (group === "over") return "O PRX é para jovens até 29 anos.";
  if (group === "teen" && !value.teenPath) return "Escolha como você vai usar o PRX.";
  if (group === "teen" && value.teenPath === "linked" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.parentEmail)) return "Informe o e-mail do seu responsável.";
  return null;
}

/**
 * CPF e data de nascimento no cadastro, com a regra de idade aplicada antes de
 * a conta existir: <16 vai para a Conta Pai; 16–17 escolhe Conta Filho
 * (vinculada ao responsável) ou comprovar emancipação; 18–29 segue normal.
 * Usa as classes de campo da tela onde está (a landing tem estilo próprio).
 */
export function SignupIdentityFields({
  value,
  onChange,
  inputClass,
  parentAreaUrl = "/sou-pai",
}: {
  value: SignupIdentity;
  onChange: (next: SignupIdentity) => void;
  inputClass: string;
  parentAreaUrl?: string;
}) {
  const group = groupOf(value.birthDate);
  const set = (patch: Partial<SignupIdentity>) => onChange({ ...value, ...patch });
  const cpfDigits = value.cpf.replace(/\D/g, "");
  const cpfInvalid = cpfDigits.length === 11 && !isValidCpf(cpfDigits);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted-foreground">Data de nascimento</span>
          <input
            type="date"
            value={value.birthDate}
            onChange={(e) => set({ birthDate: e.target.value, teenPath: "" })}
            max={new Date().toISOString().slice(0, 10)}
            required
            autoComplete="bday"
            suppressHydrationWarning
            className={cn(inputClass, "cursor-pointer px-4")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted-foreground">CPF</span>
          <input
            type="text"
            inputMode="numeric"
            value={value.cpf}
            onChange={(e) => set({ cpf: maskCpfInput(e.target.value) })}
            placeholder="000.000.000-00"
            required
            aria-invalid={cpfInvalid || undefined}
            suppressHydrationWarning
            className={cn(inputClass, "px-4 tabular-nums")}
          />
        </label>
      </div>
      {cpfInvalid && <p className="text-[12px] text-red-600 dark:text-red-400">CPF inválido. Confira os 11 números.</p>}

      {group === "child" && (
        <div role="status" className="space-y-2 rounded-xl border border-violet-300/60 bg-violet-50 p-3 text-[13px] leading-relaxed text-violet-950 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100">
          <p>Menores de 16 anos entram no PRX pela Conta Pai: um responsável cria e acompanha a conta.</p>
          <a href={parentAreaUrl} className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#6c0cf0] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#5708c9]">
            Ir para a Conta Pai
          </a>
        </div>
      )}

      {group === "over" && (
        <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          O PRX é para jovens até 29 anos. Se você é responsável por alguém mais novo, abra a{" "}
          <a href={parentAreaUrl} className="cursor-pointer font-semibold text-[#6c0cf0] underline-offset-2 hover:underline dark:text-violet-300">
            Conta Pai
          </a>
          .
        </p>
      )}

      {group === "teen" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[12px] font-medium text-muted-foreground">Com 16 ou 17 anos, como você quer entrar?</legend>
          {(
            [
              { id: "linked", title: "Conta Filho", body: "Vinculada ao seu responsável, que acompanha e libera a conta." },
              { id: "emancipated", title: "Sou emancipado(a)", body: "Depois do cadastro, envie a certidão de emancipação e um documento com foto." },
            ] as const
          ).map((option) => {
            const active = value.teenPath === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 text-left transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#6c0cf0]",
                  active ? "border-[#6c0cf0] bg-violet-50 dark:bg-violet-500/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
                )}
              >
                <input type="radio" name="teen-path" value={option.id} checked={active} onChange={() => set({ teenPath: option.id })} className="mt-1 accent-[#6c0cf0]" />
                <span>
                  <span className="block text-[14px] font-semibold text-slate-900 dark:text-white">{option.title}</span>
                  <span className="block text-[12px] leading-snug text-slate-600 dark:text-gray-400">{option.body}</span>
                </span>
              </label>
            );
          })}
          {value.teenPath === "linked" && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted-foreground">E-mail do responsável (Conta Pai)</span>
              <input
                type="email"
                value={value.parentEmail}
                onChange={(e) => set({ parentEmail: e.target.value })}
                placeholder="responsavel@email.com"
                required
                suppressHydrationWarning
                className={cn(inputClass, "px-4")}
              />
              <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                Ele recebe o pedido na Conta Pai. Ainda não tem? Ele abre em{" "}
                <a href={parentAreaUrl} className="cursor-pointer font-medium text-[#6c0cf0] underline-offset-2 hover:underline dark:text-violet-300">
                  Sou Pai
                </a>
                .
              </span>
            </label>
          )}
        </fieldset>
      )}
    </div>
  );
}
