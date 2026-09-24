import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Sessão encerrada com sucesso." });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });
  response.cookies.set({
    name: "prx_remember",
    value: "",
    path: "/",
    expires: new Date(0),
  });

  try {
    const cookieStore = await cookies();
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith("sb-")) {
        response.cookies.set({
          name: c.name,
          value: "",
          path: "/",
          expires: new Date(0),
        });
      }
    }
  } catch {
    // Ignore
  }

  return response;
}
