// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security";
import { PartnerError } from "@/lib/partners/errors";
import { clientIp } from "@/lib/partners/http";
import { bankKycSchema } from "@/lib/kyc/types";
import { bankKycState, submitBankKyc } from "@/lib/kyc/service";
import { body, familyErrorResponse, invalid, requireUser } from "@/lib/family/http";

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/bank/kyc — situação da abertura do PRX BANK (sem dados pessoais). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    return NextResponse.json({ kyc: await bankKycState(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return familyErrorResponse(error, "Erro ao carregar a abertura de conta.");
  }
}

/**
 * POST /api/bank/kyc — abertura da conta PRX BANK (KYC bancário). Tudo é
 * validado aqui no servidor (zod + regras antifraude), nunca só na tela.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const rate = checkRateLimit(`bank_kyc_${user.id}`, 5, 300);
    if (!rate.allowed) throw new PartnerError(`Muitas tentativas. Tente em ${rate.resetInSeconds}s.`, 429);
    const parsed = bankKycSchema.safeParse(await body(req));
    if (!parsed.success) invalid(parsed.error.issues);
    await submitBankKyc(user, parsed.data, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? "" });
    return NextResponse.json({ success: true, kyc: await bankKycState(user.id) }, { headers: NO_STORE });
  } catch (error) {
    return familyErrorResponse(error, "Não foi possível enviar a abertura de conta.");
  }
}
