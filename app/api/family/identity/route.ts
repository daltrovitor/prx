// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { identityInputSchema } from "@/lib/family/types";
import { familyState, registerIdentity } from "@/lib/family/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

/**
 * CPF e nascimento de quem ainda não informou (entrada pelo Google ou conta
 * antiga). Aplica a mesma verificação de idade e de CPF único do cadastro.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rate = checkRateLimit(`family_identity_${user.id}`, 8, 60);
    if (!rate.allowed) throw new PartnerError(`Muitas tentativas. Tente em ${rate.resetInSeconds}s.`, 429);
    const parsed = identityInputSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    await registerIdentity(user, parsed.data);
    return NextResponse.json({ success: true, state: await familyState(user) });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível salvar seus dados.");
  }
}
