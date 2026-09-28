// Hello World
import { NextRequest, NextResponse } from "next/server";

/**
 * Roteamento por subdomínio.
 *   adminprx.<domínio>   → /admin   (painel administrativo)
 *   partnerprx.<domínio> → /partner (portal do parceiro)
 *   staffprx.<domínio>   → /staff   (Equipe PRX: portaria de eventos e balcão)
 * Os prefixos adminng./partnerng. são os domínios anteriores ao rebrand e
 * continuam aceitos enquanto o DNS é migrado.
 *
 * prx.app.br (e www.) → /em-breve (teaser de lançamento com a Lista VIP).
 * /nova-landing é a prévia da nova página inicial: abre no domínio principal e no
 * subdomínio do admin, mas a própria página exige sessão de administrador.
 * Outros hosts de teaser podem ser adicionados em PRX_TEASER_HOSTS (vírgula).
 */
const SUBDOMAIN_ROUTES: ReadonlyArray<{ prefixes: readonly string[]; path: "/admin" | "/partner" | "/staff" }> = [
  { prefixes: ["adminprx.", "adminng."], path: "/admin" },
  { prefixes: ["partnerprx.", "partnerng."], path: "/partner" },
  { prefixes: ["staffprx."], path: "/staff" },
];

/** Páginas públicas com rota própria no domínio principal (o app continua sendo só "/"). */
const PUBLIC_PAGES = new Set(["/termos", "/privacidade", "/em-breve", "/sou-pai", "/nova-landing"]);
/** Prévia da nova landing, aberta dentro do painel admin (mesma origem do iframe). */
const ADMIN_PAGES = new Set(["/nova-landing"]);
/** No domínio de teaser, só o teaser e os documentos legais. */
const TEASER_PAGES = new Set(["/termos", "/privacidade"]);

function isTeaserHost(host: string): boolean {
  const name = host.split(":")[0];
  const extra = (process.env.PRX_TEASER_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return name === "prx.app.br" || name === "www.prx.app.br" || extra.includes(name);
}

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const { pathname } = req.nextUrl;

  // Assets estáticos, rotas internas, API e callback OAuth passam direto.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const match = SUBDOMAIN_ROUTES.find(({ prefixes }) => prefixes.some((prefix) => host.startsWith(prefix)));
  const url = req.nextUrl.clone();

  if (!match && isTeaserHost(host)) {
    if (pathname === "/" || pathname === "") {
      url.pathname = "/em-breve";
      return NextResponse.rewrite(url);
    }
    if (TEASER_PAGES.has(pathname)) return NextResponse.next();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (match) {
    if (match.path === "/admin" && ADMIN_PAGES.has(pathname)) return NextResponse.next();
    if (pathname === "/" || pathname === "") {
      url.pathname = match.path;
      return NextResponse.rewrite(url);
    }
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Domínio principal: o app é uma única rota; qualquer caminho digitado volta para "/".
  // Exceção: páginas públicas (legais, teaser, Sou Pai e a prévia protegida da nova landing).
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (pathname !== "/" && pathname !== "") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
