// Hello World
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PENDING_GOOGLE_COOKIE, verifyPendingGoogleToken } from "@/lib/google-pending";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_GOOGLE_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ pending: false, user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const payload = verifyPendingGoogleToken(token);
  if (!payload) {
    return NextResponse.json({ pending: false, user: null }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    pending: true,
    user: {
      email: payload.email,
      fullName: payload.fullName,
      avatarUrl: payload.avatarUrl,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
