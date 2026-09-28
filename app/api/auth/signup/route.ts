// Hello World
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeInput } from "@/lib/security";
import { errorMessage } from "@/lib/errors";
import { CONSENT_REQUIRED_MESSAGE } from "@/lib/legal";
import { attachSession, createAccount, discardAccount, publicUser } from "@/lib/accounts";
import { PartnerError } from "@/lib/partners/errors";
import { identityInputSchema } from "@/lib/family/types";
import { assertCpfAvailable, assertEligibleAge, FamilyError, registerIdentity } from "@/lib/family/service";

const SignupSchema = z.object({
  fullName: z.string().min(2, "Nome completo é obrigatório"),
  email: z.string().email("E-mail corporativo ou pessoal válido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  /** Verificação de idade e CPF único, antes de a conta existir. */
  cpf: z.string().optional(),
  birthDate: z.string().optional(),
  teenPath: z.enum(["linked", "emancipated"]).optional(),
  parentEmail: z.string().optional(),
  // LGPD: sem o aceite dos Termos e da Política de Privacidade não existe conta.
  termsAccepted: z.literal(true, { error: CONSENT_REQUIRED_MESSAGE }),
});

/**
 * Cadastro do membro. Com CPF e nascimento (tela atual), a idade é conferida
 * antes de criar a conta: menores de 16 vão para a Conta Pai; 16–17 escolhem
 * Conta Filho ou emancipação; CPF repetido é recusado. Sem esses dados
 * (clientes antigos), o app pede CPF e nascimento no primeiro acesso.
 */
export async function POST(req: NextRequest) {
  try {
    const parseResult = SignupSchema.safeParse(await req.json().catch(() => null));
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }
    const data = parseResult.data;

    let identity: z.output<typeof identityInputSchema> | null = null;
    if (data.cpf || data.birthDate) {
      const parsed = identityInputSchema.safeParse({ cpf: data.cpf ?? "", birthDate: data.birthDate ?? "", teenPath: data.teenPath, parentEmail: data.parentEmail ?? "" });
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 422 });
      identity = parsed.data;
      assertEligibleAge(identity);
      await assertCpfAvailable(identity.cpf);
    }

    const user = await createAccount({ email: sanitizeInput(data.email), fullName: sanitizeInput(data.fullName), password: data.password });
    if (identity) {
      try {
        await registerIdentity(user, identity);
      } catch (err) {
        await discardAccount(user.id);
        throw err;
      }
    }

    return attachSession(NextResponse.json({ success: true, message: "Conta criada e ativada imediatamente com sucesso!", user: publicUser(user) }), user);
  } catch (error) {
    if (error instanceof FamilyError) return NextResponse.json({ error: error.message, code: error.code ?? null }, { status: error.status });
    if (error instanceof PartnerError) return NextResponse.json({ error: error.message }, { status: error.status === 409 ? 400 : error.status });
    return NextResponse.json({ error: errorMessage(error) || "Erro ao registrar conta." }, { status: 400 });
  }
}
