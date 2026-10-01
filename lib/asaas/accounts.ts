// Hello World
import { z } from "zod";
import type { AsaasClient } from "@/lib/asaas/client";

/**
 * Subcontas (BaaS white label) e onboarding KYC no Asaas.
 * Docs: /reference/create-subaccount, /reference/check-pending-documents.
 */

/** Eventos que cada subconta manda para o webhook PRX. */
export const SUBACCOUNT_WEBHOOK_EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_REFUNDED",
  "TRANSFER_DONE",
  "TRANSFER_FAILED",
  "TRANSFER_CANCELLED",
  "BILL_PAID",
  "BILL_FAILED",
  "BILL_CANCELLED",
  "BILL_REFUNDED",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
  "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
  "ACCOUNT_STATUS_DOCUMENT_REJECTED",
] as const;

export interface SubaccountWebhook {
  name: string;
  url: string;
  email: string;
  sendType: "SEQUENTIALLY";
  interrupted: false;
  enabled: true;
  apiVersion: 3;
  authToken: string;
  events: readonly string[];
}

export interface NewSubaccount {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
  webhooks: SubaccountWebhook[];
}

const nullableText = z.string().nullish().transform((v) => v ?? null);

export const createdSubaccountSchema = z.object({
  id: z.string().min(1),
  walletId: z.string().min(1),
  apiKey: z.string().min(10),
  accountNumber: z
    .object({ agency: nullableText, account: nullableText, accountDigit: nullableText })
    .nullish()
    .transform((v) => v ?? null),
});
export type CreatedSubaccount = z.output<typeof createdSubaccountSchema>;

export function createSubaccount(client: AsaasClient, input: NewSubaccount): Promise<CreatedSubaccount> {
  return client.post("/accounts", input, {}, createdSubaccountSchema);
}

export const documentGroupSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  type: z.string(),
  title: nullableText,
  description: nullableText,
  onboardingUrl: z.string().url().nullish().transform((v) => v ?? null),
  documents: z
    .array(z.object({ id: z.string(), status: z.string() }))
    .nullish()
    .transform((v) => v ?? []),
});
export type DocumentGroup = z.output<typeof documentGroupSchema>;

const documentsSchema = z.object({
  rejectReasons: nullableText,
  data: z
    .array(documentGroupSchema)
    .nullish()
    .transform((v) => v ?? []),
});
export type PendingDocuments = z.output<typeof documentsSchema>;

/** Documentos pendentes da subconta. O Asaas pede ~15 s depois da criação antes da primeira consulta. */
export function listDocuments(client: AsaasClient, apiKey: string): Promise<PendingDocuments> {
  return client.get("/myAccount/documents", { apiKey }, documentsSchema);
}

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Envia um arquivo para um grupo de documentos (multipart: documentFile + type). */
export async function uploadDocument(client: AsaasClient, apiKey: string, groupId: string, type: string, file: Blob, filename: string): Promise<void> {
  if (!SAFE_ID.test(groupId)) throw new Error("[asaas] grupo de documento inválido.");
  const form = new FormData();
  form.append("documentFile", file, filename);
  form.append("type", type);
  await client.request(`/myAccount/documents/${groupId}`, { method: "POST", form, apiKey });
}

const accountStatusSchema = z.object({
  general: nullableText,
  documentation: nullableText,
  commercialInfo: nullableText,
  bankAccountInfo: nullableText,
});
export type AccountStatusInfo = z.output<typeof accountStatusSchema>;

/** Situação cadastral da subconta (consulta de reforço quando um webhook se perde). */
export function getAccountStatus(client: AsaasClient, apiKey: string): Promise<AccountStatusInfo> {
  return client.get("/myAccount/status", { apiKey }, accountStatusSchema);
}
