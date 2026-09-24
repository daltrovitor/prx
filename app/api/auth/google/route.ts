import { NextRequest, NextResponse } from "next/server";
import { userStore, createSessionToken, AUTH_COOKIE_NAME, StoredUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS_ENABLED } from "@/lib/server-secrets";
import { errorMessage } from "@/lib/errors";
import type { SessionCookieOptions } from "@/lib/db-rows";

/**
 * Login Google simulado — SOMENTE para desenvolvimento local.
 *
 * Esta rota aceita o e-mail enviado no corpo sem nenhuma prova de identidade.
 * Em produção isso permitiria entrar na conta de qualquer pessoa, por isso ela
 * responde 404. O login Google real passa pelo Supabase OAuth (/auth/callback).
 */
export async function POST(req: NextRequest) {
  if (!DEMO_ACCOUNTS_ENABLED) {
    return NextResponse.json(
      { error: "Login com Google indisponível. Tente novamente em instantes." },
      { status: 404 }
    );
  }
  try {
    let body: { email?: string; name?: string; fullName?: string; avatarUrl?: string; rememberMe?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const email = (body.email || "usuario.google@gmail.com").toLowerCase().trim();
    const name = (body.name || body.fullName || "Usuário Google").trim();
    const avatarUrl = body.avatarUrl || "";

    let authenticatedUser: StoredUser | null = null;

    if (supabaseAdmin) {
      try {
        // Check if user already exists in profiles
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (existingProfile) {
          authenticatedUser = {
            id: existingProfile.id,
            email: existingProfile.email,
            fullName: existingProfile.full_name || name,
            passwordHash: "",
            salt: "",
            role: existingProfile.role || "user",
            prxScore: existingProfile.nxt_score ?? 300,
            prxLevel: existingProfile.nxt_level ?? 1,
            avatarUrl: existingProfile.avatar_url || avatarUrl,
            walletBalance: Number(existingProfile.wallet_balance ?? 0),
            emailConfirmed: true,
            createdAt: existingProfile.created_at || new Date().toISOString(),
          };
        } else {
          // Create in auth.users
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: "GoogleAuthToken_" + Math.random().toString(36).slice(2) + "!",
            email_confirm: true,
            user_metadata: {
              full_name: name,
              role: "user",
              avatar_url: avatarUrl,
              nxt_score: 300,
              nxt_level: 1,
              wallet_balance: 0,
            },
          });

          if (!authError && authData?.user) {
            const uid = authData.user.id;
            await supabaseAdmin.from("profiles").upsert(
              {
                id: uid,
                email,
                full_name: name,
                avatar_url: avatarUrl,
                role: "user",
                nxt_score: 300,
                nxt_level: 1,
                wallet_balance: 0.0,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

            authenticatedUser = {
              id: uid,
              email,
              fullName: name,
              passwordHash: "",
              salt: "",
              role: "user",
              prxScore: 300,
              prxLevel: 1,
              avatarUrl,
              walletBalance: 0,
              emailConfirmed: true,
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch (sbErr) {
        console.warn("Supabase Google auth fallback:", sbErr);
      }
    }

    const rememberMe = body.rememberMe !== false;

    if (!authenticatedUser) {
      const user = userStore.findOrCreateGoogleUser(email, name, avatarUrl);
      authenticatedUser = user;
    }

    const tokenExpSeconds = rememberMe ? 365 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = createSessionToken(authenticatedUser, tokenExpSeconds);

    const response = NextResponse.json({
      success: true,
      rememberMe,
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        name: authenticatedUser.fullName,
        role: authenticatedUser.role,
        prxScore: authenticatedUser.prxScore,
        prxLevel: authenticatedUser.prxLevel,
        walletBalance: authenticatedUser.walletBalance,
        avatarUrl: authenticatedUser.avatarUrl,
      },
    });

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

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err) || "Falha na autenticação com o Google." },
      { status: 500 }
    );
  }
}
