// Hello World
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/client";
import { dbError } from "@/lib/partners/errors";

/**
 * Lista de Espera VIP do prx.app.br. Guarda só o necessário (e-mail, nome
 * opcional e o momento do consentimento) e nunca revela se o e-mail já estava
 * na lista: a resposta é sempre a mesma.
 */

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Informe um e-mail válido."),
  name: z.string().trim().max(80).optional().default(""),
  consent: z.literal(true, { error: "Autorize o contato para entrar na lista." }),
});

const globalState = globalThis as unknown as { __prxWaitlist?: Map<string, { name: string; createdAt: string }> };
const memory = () => (globalState.__prxWaitlist ??= new Map());

export async function joinWaitlist(input: z.output<typeof waitlistSchema>, source = "prx.app.br"): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("waitlist_signups")
      .upsert({ email: input.email, name: input.name || null, source }, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw dbError(error, "Não foi possível entrar na lista agora");
    return;
  }
  if (!memory().has(input.email)) memory().set(input.email, { name: input.name, createdAt: new Date().toISOString() });
}

export function waitlistMemorySize(): number {
  return memory().size;
}
