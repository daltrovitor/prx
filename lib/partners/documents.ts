// Hello World

/**
 * CPF e CNPJ: normalização, validação dos dígitos verificadores e máscara.
 * Tudo é armazenado só com dígitos; a máscara é aplicada na exibição.
 */

export type DocumentType = "CNPJ" | "CPF";

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Sequências como 000.000.000-00 passam no cálculo, mas não são documentos válidos. */
function isRepeated(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isRepeated(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || isRepeated(cnpj)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(cnpj[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function isValidDocument(type: DocumentType, value: string): boolean {
  return type === "CNPJ" ? isValidCnpj(value) : isValidCpf(value);
}

export function formatDocument(type: DocumentType, value: string): string {
  const d = onlyDigits(value);
  if (type === "CNPJ" && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (type === "CPF" && d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

/** Detecta o tipo pelo tamanho: 11 dígitos = CPF, 14 = CNPJ. */
export function inferDocumentType(value: string): DocumentType | null {
  const length = onlyDigits(value).length;
  if (length === 14) return "CNPJ";
  if (length === 11) return "CPF";
  return null;
}
