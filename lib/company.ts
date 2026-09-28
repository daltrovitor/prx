// Hello World

/**
 * Identificação da empresa nas páginas públicas e documentos legais.
 * Razão social e CNPJ vêm do ambiente para não publicar dado inventado:
 * defina NEXT_PUBLIC_PRX_LEGAL_NAME e NEXT_PUBLIC_PRX_CNPJ na hospedagem.
 */
export const COMPANY = {
  brand: "PRX",
  legalName: process.env.NEXT_PUBLIC_PRX_LEGAL_NAME || "PRX",
  cnpj: process.env.NEXT_PUBLIC_PRX_CNPJ || null,
  /** Canal do Encarregado de Dados (DPO), art. 41 da LGPD. */
  dpoEmail: process.env.NEXT_PUBLIC_PRX_DPO_EMAIL || "privacidade@prx.app.br",
  supportEmail: process.env.NEXT_PUBLIC_PRX_SUPPORT_EMAIL || "contato@prx.app.br",
  domain: "prx.app.br",
  tagline: "Experiências que conectam gerações",
} as const;
