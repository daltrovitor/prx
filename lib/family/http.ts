// Hello World
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, type StoredUser } from "@/lib/auth";
import { errorResponse } from "@/lib/partners/http";
import { PartnerError } from "@/lib/partners/errors";
import { FamilyError } from "@/lib/family/service";

/** Erro com o código que a tela usa para decidir o próximo passo (ex.: PARENT_REQUIRED → Conta Pai). */
export function familyErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof FamilyError) return NextResponse.json({ error: error.message, code: error.code ?? null }, { status: error.status });
  return errorResponse(error, fallback);
}

export async function requireUser(req: NextRequest): Promise<StoredUser> {
  const user = await getCurrentUser(req);
  if (!user) throw new PartnerError("Entre na sua conta para continuar.", 401);
  return user;
}

export async function body(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new PartnerError("Corpo da requisição inválido.", 400);
  }
}

export function invalid(issues: ReadonlyArray<{ message: string }>): never {
  throw new PartnerError(issues[0]?.message || "Dados inválidos.", 422);
}
