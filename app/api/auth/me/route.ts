// Hello World
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    // Visitante sem sessão não é erro: 200 com user null evita ruído no console do navegador.
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const cookieStore = await cookies();
  const rememberMe = cookieStore.get("prx_remember")?.value !== "0";

  return NextResponse.json({
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
    rememberMe,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
