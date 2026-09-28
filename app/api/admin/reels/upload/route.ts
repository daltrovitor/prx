// Hello World
import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, requireAdmin } from "@/lib/partners/http";
import { storeMemoryMedia } from "@/lib/reels/repository";

const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_VIDEO = 60 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const BUCKET = "reels";

/**
 * POST /api/admin/reels/upload — vídeo vertical (mp4, webm, mov até 60 MB) ou
 * capa (jpg, png, webp até 8 MB). Vai para o bucket público "reels" do
 * Supabase Storage; sem Supabase, fica em memória (desenvolvimento).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new PartnerError("Nenhum arquivo enviado.", 400);
    const kind = form?.get("kind") === "poster" ? "poster" : "video";
    const types = kind === "video" ? VIDEO_TYPES : IMAGE_TYPES;
    const ext = types[file.type];
    if (!ext) throw new PartnerError(kind === "video" ? "Envie o vídeo em MP4, WEBM ou MOV." : "Envie a capa em JPG, PNG ou WEBP.", 422);
    if (file.size > (kind === "video" ? MAX_VIDEO : MAX_IMAGE)) throw new PartnerError(kind === "video" ? "Vídeo acima de 60 MB." : "Capa acima de 8 MB.", 422);

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!supabaseAdmin) {
      const id = storeMemoryMedia(file.type, buffer);
      return NextResponse.json({ success: true, url: `/api/reels/media/${id}` });
    }

    await supabaseAdmin.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_VIDEO, allowedMimeTypes: [...Object.keys(VIDEO_TYPES), ...Object.keys(IMAGE_TYPES)] })
      .catch(() => undefined);
    const path = `${kind}s/${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false });
    if (error) throw new PartnerError(`Falha no envio para o Storage: ${error.message}`, 500);
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl });
  } catch (error) {
    return errorResponse(error, "Erro ao enviar o arquivo.");
  }
}
