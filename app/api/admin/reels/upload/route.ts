// Hello World
import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, requireAdmin } from "@/lib/partners/http";
import { storeMemoryMedia } from "@/lib/reels/repository";

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
/** Limite padrão de arquivo do Supabase Storage no plano gratuito. */
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const BUCKET = "reels";

type Kind = "video" | "poster";

function validate(kind: Kind, contentType: string, size: number): string {
  const ext = (kind === "video" ? VIDEO_TYPES : IMAGE_TYPES)[contentType];
  if (!ext) throw new PartnerError(kind === "video" ? "Envie o vídeo em MP4, WEBM ou MOV." : "Envie a capa em JPG, PNG ou WEBP.", 422);
  if (!(size > 0)) throw new PartnerError("Arquivo vazio.", 422);
  if (size > (kind === "video" ? MAX_VIDEO : MAX_IMAGE)) throw new PartnerError(kind === "video" ? "Vídeo acima de 50 MB." : "Capa acima de 8 MB.", 422);
  return ext;
}

const signSchema = z.object({
  kind: z.enum(["video", "poster"]),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/**
 * POST /api/admin/reels/upload — envio do vídeo vertical (até 50 MB) ou da capa.
 *
 * Com Supabase: o corpo é JSON ({ kind, contentType, size }) e a resposta traz
 * uma URL assinada de envio. O navegador manda o arquivo direto para o
 * Storage, sem passar pela função da hospedagem (a Vercel limita o corpo das
 * requisições a ~4,5 MB, o que travava vídeos reais).
 * Sem Supabase (desenvolvimento): multipart com o arquivo, guardado em memória.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const isJson = (req.headers.get("content-type") || "").includes("application/json");

    if (isJson) {
      const parsed = signSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) throw new PartnerError("Dados do arquivo inválidos.", 400);
      const { kind, contentType, size } = parsed.data;
      const ext = validate(kind, contentType, size);
      if (!supabaseAdmin) return NextResponse.json({ success: true, mode: "direct" });

      await supabaseAdmin.storage
        .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_VIDEO, allowedMimeTypes: [...Object.keys(VIDEO_TYPES), ...Object.keys(IMAGE_TYPES)] })
        .catch(() => undefined);
      const path = `${kind}s/${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new PartnerError(`Storage indisponível: ${error?.message ?? "sem URL de envio"}. Confira o bucket "${BUCKET}" no Supabase.`, 503);
      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ success: true, mode: "signed", signedUrl: data.signedUrl, publicUrl: pub.publicUrl });
    }

    // Desenvolvimento sem Supabase: arquivo no corpo, guardado em memória.
    if (supabaseAdmin) throw new PartnerError("Envie os dados do arquivo para receber a URL de envio.", 400);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new PartnerError("Nenhum arquivo enviado.", 400);
    const kind: Kind = form?.get("kind") === "poster" ? "poster" : "video";
    validate(kind, file.type, file.size);
    const id = storeMemoryMedia(file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ success: true, mode: "direct", url: `/api/reels/media/${id}` });
  } catch (error) {
    return errorResponse(error, "Erro ao enviar o arquivo.");
  }
}
