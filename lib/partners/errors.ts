// Hello World

/** Erro de regra de negócio do programa de parceiros, com o status HTTP adequado. */
export class PartnerError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503 = 400
  ) {
    super(message);
    this.name = "PartnerError";
  }
}

const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_TABLE_CODES.has(error.code));
}

export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_COLUMN_CODES.has(error.code));
}

export const MIGRATION_HINT =
  "O programa de parceiros ainda não tem tabelas no Supabase. Aplique supabase/migrations/20260925_prx_partner_program.sql.";

/**
 * Converte erro do PostgREST em PartnerError. Tabela ausente vira 503 com a
 * instrução de migração; o detalhe técnico dos demais fica só no log do servidor.
 */
export function dbError(error: { code?: string; message?: string }, fallback: string): PartnerError {
  if (isMissingTable(error)) return new PartnerError(MIGRATION_HINT, 503);
  if (error.code === "23505") return new PartnerError("Registro duplicado.", 409);
  console.warn(`[partners] ${fallback}:`, error.code, error.message);
  return new PartnerError(fallback, 500);
}
