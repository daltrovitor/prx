import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return { authorized: false, status: 401, error: "Não autenticado." };
  }

  const { valid, payload } = verifySessionToken(token);
  if (!valid || !payload) {
    return { authorized: false, status: 401, error: "Sessão inválida ou expirada." };
  }

  if (payload.role !== "admin") {
    return {
      authorized: false,
      status: 403,
      error: "Acesso Negado. Requer privilégios de administrador.",
    };
  }

  return { authorized: true, adminUser: payload };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "benefit";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // Validate mime type
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];
    if (!allowedMimeTypes.includes(file.type)) {
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

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${type}s/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

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

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("benefits")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase storage upload error:", uploadError);
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
    return NextResponse.json(
      { error: errorMessage(error) || "Erro inesperado ao fazer upload." },
      { status: 500 }
    );
  }
}
