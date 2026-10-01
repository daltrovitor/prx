// Hello World
import { z } from "zod";
import type { AsaasClient } from "@/lib/asaas/client";

/** Saldo e extrato da subconta (fonte oficial; o Supabase é só espelho). */

const balanceSchema = z.object({ balance: z.number() });

export async function getBalance(client: AsaasClient, apiKey: string): Promise<number> {
  return (await client.get("/finance/balance", { apiKey }, balanceSchema)).balance;
}
