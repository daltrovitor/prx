// Hello World
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { checkRateLimit, sanitizeInput } from "@/lib/security";
import { CONSENT_REQUIRED_MESSAGE } from "@/lib/legal";
import { attachSession, createAccount, publicUser } from "@/lib/accounts";
import { PartnerError } from "@/lib/partners/errors";
import { clientIp } from "@/lib/partners/http";
import { sendWelcomeEmail } from "@/lib/notifications/welcome";
import { cpfSchema, onlyDigits } from "@/lib/family/types";

const phoneSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((d) => d.length === 10 || d.length === 11, "Informe o celular com DDD.");

const SignupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome completo é obrigatório").max(120, "Nome muito longo"),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(160),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(128, "Senha muito longa"),
  cpf: cpfSchema,
  phone: phoneSchema,
  // LGPD: sem o aceite dos Termos e da Política de Privacidade não existe conta.
  termsAccepted: z.literal(true, { error: CONSENT_REQUIRED_MESSAGE }),
});

/**
 * Cadastro de membro: nome, e-mail, senha, CPF, celular e aceite dos Termos.
 * O usuário só é salvo quando cadastra CPF e telefone válidos.
 */
// nosemgrep: prx-mutation-route-without-auth — cadastro público com limite de tentativas; cria a própria conta
export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(`signup_${clientIp(req) ?? "anon"}`, 8, 60);
    if (!rate.allowed) return NextResponse.json({ error: `Muitas tentativas. Tente em ${rate.resetInSeconds}s.` }, { status: 429 });

    const parsed = SignupSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    const data = parsed.data;

    const user = await createAccount({
      email: sanitizeInput(data.email),
      fullName: sanitizeInput(data.fullName),
      password: data.password,
      cpf: data.cpf,
      phone: data.phone,
    });
    // "Você entrou. Welcome to PRX." depois da resposta: o cadastro não espera o provedor de e-mail.
    after(() => sendWelcomeEmail({ id: user.id, email: user.email, fullName: user.fullName }));
    return attachSession(NextResponse.json({ success: true, message: "Conta criada. Bem-vindo ao PRX!", user: publicUser(user) }), user);
  } catch (error) {
    if (error instanceof PartnerError) return NextResponse.json({ error: error.message }, { status: error.status === 409 ? 400 : error.status });
    console.warn("[signup] falha ao criar conta");
    return NextResponse.json({ error: "Erro ao registrar a conta." }, { status: 400 });
  }
}
