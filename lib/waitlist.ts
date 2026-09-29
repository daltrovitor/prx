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

/** Um lead da Lista VIP como o painel admin mostra. `consentAt` é o aceite de contato (LGPD). */
export interface WaitlistEntry {
  email: string;
  name?: string | null;
  source: string;
  createdAt: string;
  consentAt: string;
}

interface MemoryLead {
  name: string;
  source: string;
  createdAt: string;
}

const globalState = globalThis as unknown as { __prxWaitlist?: Map<string, MemoryLead> };
const memory = (): Map<string, MemoryLead> => (globalState.__prxWaitlist ??= new Map());

export async function joinWaitlist(input: z.output<typeof waitlistSchema>, source = "prx.app.br"): Promise<void> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("waitlist_signups")
      .upsert({ email: input.email, name: input.name || null, source }, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw dbError(error, "Não foi possível entrar na lista agora");
    return;
  }
  if (!memory().has(input.email)) memory().set(input.email, { name: input.name, source, createdAt: new Date().toISOString() });
}

export function waitlistMemorySize(): number {
  return memory().size;
}

interface WaitlistRow {
  email: string;
  name: string | null;
  source: string | null;
  consent_at: string | null;
  created_at: string;
}

/**
 * Leads da Lista VIP para o painel admin, do mais recente ao mais antigo:
 * Supabase (quando configurado) somado à memória do servidor, sem e-mails repetidos.
 * O cadastro exige o aceite, então todo lead tem `consentAt`.
 */
export async function getWaitlistSignups(): Promise<WaitlistEntry[]> {
  const byEmail = new Map<string, WaitlistEntry>();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("waitlist_signups")
      .select("email, name, source, consent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw dbError(error, "Não foi possível carregar a lista de espera");
    for (const r of (data ?? []) as WaitlistRow[]) {
      byEmail.set(r.email, { email: r.email, name: r.name, source: r.source || "prx.app.br", createdAt: r.created_at, consentAt: r.consent_at || r.created_at });
    }
  }
  for (const [email, lead] of memory()) {
    if (!byEmail.has(email)) byEmail.set(email, { email, name: lead.name || null, source: lead.source, createdAt: lead.createdAt, consentAt: lead.createdAt });
  }
  return [...byEmail.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
