// Hello World
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { requireAdmin } from "@/lib/partners/http";
import { PartnerError } from "@/lib/partners/errors";

/** Pasta do bucket para o tipo pedido; só estas três existem (o tipo vira caminho, então nada livre). */
function uploadFolder(value: FormDataEntryValue | null): "benefits" | "logos" | "banners" | null {
  switch (String(value || "benefit")) {
    case "benefit":
      return "benefits";
    case "logo":
      return "logos";
    case "banner":
      return "banners";
    default:
      return null;
  }
}
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

/** Extensão sempre derivada do tipo do arquivo (constante do código), nunca do nome enviado. */
function extensionFor(mime: string): "jpg" | "png" | "webp" | "gif" | "svg" | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = uploadFolder(formData.get("type"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    // Path traversal: o tipo vira nome de pasta, então só valores conhecidos.
    if (!folder) {
      return NextResponse.json({ error: "Tipo de imagem inválido." }, { status: 400 });
    }

    const allowedMimeTypes = ALLOWED_MIME_TYPES;
    const fileExt = extensionFor(file.type);
    if (!fileExt) {
      return NextResponse.json(
        { error: "Formato de arquivo inválido. Envie JPG, PNG, WEBP, GIF ou SVG." },
        { status: 400 }
      );
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O tamanho máximo permitido é 10MB." },
        { status: 400 }
      );
    }

    const filePath = `${folder}/${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload to Supabase Storage Bucket 'benefits'
    if (supabaseAdmin) {
      // Ensure bucket exists
      try {
        await supabaseAdmin.storage.createBucket("benefits", {
          public: true,
          fileSizeLimit: 10485760,
          allowedMimeTypes,
        });
      } catch {
        // Bucket may already exist
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from("benefits")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase storage upload error:", uploadError.message);
        return NextResponse.json(
          { error: `Erro no upload Supabase Storage: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("benefits")
        .getPublicUrl(filePath);

      return NextResponse.json({
        success: true,
        url: publicUrlData.publicUrl,
        path: filePath,
        fileName: file.name,
      });
    }

    // 2. Fallback: Data URL if no Supabase credentials
    const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;
    return NextResponse.json({
      success: true,
      url: base64Data,
      fileName: file.name,
    });
  } catch (error) {
    if (error instanceof PartnerError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: errorMessage(error) || "Erro inesperado ao fazer upload." },
      { status: 500 }
    );
  }
}
