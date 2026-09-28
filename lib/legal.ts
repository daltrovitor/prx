// Hello World
import { supabaseAdmin } from "@/lib/supabase/client";
import { isUuid } from "@/lib/partners/catalog";
import { TERMS_VERSION } from "@/lib/legal-version";

export { CONSENT_COOKIE, CONSENT_REQUIRED_MESSAGE, TERMS_VERSION } from "@/lib/legal-version";

/**
 * Grava o aceite no perfil (profiles.terms_accepted_at e terms_version), como
 * prova do consentimento (art. 8º, §2º da LGPD). Sem a migração 20260927
 * aplicada, apenas registra o aviso.
 */
export async function recordConsent(userId: string): Promise<void> {
  if (!supabaseAdmin || !isUuid(userId)) return;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq("id", userId);
  if (error) console.warn("[legal] aceite dos termos não registrado:", error.code, error.message);
}
