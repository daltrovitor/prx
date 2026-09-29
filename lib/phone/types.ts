// Hello World
import { z } from "zod";
import { onlyDigits } from "@/lib/family/types";
import { isBrMobile } from "@/lib/kyc/types";

/*
 * Confirmação do celular por código no WhatsApp: o membro informa o número,
 * recebe um código de 6 dígitos (válido por 10 minutos) e digita no app.
 */

export const PHONE_CODE_TTL_MS = 10 * 60_000;
export const PHONE_CODE_RESEND_MS = 60_000;
export const PHONE_CODE_MAX_ATTEMPTS = 5;
export const PHONE_CODE_MAX_PER_HOUR = 5;

/** Aceita (11) 98888-7777, 11988887777 ou +55 11 98888-7777. */
export const brPhoneSchema = z
  .string()
  .trim()
  .max(24, "Celular inválido.")
  .transform(onlyDigits)
  .transform((d) => (d.length === 13 && d.startsWith("55") ? d.slice(2) : d))
  .refine(isBrMobile, "Informe um celular válido com DDD.");

export const phoneCodeSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((d) => /^\d{6}$/.test(d), "Digite os 6 números do código.");

export const requestCodeSchema = z.object({ phone: brPhoneSchema });
export const confirmCodeSchema = z.object({ phone: brPhoneSchema, code: phoneCodeSchema });

export interface PhoneCode {
  id: string;
  userId: string;
  /** 11 dígitos (DDD + número). */
  phone: string;
  /** HMAC do código: o código em si nunca é gravado. */
  codeHash: string;
  attempts: number;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

/** O que a tela recebe. O número confirmado é do próprio membro, então vai completo. */
export interface PhoneVerificationState {
  phone: string | null;
  verified: boolean;
  verifiedAt: string | null;
  pending: { phone: string; expiresAt: string; resendAvailableAt: string } | null;
}
