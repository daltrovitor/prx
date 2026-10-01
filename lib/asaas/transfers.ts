// Hello World
import { z } from "zod";
import type { AsaasClient } from "@/lib/asaas/client";
import type { PixKeyType } from "@/lib/prx/pix";

/**
 * Saída de dinheiro da subconta: Pix por chave (POST /v3/transfers), leitura e
 * pagamento de QR Code Pix (POST /v3/pix/qrCodes/decode e /pay) e pagamento de
 * contas (POST /v3/bill/simulate e /v3/bill). Toda saída leva externalReference
 * = id do pedido no PRX, que o webhook de validação de saque confere.
 */

const ASAAS_KEY_TYPE: Record<PixKeyType, string> = { cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP" };

/** Chave no formato que o Asaas pede: CPF/CNPJ só dígitos, celular com DDD (11 dígitos, sem +55). */
export function asaasPixKey(key: string, type: PixKeyType): { pixAddressKey: string; pixAddressKeyType: string } {
  const digits = key.replace(/\D/g, "");
  const value = type === "cpf" || type === "cnpj" ? digits : type === "phone" ? digits.replace(/^55(?=\d{11}$)/, "") : key.trim();
  return { pixAddressKey: type === "email" ? value.toLowerCase() : value, pixAddressKeyType: ASAAS_KEY_TYPE[type] };
}

const text = z.string().nullish().transform((v) => v ?? null);
const amount = z.number().nullish().transform((v) => v ?? null);

const transferSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  value: z.number(),
  failReason: text,
  endToEndIdentifier: text,
});
export type AsaasTransfer = z.output<typeof transferSchema>;

export function createPixTransfer(
  client: AsaasClient,
  apiKey: string,
  input: { key: string; type: PixKeyType; value: number; description: string; externalReference: string }
): Promise<AsaasTransfer> {
  return client.post(
    "/transfers",
    { ...asaasPixKey(input.key, input.type), value: input.value, description: input.description || undefined, externalReference: input.externalReference },
    { apiKey },
    transferSchema
  );
}

const decodedSchema = z.object({
  payload: z.string(),
  pixKey: text,
  value: amount,
  totalValue: amount,
  canBePaidWithDifferentValue: z.boolean().nullish().transform((v) => v ?? false),
  expirationDate: text,
  description: text,
  receiver: z
    .object({ name: text, tradingName: text, ispbName: text, cpfCnpj: text })
    .nullish()
    .transform((v) => v ?? null),
});
export type DecodedQrCode = z.output<typeof decodedSchema>;

export function decodePixQrCode(client: AsaasClient, apiKey: string, payload: string): Promise<DecodedQrCode> {
  return client.post("/pix/qrCodes/decode", { payload }, { apiKey }, decodedSchema);
}

const qrPaymentSchema = z.object({
  id: z.string().min(1),
  status: text,
  value: z.number(),
  endToEndIdentifier: text,
});

export function payPixQrCode(client: AsaasClient, apiKey: string, input: { payload: string; value: number; description: string }): Promise<z.output<typeof qrPaymentSchema>> {
  return client.post("/pix/qrCodes/pay", { qrCode: { payload: input.payload }, value: input.value, description: input.description || undefined }, { apiKey }, qrPaymentSchema);
}

const billSimulationSchema = z.object({
  minimumScheduleDate: text,
  fee: amount,
  bankSlipInfo: z.object({
    identificationField: text,
    value: amount,
    dueDate: text,
    companyName: text,
    beneficiaryName: text,
    bank: text,
    isOverdue: z.boolean().nullish().transform((v) => v ?? false),
  }),
});
export type BillSimulation = z.output<typeof billSimulationSchema>;

export function simulateBill(client: AsaasClient, apiKey: string, identificationField: string): Promise<BillSimulation> {
  return client.post("/bill/simulate", { identificationField }, { apiKey }, billSimulationSchema);
}

const billSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  value: amount,
  failReasons: text,
});

export function payBill(
  client: AsaasClient,
  apiKey: string,
  input: { identificationField: string; value: number; description: string; externalReference: string }
): Promise<z.output<typeof billSchema>> {
  return client.post("/bill", { ...input, description: input.description || undefined }, { apiKey }, billSchema);
}
