// Hello World
import { NextRequest, NextResponse } from "next/server";

/**
 * Roteamento por subdomínio.
 *   adminprx.<domínio>   → /admin   (painel administrativo)
 *   partnerprx.<domínio> → /partner (portal do parceiro)
 * Os prefixos adminng./partnerng. são os domínios anteriores ao rebrand e
 * continuam aceitos enquanto o DNS é migrado.
 */
const SUBDOMAIN_ROUTES: ReadonlyArray<{ prefixes: readonly string[]; path: "/admin" | "/partner" }> = [
  { prefixes: ["adminprx.", "adminng."], path: "/admin" },
  { prefixes: ["partnerprx.", "partnerng."], path: "/partner" },
];

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

  if (match) {
    if (pathname === "/" || pathname === "") {
      url.pathname = match.path;
      return NextResponse.rewrite(url);
    }
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Domínio principal: o app é uma única rota; qualquer caminho digitado volta para "/".
  if (pathname !== "/" && pathname !== "") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
