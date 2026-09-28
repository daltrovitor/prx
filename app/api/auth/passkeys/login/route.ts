// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { AUTH_COOKIE_NAME, createSessionToken, loadSessionUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { PASSKEY_CHALLENGE_COOKIE, PasskeyError, authenticationOptions, challengeCookie, verifyAuthentication } from "@/lib/passkeys/service";

const REMEMBER_SECONDS = 365 * 24 * 60 * 60;
const optionsSchema = z.object({ userId: z.string().trim().min(1).max(200) });

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "127.0.0.1").split(",")[0].trim();
}

/**
 * Entrada com biometria na tela "Lembrar de mim". GET ?userId= gera o desafio
 * para as credenciais daquela conta; POST confere a assinatura do aparelho e
 * abre a sessão, como o login com senha.
 */
export async function GET(req: NextRequest) {
  const rate = checkRateLimit(`passkey_options_${clientIp(req)}`, 20, 60);
  if (!rate.allowed) return NextResponse.json({ error: `Muitas tentativas. Tente em ${rate.resetInSeconds}s.` }, { status: 429 });
  const parsed = optionsSchema.safeParse({ userId: req.nextUrl.searchParams.get("userId") });
  if (!parsed.success) return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  try {
    const { options, sealed } = await authenticationOptions(req, parsed.data.userId);
    const res = NextResponse.json({ options });
    res.cookies.set(challengeCookie(sealed));
    return res;
  } catch (err) {
    if (err instanceof PasskeyError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Não foi possível iniciar a biometria." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`passkey_login_${clientIp(req)}`, 10, 60);
  if (!rate.allowed) return NextResponse.json({ error: `Muitas tentativas. Bloqueio de segurança temporário. Tente em ${rate.resetInSeconds}s.` }, { status: 429 });
  try {
    const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
    if (!body?.response?.id) return NextResponse.json({ error: "Resposta da biometria ausente." }, { status: 400 });
    const userId = await verifyAuthentication(req, req.cookies.get(PASSKEY_CHALLENGE_COOKIE)?.value, body.response);
    const user = await loadSessionUser(userId);
    if (!user) throw new PasskeyError("Conta não encontrada.", 404);

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role,
        prxScore: user.prxScore,
        prxLevel: user.prxLevel,
        walletBalance: user.walletBalance,
        avatarUrl: user.avatarUrl,
      },
    });
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: createSessionToken(user, REMEMBER_SECONDS),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: REMEMBER_SECONDS,
    });
    res.cookies.set({ name: "prx_remember", value: "1", path: "/", sameSite: "lax", maxAge: REMEMBER_SECONDS });
    res.cookies.set(challengeCookie(""));
    return res;
  } catch (err) {
    const status = err instanceof PasskeyError ? err.status : 500;
    const message = err instanceof PasskeyError ? err.message : "Não foi possível entrar com a biometria.";
    const res = NextResponse.json({ error: message }, { status });
    res.cookies.set(challengeCookie(""));
    return res;
  }
}
