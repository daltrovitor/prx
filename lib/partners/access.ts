// Hello World
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { userStore } from "@/lib/auth";
import { isReservedAdminEmail } from "@/lib/admin-allowlist";
import { supabaseAdmin } from "@/lib/supabase/client";
import type { ProfileRow } from "@/lib/db-rows";
import { PartnerError } from "@/lib/partners/errors";

/**
 * Contas de acesso ao Portal do Parceiro. O papel "partner" só é gravado pelo
 * servidor (app_metadata + profiles.role), nunca pelo próprio usuário.
 */

export interface PartnerAccount {
  userId: string;
  email: string;
  /** Presente só quando a conta foi criada agora: exibida uma única vez ao admin. */
  temporaryPassword?: string;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 16 caracteres sem ambiguidade (sem 0/O, 1/l/I), com dígito garantido. */
export function generateTemporaryPassword(length = 16): string {
  const chars = Array.from({ length }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]);
  chars[crypto.randomInt(length)] = String(crypto.randomInt(2, 10));
  return chars.join("");
}

function assertEmailAllowed(email: string) {
  if (isReservedAdminEmail(email)) {
    throw new PartnerError("Este e-mail pertence a um administrador e não pode ser usado como acesso de parceiro.", 422);
  }
}

async function promoteInSupabase(userId: string) {
  if (!supabaseAdmin) return;
  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role: "partner" } });
  if (metaError) throw new PartnerError("Não foi possível conceder o acesso de parceiro.", 500);
  await supabaseAdmin.from("profiles").update({ role: "partner" }).eq("id", userId);
}

/** Vincula uma conta PRX existente, promovendo-a a parceiro. */
export async function linkExistingAccount(rawEmail: string): Promise<PartnerAccount> {
  const email = rawEmail.toLowerCase().trim();
  assertEmailAllowed(email);

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("profiles").select("id, email, role").eq("email", email).maybeSingle();
    if (error) throw new PartnerError("Não foi possível consultar a conta.", 500);
    const profile = data as Pick<ProfileRow, "id" | "email" | "role"> | null;
    if (!profile) throw new PartnerError("Nenhuma conta PRX com este e-mail. Use “Criar acesso”.", 404);
    if (profile.role === "admin") throw new PartnerError("Contas de administrador não podem virar acesso de parceiro.", 422);
    await promoteInSupabase(profile.id);
    return { userId: profile.id, email };
  }

  const user = userStore.findByEmail(email);
  if (!user) throw new PartnerError("Nenhuma conta PRX com este e-mail. Use “Criar acesso”.", 404);
  if (user.role === "admin") throw new PartnerError("Contas de administrador não podem virar acesso de parceiro.", 422);
  userStore.updateRole(email, "partner");
  return { userId: user.id, email };
}

/** Cria o login do parceiro com senha temporária. */
export async function createPartnerAccount(rawEmail: string, fullName: string): Promise<PartnerAccount> {
  const email = rawEmail.toLowerCase().trim();
  assertEmailAllowed(email);
  const temporaryPassword = generateTemporaryPassword();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { role: "partner" },
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      const exists = /already|registered|exists/i.test(error?.message || "");
      throw new PartnerError(exists ? "Já existe uma conta com este e-mail. Use “Vincular conta existente”." : "Não foi possível criar o acesso.", exists ? 409 : 500);
    }
    // O trigger handle_new_user cria o perfil como "user"; o papel confiável vem daqui.
    await supabaseAdmin.from("profiles").upsert({ id: data.user.id, email, full_name: fullName, role: "partner" }, { onConflict: "id" });
    return { userId: data.user.id, email, temporaryPassword };
  }

  if (userStore.findByEmail(email)) throw new PartnerError("Já existe uma conta com este e-mail. Use “Vincular conta existente”.", 409);
  const user = userStore.createUser(email, fullName, temporaryPassword);
  userStore.updateRole(email, "partner");
  return { userId: user.id, email, temporaryPassword };
}

/** Rebaixa a conta para membro quando o vínculo com o parceiro é removido. */
export async function revokePartnerAccess(userId: string, email: string | null): Promise<void> {
  if (supabaseAdmin && /^[0-9a-f-]{36}$/i.test(userId)) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { role: "user" } });
    await supabaseAdmin.from("profiles").update({ role: "user" }).eq("id", userId);
  }
  if (email) userStore.updateRole(email, "user");
}

/**
 * Confirma a senha da conta no ato do aceite (assinatura com reautenticação).
 * Mesma origem de verdade do login do portal: Supabase Auth ou contas de demo.
 */
export async function verifyAccountPassword(rawEmail: string, password: string): Promise<boolean> {
  const email = rawEmail.toLowerCase().trim();
  if (!password) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.ANON_KEY || "";
  if (url && anonKey.startsWith("eyJ")) {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      await client.auth.signOut().catch(() => undefined);
      return true;
    }
  }

  const demo = userStore.findByEmail(email);
  if (!demo?.salt) return false;
  const computed = Buffer.from(userStore.hashPassword(password, demo.salt), "hex");
  const stored = Buffer.from(demo.passwordHash, "hex");
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
}
