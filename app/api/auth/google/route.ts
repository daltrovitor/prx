// Hello World
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { userStore, createSessionToken, AUTH_COOKIE_NAME, StoredUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS_ENABLED } from "@/lib/server-secrets";
import { errorMessage } from "@/lib/errors";
import type { SessionCookieOptions } from "@/lib/db-rows";
import { PENDING_GOOGLE_COOKIE, createPendingGoogleToken } from "@/lib/google-pending";

/**
 * Login Google simulado — SOMENTE para desenvolvimento local.
 *
 * Esta rota aceita o e-mail enviado no corpo sem nenhuma prova de identidade.
 * Em produção isso permitiria entrar na conta de qualquer pessoa, por isso ela
 * responde 404. O login Google real passa pelo Supabase OAuth (/auth/callback).
 */
// nosemgrep: prx-mutation-route-without-auth — entrada com Google (fluxo simulado só no desenvolvimento): cria a sessão
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
        // Check if user already exists in profiles and is complete
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        const isComplete = Boolean(existingProfile && existingProfile.cpf && existingProfile.phone);

        if (existingProfile && isComplete) {
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
            cpf: existingProfile.cpf,
            phone: existingProfile.phone,
            createdAt: existingProfile.created_at || new Date().toISOString(),
          };
        } else {
          // Usuário novo ou sem CPF/celular: não salva agora.
          // Emite token pendente e pede os dados no /cadastro/completar.
          const pendingToken = createPendingGoogleToken({
            authUserId: existingProfile?.id,
            email,
            fullName: name,
            avatarUrl,
          });

          const response = NextResponse.json({
            success: true,
            pendingRegistration: true,
            redirectTo: "/cadastro/completar",
            user: { email, name, avatarUrl },
          });

          response.cookies.set({
            name: PENDING_GOOGLE_COOKIE,
            value: pendingToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 15 * 60,
          });

          return response;
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
