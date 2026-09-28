// Hello World
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError } from "@/lib/partners/errors";
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, type DocumentKind, type DocumentRef } from "@/lib/family/types";

/**
 * Documentos de família (RG, CPF, CNH, certidões). Dados pessoais sensíveis
 * (LGPD): bucket privado, pasta por usuário, envio direto do navegador por URL
 * assinada e leitura só pelo admin, com link que expira em 1 minuto.
 */
export const FAMILY_BUCKET = "family-docs";

const EXT: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function validateDocument(contentType: string, size: number): string {
  const ext = EXT[contentType as keyof typeof EXT];
  if (!ext) throw new PartnerError("Envie foto (JPG, PNG, WEBP ou HEIC) ou PDF.", 422);
  if (!(size > 0)) throw new PartnerError("Arquivo vazio.", 422);
  if (size > DOCUMENT_MAX_BYTES) throw new PartnerError("Arquivo acima de 10 MB.", 422);
  return ext;
}

/** Só aceita documentos da própria pasta: ninguém anexa o arquivo de outra pessoa. */
export function ownsDocument(userId: string, ref: Pick<DocumentRef, "path">): boolean {
  return ref.path.startsWith(`${userId}/`) && !ref.path.includes("..");
}

export function documentPath(userId: string, kind: DocumentKind, ext: string): string {
  return `${userId}/${kind}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
}

export async function signedUpload(userId: string, kind: DocumentKind, contentType: string, size: number): Promise<{ mode: "signed"; signedUrl: string; path: string } | { mode: "direct" }> {
  const ext = validateDocument(contentType, size);
  if (!supabaseAdmin) return { mode: "direct" };
  await supabaseAdmin.storage
    .createBucket(FAMILY_BUCKET, { public: false, fileSizeLimit: DOCUMENT_MAX_BYTES, allowedMimeTypes: [...DOCUMENT_TYPES] })
    .catch(() => undefined);
  const path = documentPath(userId, kind, ext);
  const { data, error } = await supabaseAdmin.storage.from(FAMILY_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new PartnerError(`Envio de documentos indisponível: ${error?.message ?? "sem URL"}. Confira o bucket "${FAMILY_BUCKET}" no Supabase.`, 503);
  return { mode: "signed", signedUrl: data.signedUrl, path };
}

/* Desenvolvimento sem Supabase: arquivos em memória (somem ao reiniciar o servidor). */
const globalState = globalThis as unknown as { __prxFamilyDocs?: Map<string, { type: string; data: Buffer }> };
const memory = () => (globalState.__prxFamilyDocs ??= new Map());

export function storeMemoryDocument(userId: string, kind: DocumentKind, type: string, data: Buffer): string {
  const ext = validateDocument(type, data.byteLength);
  const path = documentPath(userId, kind, ext);
  memory().set(path, { type, data });
  return path;
}

export function readMemoryDocument(path: string): { type: string; data: Buffer } | null {
  return memory().get(path) ?? null;
}

/** Link temporário (60 s) para o admin conferir um documento. */
export async function documentViewUrl(path: string): Promise<string | null> {
  if (!supabaseAdmin) return memory().has(path) ? `/api/admin/family/documents?path=${encodeURIComponent(path)}&raw=1` : null;
  const { data, error } = await supabaseAdmin.storage.from(FAMILY_BUCKET).createSignedUrl(path, 60);
  return error || !data ? null : data.signedUrl;
}
