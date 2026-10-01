// Hello World
import type { AsaasEnvironment } from "@/lib/asaas/config";

/**
 * Tipos do espelho do Asaas no Supabase (migração 20261001_prx_asaas_baas.sql).
 */

export const SUBACCOUNT_STATUSES = ["pending_activation", "active", "blocked", "rejected"] as const;
export type SubaccountStatus = (typeof SUBACCOUNT_STATUSES)[number];
export const SUBACCOUNT_KYC_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SubaccountKycStatus = (typeof SUBACCOUNT_KYC_STATUSES)[number];

export interface Subaccount {
  userId: string;
  asaasAccountId: string | null;
  walletId: string | null;
  /** apiKey cifrada (v1:kid:iv:tag:dados). Nunca vai para o cliente. */
  apiKeySealed: string | null;
  customerId: string | null;
  accountNumber: string | null;
  agency: string | null;
  status: SubaccountStatus;
  kycStatus: SubaccountKycStatus;
  rejectReason: string | null;
  environment: AsaasEnvironment;
  provisioningStartedAt: string | null;
  createdAt: string;
}

export type SubaccountPatch = Partial<Omit<Subaccount, "userId" | "createdAt" | "environment">>;

export const OUTGOING_KINDS = ["pix_key", "pix_qr", "bill"] as const;
export type OutgoingKind = (typeof OUTGOING_KINDS)[number];
export const OUTGOING_STATUSES = ["awaiting_confirmation", "requested", "approved", "refused", "done", "failed", "cancelled", "expired"] as const;
export type OutgoingStatus = (typeof OUTGOING_STATUSES)[number];
/** SaÃ­das que jÃ¡ comprometem o saldo/limite do dia (pedidas ao Asaas e nÃ£o desfeitas). */
export const COMMITTED_OUTGOING: readonly OutgoingStatus[] = ["requested", "approved", "done"];

export interface OutgoingRequest {
  id: string;
  userId: string;
  kind: OutgoingKind;
  amount: number;
  counterparty: string;
  target: string;
  description: string;
  status: OutgoingStatus;
  providerRef: string | null;
  failReason: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export type NewOutgoing = Pick<OutgoingRequest, "userId" | "kind" | "amount" | "counterparty" | "target" | "description">;
export type OutgoingPatch = Partial<Pick<OutgoingRequest, "providerRef" | "failReason" | "confirmedAt">>;

export interface BankNotification {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  body: string;
  amount: number | null;
  readAt: string | null;
  createdAt: string;
}

export type NewNotification = Pick<BankNotification, "userId" | "eventType" | "title" | "body" | "amount"> & { eventId: string | null };

export interface WebhookRecord {
  eventId: string;
  eventType: string;
  asaasAccountId: string | null;
  payload: unknown;
}

/** new: primeiro recebimento; retry: jÃ¡ recebido, mas o processamento falhou; duplicate: jÃ¡ processado. */
export type WebhookRecordResult = "new" | "retry" | "duplicate";

export interface AsaasBankStore {
  getSubaccount(userId: string): Promise<Subaccount | null>;
  findSubaccountByAsaasId(asaasAccountId: string): Promise<Subaccount | null>;
  /** Trava a abertura: true sÃ³ para quem pegou a vez (ou uma trava esquecida hÃ¡ mais de `staleBefore`). */
  reserveSubaccount(userId: string, environment: AsaasEnvironment, staleBefore: string): Promise<boolean>;
  releaseSubaccount(userId: string): Promise<void>;
  saveSubaccount(userId: string, patch: SubaccountPatch): Promise<Subaccount>;

  recordWebhook(input: WebhookRecord): Promise<WebhookRecordResult>;
  finishWebhook(eventId: string, error: string | null): Promise<void>;

  /** false quando o aviso daquele evento jÃ¡ existia. */
  insertNotification(input: NewNotification): Promise<boolean>;
  listNotifications(userId: string, limit: number): Promise<BankNotification[]>;
  markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void>;

  insertOutgoing(input: NewOutgoing): Promise<OutgoingRequest>;
  getOutgoing(id: string): Promise<OutgoingRequest | null>;
  findOutgoingByProviderRef(providerRef: string): Promise<OutgoingRequest | null>;
  /** Troca de status atÃ´mica: sÃ³ sai de um dos `from`. null quando outro processo chegou antes. */
  transitionOutgoing(id: string, from: readonly OutgoingStatus[], to: OutgoingStatus, patch?: OutgoingPatch): Promise<OutgoingRequest | null>;
  /** Soma das saÃ­das comprometidas do membro desde `sinceIso`. */
  outgoingTotalSince(userId: string, sinceIso: string): Promise<number>;
}

export const roundMoney = (value: unknown): number => Math.round(Number(value ?? 0) * 100) / 100;
