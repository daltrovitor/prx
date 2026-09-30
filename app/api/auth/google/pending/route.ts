// Hello World
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PENDING_GOOGLE_COOKIE, pendingGoogleCookie, verifyPendingGoogleToken } from "@/lib/google-pending";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/auth/google/pending — cadastro Google aguardando CPF, celular e aceite (sem nada gravado ainda). */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_GOOGLE_COOKIE)?.value;
  const payload = token ? verifyPendingGoogleToken(token) : null;
  if (!payload) return NextResponse.json({ pending: false, user: null }, { headers: NO_STORE });
  return NextResponse.json({ pending: true, user: { email: payload.email, fullName: payload.fullName, avatarUrl: payload.avatarUrl } }, { headers: NO_STORE });
}

// nosemgrep: prx-mutation-route-without-auth — só apaga o cookie do próprio cadastro pendente
/** DELETE — "Cancelar": descarta o cadastro pendente (nada foi salvo). */
export async function DELETE() {
  const res = NextResponse.json({ success: true }, { headers: NO_STORE });
  res.cookies.set(pendingGoogleCookie(""));
  return res;
}
