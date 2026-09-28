// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { documentRefSchema } from "@/lib/family/types";
import { familyState, submitEmancipation } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

const schema = z.object({ documents: z.array(documentRefSchema).min(1).max(6) });

/** Comprovação de emancipação (16–17): certidão + documento com foto, analisados pela equipe PRX. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    await submitEmancipation(user, parsed.data.documents);
    return NextResponse.json({ success: true, state: await familyState(user) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível enviar os documentos.");
  }
}
