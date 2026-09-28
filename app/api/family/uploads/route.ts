// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { signedUpload, storeMemoryDocument } from "@/lib/family/documents";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/family/types";
import { body, familyErrorResponse, requireUser } from "@/lib/family/http";

const signSchema = z.object({ kind: z.enum(DOCUMENT_KINDS), contentType: z.string().max(100), size: z.number().int().positive() });

/**
 * Envio de documento (RG, CPF, CNH, certidões) para a pasta privada do próprio
 * usuário. Com Supabase: devolve URL assinada e o navegador envia direto ao
 * Storage. Sem Supabase (desenvolvimento): multipart guardado em memória.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rate = checkRateLimit(`family_upload_${user.id}`, 20, 60);
    if (!rate.allowed) throw new PartnerError(`Muitos envios. Tente em ${rate.resetInSeconds}s.`, 429);

    if ((req.headers.get("content-type") || "").includes("application/json")) {
      const parsed = signSchema.safeParse(await body(req));
      if (!parsed.success) throw new PartnerError("Dados do arquivo inválidos.", 400);
      const result = await signedUpload(user.id, parsed.data.kind, parsed.data.contentType, parsed.data.size);
      return NextResponse.json({ success: true, ...result });
    }

    if (supabaseAdmin) throw new PartnerError("Envie os dados do arquivo para receber a URL de envio.", 400);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const kind = String(form?.get("kind") || "");
    if (!(file instanceof File)) throw new PartnerError("Nenhum arquivo enviado.", 400);
    if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) throw new PartnerError("Tipo de documento inválido.", 400);
    const path = storeMemoryDocument(user.id, kind as DocumentKind, file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true, mode: "direct", path });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao enviar o documento.");
  }
}
