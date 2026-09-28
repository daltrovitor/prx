// Hello World
import { PRX_CATEGORIES } from "@/lib/pass-data";
import type { PartnerMatchMethod } from "@/lib/points/types";

/**
 * Identifica o parceiro recebedor de um Pix enviado pela conta PRX.
 * Módulo puro: recebe a lista de parceiros e o destino do Pix e devolve o
 * parceiro e o critério usado. Ordem de confiança:
 *   1. documento (chave CNPJ/CPF igual ao documento do parceiro)
 *   2. chave cadastrada (e-mail ou celular de contato do parceiro)
 *   3. nome do recebedor (nome fantasia ou razão social, sem acentos e sufixos)
 * Só parceiros ativos pontuam.
 */

export interface MatchablePartner {
  id: string;
  tradeName: string;
  legalName: string;
  /** CNPJ ou CPF, só dígitos. */
  document: string;
  categoryId: string;
  status: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  ownerEmail?: string | null;
}

export interface PixDestination {
  key: string;
  /** Nome do recebedor (Pix Copia e Cola / consulta DICT), quando conhecido. */
  recipientName?: string | null;
}

export interface PartnerMatch<P extends MatchablePartner = MatchablePartner> {
  partner: P;
  method: PartnerMatchMethod;
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/** Celular no formato nacional (DDD + número), sem +55. */
function phoneDigits(value: string | null | undefined): string {
  const d = digits(value);
  return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
}

const CORPORATE_SUFFIXES = /\b(ltda|me|mei|epp|eireli|s\/?a|sa|cia|comercio|servicos|de|da|do|dos|das|e)\b/g;

/** Nome comparável: sem acentos, minúsculo, sem pontuação nem sufixos societários. */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(CORPORATE_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(recipient: string, partner: MatchablePartner): boolean {
  const target = normalizeName(recipient);
  if (target.length < 3) return false;
  return [partner.tradeName, partner.legalName].some((candidate) => {
    const name = normalizeName(candidate);
    if (name.length < 3) return false;
    if (name === target) return true;
    // "Burger Lab" recebido como "BURGER LAB PINHEIROS": o nome do parceiro inteiro precisa aparecer.
    if (name.length >= 5 && ` ${target} `.includes(` ${name} `)) return true;
    // Recebedor abreviado ("BURGER LAB" para a razão social inteira): só com duas palavras ou mais.
    return target.length >= 8 && target.includes(" ") && ` ${name} `.includes(` ${target} `);
  });
}

export function matchPartner<P extends MatchablePartner>(destination: PixDestination, partners: ReadonlyArray<P>): PartnerMatch<P> | null {
  const active = partners.filter((p) => p.status === "ATIVO");
  const rawKey = destination.key.trim();
  const keyDigits = digits(rawKey);
  const isEmailKey = rawKey.includes("@");

  if (!isEmailKey && (keyDigits.length === 11 || keyDigits.length === 14)) {
    const byDocument = active.find((p) => digits(p.document) === keyDigits);
    if (byDocument) return { partner: byDocument, method: "document" };
  }

  if (isEmailKey) {
    const email = rawKey.toLowerCase();
    const byEmail = active.find((p) => [p.contactEmail, p.ownerEmail].some((e) => e && e.trim().toLowerCase() === email));
    if (byEmail) return { partner: byEmail, method: "pix_key" };
  } else if (keyDigits.length >= 10) {
    const phone = phoneDigits(rawKey);
    const byPhone = active.find((p) => phoneDigits(p.contactPhone).length >= 10 && phoneDigits(p.contactPhone) === phone);
    if (byPhone) return { partner: byPhone, method: "pix_key" };
  }

  if (destination.recipientName) {
    const byName = active.find((p) => nameMatches(destination.recipientName as string, p));
    if (byName) return { partner: byName, method: "name" };
  }

  return null;
}

/** Nicho do parceiro na régua de verticais PRX (BITE, STYLE, GEAR…). */
export function verticalOf(categoryId: string): { id: string; name: string; code: string } {
  const category = PRX_CATEGORIES.find((c) => c.id === categoryId && c.id !== "all");
  return category ? { id: category.id, name: category.name, code: category.verticalCode } : { id: "outros", name: "Outros", code: "OUTROS" };
}
