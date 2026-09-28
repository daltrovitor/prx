// Hello World

/**
 * Valor seguro para filtros PostgREST montados em texto (.or / .filter).
 * Vírgula, ponto, dois-pontos e parênteses são sintaxe do filtro: o valor vai
 * entre aspas duplas, com barra invertida e aspas escapadas (regra do PostgREST).
 */
export function pgQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
