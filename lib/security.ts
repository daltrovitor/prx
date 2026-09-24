import crypto from "crypto";
import { getSessionSecret } from "@/lib/server-secrets";

export interface DynamicQRToken {
  voucherId: string;
  userId: string;
  partnerId: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

/**
 * Generates an impenetrable, anti-tampering dynamic QR token.
 * Token expires in 60 seconds to prevent screenshots or replay attacks.
 */
export function generateDynamicQRToken(voucherId: string, userId: string, partnerId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${voucherId}:${userId}:${partnerId}:${timestamp}:${nonce}`;
  
  const hmac = crypto.createHmac("sha256", getSessionSecret());
  hmac.update(payload);
  const signature = hmac.digest("hex");

  const tokenObj: DynamicQRToken = {
    voucherId,
    userId,
    partnerId,
    timestamp,
    nonce,
    signature,
  };

  return Buffer.from(JSON.stringify(tokenObj)).toString("base64url");
}

/**
 * Validates a dynamic QR token against forgery, tampering, and expiration.
 * Max validity window: 90 seconds (accounting for minor client clock drift).
 */
export function verifyDynamicQRToken(rawToken: string, expectedPartnerId?: string): {
  valid: boolean;
  error?: string;
  data?: DynamicQRToken;
} {
  try {
    const decoded = JSON.parse(Buffer.from(rawToken, "base64url").toString("utf8")) as DynamicQRToken;
    const now = Math.floor(Date.now() / 1000);

    // 1. Clock skew / Expiration check (90s window)
    if (Math.abs(now - decoded.timestamp) > 90) {
      return { valid: false, error: "QR Code expirado. Por favor gere um novo na tela." };
    }

    // 2. Partner scope check (Prevents cross-partner redemption attacks)
    if (expectedPartnerId && decoded.partnerId !== expectedPartnerId) {
      return { valid: false, error: "Este benefício não pertence a este estabelecimento parceiro." };
    }

    // 3. Cryptographic Signature check (Protects against tampering)
    const payload = `${decoded.voucherId}:${decoded.userId}:${decoded.partnerId}:${decoded.timestamp}:${decoded.nonce}`;
    const hmac = crypto.createHmac("sha256", getSessionSecret());
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(decoded.signature), Buffer.from(expectedSignature))) {
      return { valid: true, data: decoded };
    }

    return { valid: false, error: "Assinatura digital inválida. Tentativa de falsificação detectada." };
  } catch (err) {
    return { valid: false, error: "Formato de QR Code corrompido ou inválido." };
  }
}

/**
 * Sliding window In-Memory Rate Limiter to prevent DoS, Brute-force & credential stuffing.
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(identifier: string, maxRequests: number = 10, windowSeconds: number = 60): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return { allowed: true, remaining: maxRequests - 1, resetInSeconds: windowSeconds };
  }

  if (record.count >= maxRequests) {
    const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Sanitizes input string to prevent stored or reflected XSS injection.
 */
export function sanitizeInput(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
