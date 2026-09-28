// Hello World
import { z } from "zod";
import { isValidCpf } from "@/lib/prx/pix";

/*
 * Contas de família PRX.
 *   member → conta comum (18 a 29 anos, ou 16–17 emancipado aprovado)
 *   minor  → conta de menor de idade, sempre sob um responsável (ou em análise de emancipação)
 *   parent → Conta Pai: só controle, segurança e mesada — não guarda dinheiro nem rende
 */

export const ACCOUNT_TYPES = ["member", "minor", "parent"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Situação de uma conta de menor (16–17 anos) ou de uma Conta Pai. */
export const FAMILY_STATUSES = [
  "active",
  /** 16–17: esperando o responsável aceitar o vínculo. */
  "link_pending",
  /** 16–17: documentos de emancipação em análise. */
  "emancipation_pending",
  /** Conta Pai: documentos em análise. */
  "parent_review",
  "rejected",
] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const FAMILY_STATUS_LABEL: Record<FamilyStatus, string> = {
  active: "Ativa",
  link_pending: "Aguardando o responsável",
  emancipation_pending: "Emancipação em análise",
  parent_review: "Cadastro em análise",
  rejected: "Não aprovada",
};

export interface FamilyIdentity {
  userId: string;
  accountType: AccountType;
  status: FamilyStatus;
  cpf: string;
  birthDate: string;
  parentUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Faixas de idade da política PRX (horário de Brasília). */
export type AgeGroup = "child" | "teen" | "adult" | "over";
export const MIN_SELF_SIGNUP_AGE = 16;
export const ADULT_AGE = 18;
export const MAX_MEMBER_AGE = 29;

export const PARENT_REQUIRED_MESSAGE = "Menores de 16 anos entram no PRX pela Conta Pai: um responsável cria e acompanha a conta.";
export const OVER_AGE_MESSAGE = "O ecossistema PRX é exclusivo para jovens até 29 anos (Gerações Alpha e Z). Responsáveis podem abrir a Conta Pai.";
export const CPF_TAKEN_MESSAGE = "Este CPF já está cadastrado no PRX. Entre com a conta existente ou fale com o suporte.";

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const cpfSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((digits) => isValidCpf(digits), "CPF inválido. Confira os 11 números.");

/** Data no formato AAAA-MM-DD, real e no passado. */
export const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y >= 1900 && date.getTime() < Date.now();
  }, "Data de nascimento inválida.");

/** Caminho escolhido por quem tem 16 ou 17 anos. */
export const TEEN_PATHS = ["linked", "emancipated"] as const;
export type TeenPath = (typeof TEEN_PATHS)[number];

export const identityInputSchema = z.object({
  cpf: cpfSchema,
  birthDate: birthDateSchema,
  teenPath: z.enum(TEEN_PATHS).optional(),
  /** Conta Filho: e-mail da Conta Pai do responsável. */
  parentEmail: z.string().trim().toLowerCase().email("Informe o e-mail do responsável.").max(160).optional().or(z.literal("")),
});
export type IdentityInput = z.output<typeof identityInputSchema>;

/* -------------------------------------------------------------------------- */
/* Documentos                                                                 */
/* -------------------------------------------------------------------------- */

export const DOCUMENT_KINDS = ["rg", "cpf", "cnh", "child_certificate", "emancipation_certificate", "id_document"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  rg: "RG",
  cpf: "CPF",
  cnh: "CNH",
  child_certificate: "Certidão de nascimento do filho",
  emancipation_certificate: "Certidão de emancipação",
  id_document: "Documento com foto",
};

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"] as const;

export const documentRefSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  path: z.string().trim().min(3).max(300),
  name: z.string().trim().max(160).default(""),
});
export type DocumentRef = z.output<typeof documentRefSchema>;

/* -------------------------------------------------------------------------- */
/* Conta Pai                                                                  */
/* -------------------------------------------------------------------------- */

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" };

export const INCOME_RANGES = ["ate_3k", "3k_6k", "6k_10k", "10k_20k", "acima_20k"] as const;
export type IncomeRange = (typeof INCOME_RANGES)[number];
export const INCOME_LABEL: Record<IncomeRange, string> = {
  ate_3k: "Até R$ 3.000",
  "3k_6k": "R$ 3.000 a R$ 6.000",
  "6k_10k": "R$ 6.000 a R$ 10.000",
  "10k_20k": "R$ 10.000 a R$ 20.000",
  acima_20k: "Acima de R$ 20.000",
};

export const parentSignupSchema = z.object({
  fullName: z.string().trim().min(5, "Informe o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128),
  cpf: cpfSchema,
  birthDate: birthDateSchema,
  phone: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((d) => d.length === 10 || d.length === 11, "Informe o celular com DDD."),
  termsAccepted: z.literal(true, { error: "Aceite os Termos de Uso e a Política de Privacidade para continuar." }),
});

export const parentApplicationSchema = z.object({
  profession: z.string().trim().min(2, "Informe a profissão.").max(80),
  incomeRange: z.enum(INCOME_RANGES, { error: "Escolha a faixa de renda." }),
  childName: z.string().trim().min(2, "Informe o nome do filho.").max(120),
  childBirthDate: birthDateSchema,
  documents: z.array(documentRefSchema).max(8),
});
export type ParentApplicationInput = z.output<typeof parentApplicationSchema>;

/** Documentos obrigatórios da Conta Pai: RG, CPF e certidão do filho (CNH é opcional, substitui RG+CPF). */
export function missingParentDocuments(docs: ReadonlyArray<{ kind: DocumentKind }>): DocumentKind[] {
  const has = (k: DocumentKind) => docs.some((d) => d.kind === k);
  const missing: DocumentKind[] = [];
  if (!has("cnh")) {
    if (!has("rg")) missing.push("rg");
    if (!has("cpf")) missing.push("cpf");
  }
  if (!has("child_certificate")) missing.push("child_certificate");
  return missing;
}

export interface ParentApplication extends ParentApplicationInput {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  status: ReviewStatus;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface EmancipationRequest {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  documents: DocumentRef[];
  status: ReviewStatus;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const reviewSchema = z.object({
  kind: z.enum(["parent", "emancipation"]),
  id: z.string().trim().min(1).max(100),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(280).default(""),
});

/* -------------------------------------------------------------------------- */
/* Vínculos, mesada e limites                                                 */
/* -------------------------------------------------------------------------- */

export const LINK_STATUSES = ["pending", "active", "revoked"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export interface FamilyLink {
  id: string;
  parentUserId: string | null;
  /** Pedido feito por um jovem de 16–17 com o e-mail do responsável (antes de a Conta Pai existir). */
  parentEmail: string;
  childUserId: string;
  childName: string;
  status: LinkStatus;
  createdAt: string;
  approvedAt: string | null;
}

export const childAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome do filho.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128),
  cpf: cpfSchema,
  birthDate: birthDateSchema,
});

export const FREQUENCIES = ["weekly", "monthly"] as const;
export type AllowanceFrequency = (typeof FREQUENCIES)[number];
export const FREQUENCY_LABEL: Record<AllowanceFrequency, string> = { weekly: "Semanal", monthly: "Mensal" };
export const WEEKDAY_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export const allowanceSchema = z
  .object({
    amount: z.coerce.number().positive("Informe o valor da mesada.").max(5_000, "Mesada de até R$ 5.000."),
    frequency: z.enum(FREQUENCIES),
    weekday: z.coerce.number().int().min(0).max(6).default(1),
    monthDay: z.coerce.number().int().min(1).max(28).default(5),
    active: z.boolean().default(true),
  })
  .transform((a) => ({ ...a, amount: Math.round(a.amount * 100) / 100 }));
export type AllowanceInput = z.output<typeof allowanceSchema>;

export interface Allowance extends AllowanceInput {
  id: string;
  parentUserId: string;
  childUserId: string;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
}

export const limitsSchema = z
  .object({
    perTransaction: z.coerce.number().min(0).max(50_000),
    daily: z.coerce.number().min(0).max(50_000),
    monthly: z.coerce.number().min(0).max(200_000),
  })
  .refine((l) => l.perTransaction <= l.daily || l.daily === 0, { message: "O limite por compra não pode passar do limite diário.", path: ["perTransaction"] })
  .refine((l) => l.daily <= l.monthly || l.monthly === 0, { message: "O limite diário não pode passar do mensal.", path: ["daily"] });
export type SpendingLimits = z.output<typeof limitsSchema>;

/** Limites iniciais de uma conta de menor: conservadores até o responsável ajustar. 0 = sem gasto. */
export const DEFAULT_MINOR_LIMITS: SpendingLimits = { perTransaction: 100, daily: 150, monthly: 600 };

export const transferSchema = z.object({
  amount: z.coerce.number().positive("Informe o valor.").max(5_000, "Até R$ 5.000 por envio."),
  note: z.string().trim().max(60).default(""),
});
