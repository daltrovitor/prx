// Hello World

/**
 * E-mails que sempre recebem o papel de administrador.
 *
 * Os padrões são as contas já existentes do dono do projeto (criadas antes do
 * rebrand PRX, por isso mantêm o domínio antigo). Para trocar, defina
 * PRX_ADMIN_EMAILS com uma lista separada por vírgula.
 *
 * Como a lista concede privilégio pelo e-mail, esses endereços nunca podem ser
 * registrados pelo cadastro público — ver isReservedAdminEmail.
 */
const DEFAULT_ADMIN_EMAILS = ["adminv@nxtgen.com", "admin@nxtgen.app", "vitorrocketleague@gmail.com"];

function normalize(email: string | null | undefined): string {
  return (email || "").toLowerCase().trim();
}

export function getAdminAllowlist(): string[] {
  const fromEnv = process.env.PRX_ADMIN_EMAILS;
  const list = fromEnv ? fromEnv.split(",") : DEFAULT_ADMIN_EMAILS;
  return list.map(normalize).filter(Boolean);
}

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  const normalized = normalize(email);
  return normalized.length > 0 && getAdminAllowlist().includes(normalized);
}

/** Usado pelo cadastro público para impedir que alguém registre um e-mail de admin. */
export const isReservedAdminEmail = isAllowlistedAdmin;
