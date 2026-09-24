// Hello World
import { useSyncExternalStore } from "react";

/**
 * URL do app principal a partir de um subdomínio de painel. Pode ser fixada
 * com NEXT_PUBLIC_SITE_URL. Só chamar no cliente.
 *   adminprx.x.com / partnerprx.x.com → prx.x.com
 *   adminng.x.com  / partnerng.x.com  → nxtgen.x.com (domínios anteriores ao rebrand)
 */
export function getMainSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof window === "undefined") return "/";

  const { protocol, host } = window.location;
  const match = host.match(/^(adminprx|partnerprx|adminng|partnerng)\.(.+)$/);
  if (!match) return `${protocol}//${host}`;

  const [, prefix, root] = match;
  const isLocal = root.startsWith("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(root);
  if (isLocal) return `${protocol}//${root}`;

  const mainPrefix = prefix.endsWith("prx") ? "prx" : "nxtgen";
  return `${protocol}//${mainPrefix}.${root}`;
}

const noopSubscribe = () => () => undefined;

/** Versão reativa e segura para SSR de getMainSiteUrl (servidor devolve "/"). */
export function useMainSiteUrl(): string {
  return useSyncExternalStore(noopSubscribe, getMainSiteUrl, () => "/");
}
