// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PartnerError } from "@/lib/partners/errors";
import { errorResponse, readJson, requireAdmin } from "@/lib/partners/http";
import { setPartnerAccess } from "@/lib/partners/service";
import { firstIssue } from "@/lib/partners/types";

const schema = z.discriminatedUnion("mode", [
  z.object({ partnerId: z.string().min(1), mode: z.literal("link"), email: z.email("E-mail inválido.") }),
  z.object({ partnerId: z.string().min(1), mode: z.literal("create"), email: z.email("E-mail inválido."), name: z.string().trim().min(2).max(120) }),
  z.object({ partnerId: z.string().min(1), mode: z.literal("revoke") }),
]);

/**
 * POST /api/admin/partners/access — vincula, cria ou remove o login do parceiro.
 * A senha temporária (modo "create") volta uma única vez nesta resposta.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new PartnerError(firstIssue(parsed.error), 400);
    const { partnerId, ...request } = parsed.data;
    const { partner, account } = await setPartnerAccess(partnerId, request);
    return NextResponse.json(
      {
        success: true,
        message: request.mode === "revoke" ? "Acesso removido." : `Acesso vinculado a ${account?.email}.`,
        partner,
        temporaryPassword: account?.temporaryPassword,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, "Erro ao configurar o acesso do parceiro.");
  }
}
