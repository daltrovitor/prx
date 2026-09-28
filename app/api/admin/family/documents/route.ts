// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/partners/http";
import { PartnerError } from "@/lib/partners/errors";
import { documentViewUrl, readMemoryDocument } from "@/lib/family/documents";
import { documentIsAttached } from "@/lib/family/service";
import { kycDocumentIsAttached } from "@/lib/kyc/service";
import { familyErrorResponse } from "@/lib/family/http";

/**
 * Só devolve caminhos anexados a um pedido (Conta Pai, emancipação ou abertura
 * do PRX BANK). Nada de "..", caminho absoluto ou arquivo solto do bucket.
 */
async function requireAttachedDocument(raw: string | null): Promise<string> {
  const path = raw ?? "";
  const shapeOk = path.length > 0 && path.length <= 300 && !path.includes("..") && !path.startsWith("/") && /^[\w-]+\/[\w.-]+$/.test(path);
  if (!shapeOk || !((await documentIsAttached(path)) || (await kycDocumentIsAttached(path)))) throw new PartnerError("Documento não encontrado.", 404);
  return path;
}

/**
 * Abre um documento anexado a um pedido (só admin). Redireciona para um link
 * assinado de 60 segundos; nada fica público nem em cache.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const path = await requireAttachedDocument(req.nextUrl.searchParams.get("path"));
    if (req.nextUrl.searchParams.get("raw") === "1") {
      const doc = readMemoryDocument(path);
      if (!doc) throw new PartnerError("Documento não encontrado.", 404);
      return new NextResponse(new Uint8Array(doc.data), {
        headers: { "Content-Type": doc.type, "Cache-Control": "private, no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
      });
    }
    const url = await documentViewUrl(path);
    if (!url) throw new PartnerError("Documento não encontrado.", 404);
    return NextResponse.redirect(new URL(url, req.nextUrl.origin), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao abrir o documento.");
  }
}
