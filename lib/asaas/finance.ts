// Hello World
import { z } from "zod";
import type { AsaasClient } from "@/lib/asaas/client";

/** Saldo e extrato da subconta (fonte oficial; o Supabase é só espelho). */

const balanceSchema = z.object({ balance: z.number() });

export async function getBalance(client: AsaasClient, apiKey: string): Promise<number> {
  return (await client.get("/finance/balance", { apiKey }, balanceSchema)).balance;
}

const text = z.string().nullish().transform((v) => v ?? null);

const financialTransactionSchema = z.object({
  id: z.string().min(1),
  value: z.number(),
  balance: z.number().nullish().transform((v) => v ?? null),
  type: z.string(),
  date: z.string(),
  description: text,
  paymentId: text,
  transferId: text,
});
export type FinancialTransaction = z.output<typeof financialTransactionSchema>;

const statementSchema = z.object({
  hasMore: z.boolean().nullish().transform((v) => v ?? false),
  totalCount: z.number().nullish().transform((v) => v ?? 0),
  offset: z.number().nullish().transform((v) => v ?? 0),
  data: z
    .array(financialTransactionSchema)
    .nullish()
    .transform((v) => v ?? []),
});
export type FinancialStatement = z.output<typeof statementSchema>;

/** Extrato paginado (GET /v3/financialTransactions), mais recente primeiro. */
export function listFinancialTransactions(
  client: AsaasClient,
  apiKey: string,
  query: { offset: number; limit: number; startDate?: string; finishDate?: string }
): Promise<FinancialStatement> {
  return client.get("/financialTransactions", { apiKey, query: { ...query, order: "desc" } }, statementSchema);
}
