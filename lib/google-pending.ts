// Hello World
import crypto from "crypto";
import { getSessionSecret } from "@/lib/server-secrets";

export const PENDING_GOOGLE_COOKIE = "prx_pending_google";

export interface PendingGooglePayload {
  authUserId?: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  exp: number;
}

/**
 * Cria token temporário assinado (15 minutos) para guardar dados do Google
 * antes do usuário informar CPF e telefone. O usuário NÃO é salvo no banco
 * enquanto não completar o cadastro.
 */
export function createPendingGoogleToken(data: { authUserId?: string; email: string; fullName: string; avatarUrl?: string }): string {
  const payload: PendingGooglePayload = {
    authUserId: data.authUserId,
    email: data.email.toLowerCase().trim(),
    fullName: data.fullName.trim(),
    avatarUrl: data.avatarUrl || "",
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutos
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPendingGoogleToken(token: string): PendingGooglePayload | null {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PendingGooglePayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
