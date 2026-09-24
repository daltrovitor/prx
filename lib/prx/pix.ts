// Hello World

/**
 * BR Code Pix (padrão EMV® QRCPS-MPM do Banco Central).
 * Gera o "Pix Copia e Cola" estático e faz a leitura dos campos principais de
 * um código colado ou escaneado.
 */

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres fora do conjunto aceito pelo BR Code. */
function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

export interface PixChargeInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}

export function buildPixPayload({ key, merchantName, merchantCity, amount, txid = "***", description }: PixChargeInput): string {
  const accountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", key) + (description ? tlv("02", description.slice(0, 50)) : "");
  const parts = [
    tlv("00", "01"),
    tlv("26", accountInfo),
    tlv("52", "0000"),
    tlv("53", "986"),
    amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "",
    tlv("58", "BR"),
    tlv("59", sanitize(merchantName, 25) || "PRX"),
    tlv("60", sanitize(merchantCity, 15) || "SAO PAULO"),
    tlv("62", tlv("05", sanitize(txid, 25) || "***")),
  ].join("");
  const withCrcHeader = `${parts}6304`;
  return withCrcHeader + crc16(withCrcHeader);
}

export interface ParsedPix {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  valid: boolean;
}

function readTlv(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    if (!Number.isFinite(length)) break;
    fields.set(id, payload.slice(i + 4, i + 4 + length));
    i += 4 + length;
  }
  return fields;
}

/** Lê um Pix Copia e Cola. Retorna null quando o texto não é um BR Code. */
export function parsePixPayload(raw: string): ParsedPix | null {
  const payload = raw.trim();
  if (!payload.startsWith("000201")) return null;
  const fields = readTlv(payload);
  const account = readTlv(fields.get("26") ?? "");
  if (account.get("00")?.toLowerCase() !== "br.gov.bcb.pix") return null;
  const crcIndex = payload.lastIndexOf("6304");
  const valid = crcIndex > 0 && crc16(payload.slice(0, crcIndex + 4)) === payload.slice(crcIndex + 4, crcIndex + 8).toUpperCase();
  const amountText = fields.get("54");
  return {
    key: account.get("01") ?? "",
    merchantName: fields.get("59") ?? "",
    merchantCity: fields.get("60") ?? "",
    amount: amountText ? Number(amountText) : undefined,
    valid,
  };
}

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

/** Identifica o tipo de chave digitada para validação e máscara. */
export function detectPixKeyType(value: string): PixKeyType | null {
  const v = value.trim();
  const digits = v.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "random";
  if (/^\+?\d[\d\s()-]{9,}$/.test(v) && (digits.length === 13 || (digits.length === 11 && v.startsWith("+")))) return "phone";
  if (digits.length === 11 && !/[a-z]/i.test(v)) return isValidCpf(digits) ? "cpf" : "phone";
  if (digits.length === 14 && !/[a-z]/i.test(v)) return "cnpj";
  return null;
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export const PIX_KEY_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave aleatória",
};
