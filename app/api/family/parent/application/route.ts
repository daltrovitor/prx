// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { onlyDigits, parentApplicationSchema } from "@/lib/family/types";
import { familyState, submitParentApplication } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

const schema = parentApplicationSchema.and(z.object({ phone: z.string().trim().max(20).transform(onlyDigits).default("") }));

/** Passos 2 a 4 do "Sou Pai": profissão, renda, filho e documentos (RG, CPF, CNH, certidão). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    const { phone, ...input } = parsed.data;
    await submitParentApplication({ ...user, phone }, input);
    return NextResponse.json({ success: true, state: await familyState(user) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível enviar o cadastro.");
  }
}
