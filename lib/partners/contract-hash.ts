// Hello World
import crypto from "crypto";
import { buildContract, contractPlainText, type ContractDocument } from "@/lib/partners/contract";
import type { CommercialSummary, PartnerSnapshot } from "@/lib/partners/types";

/** SHA-256 (hex) do texto canônico do contrato: identificador imutável da versão aceita. */
export function hashContract(doc: ContractDocument): string {
  return crypto.createHash("sha256").update(contractPlainText(doc), "utf8").digest("hex");
}

export function buildContractWithHash(
  partner: PartnerSnapshot,
  campaign: { id: string; version: number; summary: CommercialSummary }
): { document: ContractDocument; hash: string } {
  const document = buildContract(partner, campaign);
  return { document, hash: hashContract(document) };
}

/** Ex.: PRX-CERT-2026-7F3A-91C2. Aleatório, sem dado pessoal, fácil de ditar por telefone. */
export function newCertificateId(now = new Date()): string {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PRX-CERT-${now.getUTCFullYear()}-${hex.slice(0, 4)}-${hex.slice(4)}`;
}
