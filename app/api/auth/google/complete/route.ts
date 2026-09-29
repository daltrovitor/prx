// Hello World
import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { checkRateLimit, sanitizeInput } from "@/lib/security";
import { CONSENT_REQUIRED_MESSAGE, TERMS_VERSION, recordConsent } from "@/lib/legal";
import { attachSession, publicUser } from "@/lib/accounts";
import { PartnerError } from "@/lib/partners/errors";
import { clientIp } from "@/lib/partners/http";
import { sendWelcomeEmail } from "@/lib/notifications/welcome";
import { cpfSchema, onlyDigits } from "@/lib/family/types";
import { PENDING_GOOGLE_COOKIE, verifyPendingGoogleToken } from "@/lib/google-pending";
import { supabaseAdmin } from "@/lib/supabase/client";
import { userStore, type StoredUser } from "@/lib/auth";

const phoneSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((d) => d.length === 10 || d.length === 11, "Informe o celular com DDD.");

const CompleteGoogleSchema = z.object({
  token: z.string().optional(),
  cpf: cpfSchema,
  phone: phoneSchema,
  termsAccepted: z.literal(true, { error: CONSENT_REQUIRED_MESSAGE }),
});

// nosemgrep: prx-mutation-route-without-auth — conclusão do cadastro Google: salva o usuário somente com CPF e telefone válidos
export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`google_complete_${clientIp(req) ?? "anon"}`, 8, 60);
    if (!rate.allowed) {
      return NextResponse.json({ error: `Muitas tentativas. Tente em ${rate.resetInSeconds}s.` }, { status: 429 });
    }

    const cookieStore = await cookies();
    const body = await req.json().catch(() => ({}));
    const parsed = CompleteGoogleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    const { cpf, phone } = parsed.data;
    const token = parsed.data.token || cookieStore.get(PENDING_GOOGLE_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Sessão expirada. Inicie o acesso com o Google novamente." }, { status: 400 });
    }

    const pending = verifyPendingGoogleToken(token);
    if (!pending) {
      return NextResponse.json({ error: "Sessão de cadastro com o Google inválida ou expirada." }, { status: 400 });
    }

    const email = pending.email.toLowerCase().trim();
    const fullName = sanitizeInput(pending.fullName.trim() || email.split("@")[0] || "Membro PRX");
    const avatarUrl = pending.avatarUrl || "";

    let finalUser: StoredUser | null = null;

    if (supabaseAdmin) {
      // 1. Verifica duplicidade do CPF
      const { data: existingCpf } = await supabaseAdmin.from("profiles").select("id").eq("cpf", cpf).maybeSingle();
      if (existingCpf && existingCpf.id !== pending.authUserId) {
        return NextResponse.json({ error: "Este CPF já está cadastrado no PRX. Entre na sua conta existente." }, { status: 409 });
      }

      // 2. Localiza ou cria no auth.users
      let authUserId = pending.authUserId;
      if (!authUserId) {
        // Tenta achar por email
        const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
        if (existingProfile) {
          authUserId = existingProfile.id;
        } else {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: `G_${crypto.randomBytes(32).toString("base64url")}!`,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: "user", avatar_url: avatarUrl, nxt_score: 300, nxt_level: 1, wallet_balance: 0 },
          });
          if (authError || !authData?.user) {
            throw new PartnerError("Falha ao registrar conta com o Google.", 500);
          }
          authUserId = authData.user.id;
        }
      }

      if (!authUserId) {
        throw new PartnerError("Identificador de usuário não encontrado.", 400);
      }
      const validUserId = authUserId;

      // 3. Salva no profiles (só aqui o usuário é persistido com CPF e telefone)
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: validUserId,
            email,
            full_name: fullName,
            avatar_url: avatarUrl,
            cpf,
            phone,
            role: "user",
            nxt_score: 300,
            nxt_level: 1,
            wallet_balance: 0.0,
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select("*")
        .maybeSingle();

      if (profileError || !profile) {
        throw new PartnerError("Erro ao salvar perfil com CPF e telefone.", 500);
      }

      await recordConsent(validUserId);
      after(() => sendWelcomeEmail({ id: validUserId, email, fullName }));

      finalUser = {
        id: validUserId,
        email,
        fullName,
        passwordHash: "",
        salt: "",
        role: "user",
        prxScore: profile.nxt_score ?? 300,
        prxLevel: profile.nxt_level ?? 1,
        avatarUrl,
        walletBalance: Number(profile.wallet_balance ?? 0),
        emailConfirmed: true,
        cpf,
        phone,
        createdAt: profile.created_at || new Date().toISOString(),
      };
    } else {
      // Modo local dev
      finalUser = userStore.findOrCreateGoogleUser(email, fullName, avatarUrl, cpf, phone);
    }

    if (!finalUser) {
      throw new PartnerError("Erro ao finalizar a conta.", 500);
    }

    const response = NextResponse.json({
      success: true,
      message: "Cadastro concluído. Bem-vindo ao PRX!",
      user: publicUser(finalUser),
    });

    // Limpa o cookie temporário
    response.cookies.set({
      name: PENDING_GOOGLE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return attachSession(response, finalUser);
  } catch (err) {
    if (err instanceof PartnerError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.warn("[google/complete] erro:", err);
    return NextResponse.json({ error: "Erro ao concluir cadastro com o Google." }, { status: 400 });
  }
}
