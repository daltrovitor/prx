// Hello World
import crypto from "crypto";

/**
 * Configuração do Asaas (BaaS do PRX BANK), lida só no servidor.
 *
 * O provedor liga apenas com BANK_PROVIDER=asaas e uma chave coerente com o
 * ambiente: chave de homologação ($aact_hmlg_) nunca fala com produção e
 * vice-versa. A URL base só aceita os hosts oficiais do Asaas, para que uma
 * variável mal configurada não mande a chave da conta mãe para outro servidor.
 */

export type AsaasEnvironment = "sandbox" | "production";

export interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
  environment: AsaasEnvironment;
}

const DEFAULT_BASE_URL: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const HOSTS: Record<AsaasEnvironment, ReadonlySet<string>> = {
  sandbox: new Set(["api-sandbox.asaas.com", "sandbox.asaas.com"]),
  production: new Set(["api.asaas.com", "www.asaas.com"]),
};

type Env = Record<string, string | undefined>;

/** URL base validada (https, host oficial do ambiente, caminho terminando em /v3). */
export function resolveBaseUrl(raw: string | undefined, environment: AsaasEnvironment): string | null {
  if (!raw?.trim()) return DEFAULT_BASE_URL[environment];
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !HOSTS[environment].has(url.hostname) || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/v3")) return null;
  return `${url.origin}${path}`;
}

/** Prefixo da chave diz o ambiente dela; chave sem prefixo conhecido é aceita (contas antigas). */
function keyEnvironment(apiKey: string): AsaasEnvironment | null {
  if (apiKey.startsWith("$aact_hmlg_")) return "sandbox";
  if (apiKey.startsWith("$aact_prod_")) return "production";
  return null;
}

let warned = false;
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[asaas] ${message}`);
}

/** Configuração ativa do Asaas, ou null quando o PRX BANK não usa o Asaas neste ambiente. */
export function readAsaasConfig(env: Env = process.env): AsaasConfig | null {
  if ((env.BANK_PROVIDER ?? "").trim().toLowerCase() !== "asaas") return null;
  const apiKey = (env.ASAAS_API_KEY ?? "").trim();
  // Toda chave do Asaas começa com $aact_; o resto é placeholder ou "$" expandido pelo .env.
  if (!apiKey.startsWith("$aact_")) {
    if (apiKey) warnOnce("ASAAS_API_KEY não parece uma chave do Asaas (esperado $aact_...; no .env escreva \\$aact_...). Integração desligada.");
    return null;
  }
  const environment: AsaasEnvironment = (env.ASAAS_ENVIRONMENT ?? "").trim().toLowerCase() === "production" ? "production" : "sandbox";

  const keyEnv = keyEnvironment(apiKey);
  if (keyEnv && keyEnv !== environment) {
    warnOnce(`ASAAS_API_KEY é de ${keyEnv} mas ASAAS_ENVIRONMENT=${environment}. Integração desligada.`);
    return null;
  }
  const baseUrl = resolveBaseUrl(env.ASAAS_API_URL, environment);
  if (!baseUrl) {
    warnOnce("ASAAS_API_URL inválida (precisa ser https, host oficial do Asaas para o ambiente e terminar em /v3). Integração desligada.");
    return null;
  }
  return { apiKey, baseUrl, environment };
}

/** Token que o Asaas manda no header asaas-access-token dos webhooks (32+ caracteres). */
export function webhookAuthToken(env: Env = process.env): string | null {
  const token = (env.ASAAS_WEBHOOK_AUTH_TOKEN ?? "").trim();
  return token.length >= 32 && !token.includes("your_webhook") ? token : null;
}

/** Compara o header do webhook com o token configurado, em tempo constante. */
export function webhookTokenMatches(header: string | null, expected: string | null = webhookAuthToken()): boolean {
  if (!header || !expected) return false;
  const a = crypto.createHash("sha256").update(header).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** URLs públicas dos webhooks PRX registradas em cada subconta. */
export function webhookUrls(env: Env = process.env): { events: string; validateWithdraw: string } | null {
  const origin = (env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  const events = (env.ASAAS_WEBHOOK_URL_EVENTS ?? "").trim() || (origin ? `${origin}/api/bank/webhooks/asaas` : "");
  const validateWithdraw = (env.ASAAS_WEBHOOK_URL_VALIDATE_WITHDRAW ?? "").trim() || (origin ? `${origin}/api/bank/webhooks/validate-withdraw` : "");
  const httpsOnly = (u: string) => /^https:\/\/[^\s/]+\/\S*$/.test(u);
  if (!httpsOnly(events) || !httpsOnly(validateWithdraw)) return null;
  return { events, validateWithdraw };
}
