// Hello World
import crypto from "crypto";

/**
 * Chave HMAC usada para assinar sessões (JWT) e tokens de QR dinâmico.
 *
 * Ordem de resolução:
 * 1. JWT_SECRET_OR_HMAC_KEY (recomendado — string aleatória com 32+ caracteres).
 * 2. Derivada do service role key do Supabase, que nunca sai do servidor.
 *    Evita que produção caia num segredo fixo publicado no repositório.
 * 3. Constante apenas para desenvolvimento local. Em produção, lança erro.
 *
 * Resolvida sob demanda para não quebrar o build quando as variáveis
 * existem só em runtime.
 */
let cachedSecret: string | null = null;

export function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const explicit = process.env.JWT_SECRET_OR_HMAC_KEY;
  if (explicit && explicit.length >= 32) {
    cachedSecret = explicit;
    return cachedSecret;
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (serviceRole) {
    cachedSecret = crypto.createHash("sha256").update(`prx-session:v1:${serviceRole}`).digest("hex");
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRX: defina JWT_SECRET_OR_HMAC_KEY (32+ caracteres) ou SUPABASE_SERVICE_ROLE_KEY para assinar sessões."
    );
  }

  cachedSecret = "prx-local-development-only-secret-do-not-use-in-production";
  return cachedSecret;
}

/** Contas de demonstração em memória só existem fora de produção. */
export const DEMO_ACCOUNTS_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.PRX_DISABLE_DEMO_ACCOUNTS !== "true";
