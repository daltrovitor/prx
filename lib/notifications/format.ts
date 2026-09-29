// Hello World

/** Máscara para registros e telas: g***@gmail.com. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1) || "*"}***@${domain}`;
}

/** Celular brasileiro (11 dígitos, DDD + 9) mascarado: (11) *****-7777. */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
}

/** Celular formatado para a tela: (11) 98888-7777. */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return d;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * O cadastro guarda o nome já escapado para HTML (sanitizeInput). Aqui ele volta
 * ao texto original para ser escapado uma única vez no e-mail (sem "&amp;#x27;").
 */
export function unescapeStored(value: string): string {
  return value
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Primeiro nome para a saudação ("Gabriela Souza" → "Gabriela"). */
export function firstName(fullName: string): string {
  const name = unescapeStored(fullName).trim().split(/\s+/)[0] ?? "";
  return name.slice(0, 40);
}
