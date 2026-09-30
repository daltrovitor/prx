// Hello World
import { z } from "zod";

/*
 * Senha dos cadastros PRX (membro, Conta Pai e conta do filho): 8 caracteres ou
 * mais, com letra, número e caractere especial. O login continua aceitando as
 * senhas antigas; a regra vale para senhas novas.
 */

export interface PasswordRule {
  id: "length" | "letter" | "number" | "special";
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: ReadonlyArray<PasswordRule> = [
  { id: "length", label: "8 caracteres ou mais", test: (p) => p.length >= 8 },
  { id: "letter", label: "Uma letra", test: (p) => /\p{L}/u.test(p) },
  { id: "number", label: "Um número", test: (p) => /\d/.test(p) },
  { id: "special", label: "Um caractere especial (!@#$%…)", test: (p) => /[^\p{L}\d\s]/u.test(p) },
];

export const PASSWORD_HINT = "8 caracteres ou mais, com letras, números e um caractere especial.";
export const PASSWORD_MISMATCH = "As senhas não conferem.";

/** Primeira regra que falta, em frase ("A senha precisa ter um número."), ou null se a senha é forte. */
export function passwordProblem(password: string): string | null {
  const missing = PASSWORD_RULES.find((rule) => !rule.test(password));
  if (!missing) return null;
  return missing.id === "length" ? "A senha precisa ter 8 caracteres ou mais." : `A senha precisa ter ${missing.label.toLowerCase()}.`;
}

export const strongPasswordSchema = z
  .string()
  .max(128, "Senha muito longa.")
  .superRefine((password, ctx) => {
    const problem = passwordProblem(password);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
