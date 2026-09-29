// Hello World
import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSessionToken, AUTH_COOKIE_NAME, StoredUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/client";
import { asMemberRole, type SessionCookieOptions } from "@/lib/db-rows";
import { CONSENT_COOKIE, TERMS_VERSION, recordConsent } from "@/lib/legal";
import { sendWelcomeEmail } from "@/lib/notifications/welcome";
import { PENDING_GOOGLE_COOKIE, createPendingGoogleToken } from "@/lib/google-pending";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.URL || "https://ltiizrewiranhyrzbwds.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY || "",
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore in Server Component
              }
            },
          },
        }
      );

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data?.user) {
        const authUser = data.user;
        const email = (authUser.email || "").toLowerCase().trim();
        const fullName =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          email.split("@")[0] ||
          "Membro PRX";
        const avatarUrl =
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          "";

        let role = "user";
        let prxScore = 300;
        let prxLevel = 1;
        let walletBalance = 0;

        if (supabaseAdmin) {
          // Verifica se o perfil já existe e tem CPF e celular preenchidos
          const { data: existing } = await supabaseAdmin.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
          const isComplete = Boolean(existing && existing.cpf && existing.phone);

          if (!isComplete) {
            // Novo cadastro ou conta incompleta: NÃO salva perfil ainda.
            // O usuário só é salvo quando cadastra CPF e número de telefone.
            const pendingToken = createPendingGoogleToken({
              authUserId: authUser.id,
              email,
              fullName: String(fullName),
              avatarUrl,
            });

            const redirectResp = NextResponse.redirect(`${origin}/cadastro/completar`);
            redirectResp.cookies.set({
              name: PENDING_GOOGLE_COOKIE,
              value: pendingToken,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
              maxAge: 15 * 60,
            });

            try {
              const allCookies = cookieStore.getAll();
              for (const c of allCookies) {
                if (c.name.startsWith("sb-")) {
                  redirectResp.cookies.delete(c.name);
                  redirectResp.cookies.set({ name: c.name, value: "", path: "/", maxAge: 0, expires: new Date(0) });
                }
              }
            } catch {}

            return redirectResp;
          }

          // Perfil existente e completo: só atualiza e-mail e foto
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .update({
              email,
              ...(existing.avatar_url && !String(existing.avatar_url).includes("unsplash.com") ? {} : { avatar_url: avatarUrl }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", authUser.id)
            .select("*")
            .maybeSingle();

          if (profile) {
            role = profile.role || "user";
            prxScore = profile.nxt_score ?? 300;
            prxLevel = profile.nxt_level ?? 1;
            walletBalance = Number(profile.wallet_balance ?? 0);
          }

          if (cookieStore.get(CONSENT_COOKIE)?.value === TERMS_VERSION) await recordConsent(authUser.id);
        }

        const sessionUser: StoredUser = {
          id: authUser.id,
          email,
          fullName,
          passwordHash: "",
          salt: "",
          role: asMemberRole(role),
          prxScore,
          prxLevel,
          avatarUrl,
          walletBalance,
          emailConfirmed: true,
          createdAt: authUser.created_at || new Date().toISOString(),
        };

        const rememberPending = cookieStore.get("prx_remember_pending")?.value;
        const rememberMe = rememberPending !== "0";

        const tokenExpSeconds = rememberMe ? 365 * 24 * 60 * 60 : 24 * 60 * 60;
        const token = createSessionToken(sessionUser, tokenExpSeconds);

        const response = NextResponse.redirect(`${origin}/`);
        
        const cookieOptions: SessionCookieOptions = {
          name: AUTH_COOKIE_NAME,
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        };

        if (rememberMe) {
          cookieOptions.maxAge = 365 * 24 * 60 * 60;
        }

        response.cookies.set(cookieOptions);

        response.cookies.set({
          name: "prx_remember",
          value: rememberMe ? "1" : "0",
          path: "/",
          sameSite: "lax",
          maxAge: rememberMe ? 365 * 24 * 60 * 60 : undefined,
        });

        response.cookies.set({ name: CONSENT_COOKIE, value: "", path: "/", maxAge: 0, expires: new Date(0) });

        // Delete the temporary pending cookie
        response.cookies.set({
          name: "prx_remember_pending",
          value: "",
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });

        // Limpeza defensiva de cookies do Supabase (sb-*) para evitar HTTP ERROR 431
        // (Request Header Fields Too Large) decorrente de chunks acumulados no localhost
        try {
          const allCookies = cookieStore.getAll();
          for (const c of allCookies) {
            if (c.name.startsWith("sb-")) {
              response.cookies.delete(c.name);
              response.cookies.set({
                name: c.name,
                value: "",
                path: "/",
                maxAge: 0,
                expires: new Date(0),
              });
            }
          }
        } catch {
          // Ignore
        }

        return response;
      } else if (error) {
        console.error("Erro ao trocar código por sessão no Supabase:", error.message);
      }
    } catch (e) {
      console.error("Exceção no callback do Google OAuth:", e);
    }
  }

  // If there's an error or no code, clean sb- cookies and redirect cleanly to root /
  const fallbackResponse = NextResponse.redirect(`${origin}/`);
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (c.name.startsWith("sb-")) {
        fallbackResponse.cookies.delete(c.name);
        fallbackResponse.cookies.set({
          name: c.name,
          value: "",
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
      }
    }
  } catch {
    // Ignore
  }

  return fallbackResponse;
}
