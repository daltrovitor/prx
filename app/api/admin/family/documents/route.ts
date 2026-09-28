// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/partners/http";
import { PartnerError } from "@/lib/partners/errors";
import { documentViewUrl, readMemoryDocument } from "@/lib/family/documents";
import { documentIsAttached } from "@/lib/family/service";
import { familyErrorResponse } from "@/lib/family/http";

/**
 * Abre um documento anexado a um pedido (só admin). Redireciona para um link
 * assinado de 60 segundos; nada fica público nem em cache.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const path = req.nextUrl.searchParams.get("path") || "";
    if (!path || path.includes("..") || !(await documentIsAttached(path))) throw new PartnerError("Documento não encontrado.", 404);
    if (req.nextUrl.searchParams.get("raw") === "1") {
      const doc = readMemoryDocument(path);
      if (!doc) throw new PartnerError("Documento não encontrado.", 404);
      return new NextResponse(new Uint8Array(doc.data), { headers: { "Content-Type": doc.type, "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
    }
    const url = await documentViewUrl(path);
    if (!url) throw new PartnerError("Documento não encontrado.", 404);
    return NextResponse.redirect(new URL(url, req.nextUrl.origin), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao abrir o documento.");
  }
}
