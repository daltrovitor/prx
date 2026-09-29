// Hello World
import crypto from "crypto";
import { getSessionSecret } from "@/lib/server-secrets";
import { PartnerError } from "@/lib/partners/errors";
import { formatPhone, maskPhone } from "@/lib/notifications/format";
import { recordDelivery } from "@/lib/notifications/log";
import { sendWhatsAppCode } from "@/lib/notifications/whatsapp";
import type { DeliveryResult } from "@/lib/notifications/types";
import { getPhoneRepository } from "@/lib/phone/repository";
import {
  PHONE_CODE_MAX_ATTEMPTS,
  PHONE_CODE_MAX_PER_HOUR,
  PHONE_CODE_RESEND_MS,
  PHONE_CODE_TTL_MS,
  type PhoneCode,
  type PhoneVerificationState,
} from "@/lib/phone/types";

/*
 * Confirmação do celular pelo WhatsApp, com as proteções no servidor:
 *   - código de 6 dígitos de crypto.randomInt, guardado só como HMAC (ligado ao membro e ao número);
 *   - validade de 10 minutos, 5 tentativas por código e comparação em tempo constante;
 *   - 1 código por minuto e 5 por hora por membro (a rota ainda limita por IP);
 *   - um número confirmado pertence a uma única conta PRX.
 */

const repo = () => getPhoneRepository();

export function generatePhoneCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPhoneCode(userId: string, phone: string, code: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(`phone-code:v1:${userId}:${phone}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

const isOpen = (code: PhoneCode | null, now: Date): code is PhoneCode => Boolean(code && new Date(code.expiresAt).getTime() > now.getTime());

export async function phoneVerificationState(userId: string, now = new Date()): Promise<PhoneVerificationState> {
  const [verified, latest] = await Promise.all([repo().verifiedPhone(userId), repo().latestOpenCode(userId)]);
  const pending = isOpen(latest, now)
    ? {
        phone: maskPhone(latest.phone),
        expiresAt: latest.expiresAt,
        resendAvailableAt: new Date(new Date(latest.createdAt).getTime() + PHONE_CODE_RESEND_MS).toISOString(),
      }
    : null;
  return { phone: verified ? formatPhone(verified.phone) : null, verified: Boolean(verified), verifiedAt: verified?.verifiedAt ?? null, pending };
}

export interface RequestCodeResult {
  state: PhoneVerificationState;
  delivery: DeliveryResult["status"];
  /** Só no desenvolvimento sem WhatsApp configurado: o código aparece na tela. */
  devCode?: string;
}

export async function requestPhoneCode(userId: string, phone: string, now = new Date()): Promise<RequestCodeResult> {
  const current = await repo().verifiedPhone(userId);
  if (current?.phone === phone) throw new PartnerError("Este número já está confirmado na sua conta.", 409);
  const owner = await repo().phoneOwner(phone);
  if (owner && owner !== userId) throw new PartnerError("Este número já está confirmado em outra conta PRX.", 409);

  const latest = await repo().latestOpenCode(userId);
  if (latest) {
    const wait = new Date(latest.createdAt).getTime() + PHONE_CODE_RESEND_MS - now.getTime();
    if (wait > 0) throw new PartnerError(`Aguarde ${Math.ceil(wait / 1000)}s para pedir outro código.`, 429);
  }
  const sent = await repo().countCodesSince(userId, new Date(now.getTime() - 60 * 60_000).toISOString());
  if (sent >= PHONE_CODE_MAX_PER_HOUR) throw new PartnerError("Você pediu muitos códigos. Tente de novo em 1 hora.", 429);

  // Um código novo invalida o anterior.
  if (latest) await repo().consume(latest.id);

  const code = generatePhoneCode();
  const created = await repo().insertCode({
    userId,
    phone,
    codeHash: hashPhoneCode(userId, phone, code),
    expiresAt: new Date(now.getTime() + PHONE_CODE_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  });

  const delivery = await sendWhatsAppCode(phone, code);
  await recordDelivery({ userId, channel: "whatsapp", template: "phone_code", recipient: maskPhone(phone), result: delivery }).catch(() => undefined);

  if (delivery.status === "failed" || delivery.status === "skipped") {
    // Código que não chegou não vale nem segura o "aguarde 60s".
    await repo().consume(created.id);
    throw new PartnerError(
      delivery.status === "skipped" ? "A confirmação pelo WhatsApp ainda não está disponível. Tente mais tarde." : "Não conseguimos enviar o código pelo WhatsApp agora. Tente em instantes.",
      503,
    );
  }

  return {
    state: await phoneVerificationState(userId, now),
    delivery: delivery.status,
    ...(delivery.status === "simulated" ? { devCode: code } : {}),
  };
}

export async function confirmPhoneCode(userId: string, phone: string, code: string, now = new Date()): Promise<PhoneVerificationState> {
  const latest = await repo().latestOpenCode(userId);
  if (!latest || latest.phone !== phone) throw new PartnerError("Peça um código para este número primeiro.", 400);
  if (!isOpen(latest, now)) throw new PartnerError("O código expirou. Peça um novo.", 422);
  if (latest.attempts >= PHONE_CODE_MAX_ATTEMPTS) throw new PartnerError("Muitas tentativas. Peça um novo código.", 429);

  if (!sameHash(hashPhoneCode(userId, phone, code), latest.codeHash)) {
    const attempts = (await repo().addAttempt(latest)) ?? PHONE_CODE_MAX_ATTEMPTS;
    const left = PHONE_CODE_MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      await repo().consume(latest.id);
      throw new PartnerError("Código incorreto. Peça um novo código.", 429);
    }
    throw new PartnerError(`Código incorreto. ${left === 1 ? "Resta 1 tentativa." : `Restam ${left} tentativas.`}`, 422);
  }

  if (!(await repo().consume(latest.id))) throw new PartnerError("Este código já foi usado. Peça um novo.", 409);
  const owner = await repo().phoneOwner(phone);
  if (owner && owner !== userId) throw new PartnerError("Este número já está confirmado em outra conta PRX.", 409);

  await repo().setVerifiedPhone(userId, phone, now.toISOString());
  return phoneVerificationState(userId, now);
}
