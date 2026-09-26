// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import { firstIssue } from "@/lib/partners/types";
import { FOUNDERS_STATUSES } from "@/lib/live/types";
import { foundersDeck, listFounders, setFoundersStatus } from "@/lib/live/service";

/**
 * GET /api/admin/live/founders — submissões do PRX FOUNDERS.
 * GET /api/admin/live/founders?deck=<id> — abre o pitch deck (link assinado de 5 min).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const deckId = req.nextUrl.searchParams.get("deck");
    if (!deckId) return NextResponse.json({ success: true, submissions: await listFounders() }, { headers: { "Cache-Control": "no-store" } });

    const { file, fileName } = await foundersDeck(deckId);
    if ("url" in file) return NextResponse.redirect(file.url, 302);
    const safeName = fileName.replace(/[^\w.\- ]+/g, "_");
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, "Erro ao carregar as submissões.");
  }
}

const schema = z.object({ id: z.string().min(1), status: z.enum(FOUNDERS_STATUSES), adminNote: z.string().max(1000).default("") });

/** PUT /api/admin/live/founders — muda a etapa da startup e o retorno para o membro. */
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    return NextResponse.json({ success: true, submission: await setFoundersStatus(parsed.data.id, parsed.data.status, parsed.data.adminNote) });
  } catch (error) {
    return errorResponse(error, "Erro ao atualizar a submissão.");
  }
}
