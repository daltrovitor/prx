// Hello World
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { userStore } from "@/lib/auth";
import { calculatePrxLevel } from "@/lib/pass-data";
import { PartnerError, dbError } from "@/lib/partners/errors";
import { isUuid } from "@/lib/partners/catalog";
import { DEFAULT_POINT_RULES } from "@/lib/points/rules";
import {
  POINT_RULE_CATEGORIES,
  POINT_RULE_PERIODS,
  POINT_RULE_TRIGGERS,
  POINT_SOURCES,
  type PartnerPurchase,
  type PointMovement,
  type PointRule,
  type PointRuleInput,
  type PointSource,
  type PointTransaction,
} from "@/lib/points/types";

/**
 * Persistência da economia PRX. Supabase (migração 20260927) para contas
 * reais; memória para desenvolvimento e contas de demonstração. O crédito e o
 * débito passam sempre por apply(), que é atômico e idempotente por
 * (origem, referência): o mesmo resgate ou o mesmo Pix nunca pontua duas vezes.
 */

/** Saldo inicial de boas-vindas (mesmo default da coluna profiles.prx_coins). */
export const WELCOME_COINS = 100;

export interface ApplyResult {
  transaction: PointTransaction;
  coins: number;
  xp: number;
  level: number;
  /** true quando a referência já tinha sido creditada: nada mudou. */
  duplicate: boolean;
}

export interface RulesRepository {
  listRules(): Promise<PointRule[]>;
  getRule(id: string): Promise<PointRule | null>;
  insertRule(input: PointRuleInput): Promise<PointRule>;
  updateRule(id: string, input: PointRuleInput): Promise<PointRule | null>;
  deleteRule(id: string): Promise<boolean>;
}

export interface WalletRepository {
  getBalance(userId: string): Promise<{ coins: number; xp: number }>;
  listTransactions(userId: string, limit: number): Promise<PointTransaction[]>;
  /** Último check-in de cada regra (ISO), para a janela de periodicidade. */
  lastClaims(userId: string): Promise<Record<string, string>>;
  apply(userId: string, movement: PointMovement): Promise<ApplyResult>;
  listPurchases(userId: string, limit: number): Promise<PartnerPurchase[]>;
  insertPurchase(purchase: Omit<PartnerPurchase, "id" | "createdAt">): Promise<{ purchase: PartnerPurchase; duplicate: boolean }>;
}

export interface LedgerReader {
  listAllPurchases(sinceIso: string): Promise<PartnerPurchase[]>;
  coinsOutstanding(): Promise<number>;
}

export const INSUFFICIENT_COINS = "PRX Coins insuficientes para este resgate.";

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const int = (value: unknown) => Math.trunc(Number(value ?? 0)) || 0;

/* -------------------------------------------------------------------------- */
/* Supabase                                                                    */
/* -------------------------------------------------------------------------- */

type SupabaseClient = NonNullable<typeof supabaseAdmin>;

interface RuleRow {
  id: string;
  title: string;
  description: string | null;
  trigger: string;
  coins_reward: number;
  xp_reward: number;
  periodicity: string;
  category: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string | null;
}

function mapRule(r: RuleRow): PointRule {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    trigger: oneOf(POINT_RULE_TRIGGERS, r.trigger, "checkin"),
    coins: int(r.coins_reward),
    xp: int(r.xp_reward),
    periodicity: oneOf(POINT_RULE_PERIODS, r.periodicity, "weekly"),
    category: oneOf(POINT_RULE_CATEGORIES, r.category, "geral"),
    active: Boolean(r.is_active),
    sortOrder: int(r.sort_order),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
  };
}

function ruleRow(input: PointRuleInput): Omit<RuleRow, "id" | "created_at" | "updated_at"> {
  return {
    title: input.title,
    description: input.description,
    trigger: input.trigger,
    coins_reward: input.coins,
    xp_reward: input.xp,
    periodicity: input.periodicity,
    category: input.category,
    is_active: input.active,
    sort_order: input.sortOrder,
  };
}

interface TransactionRow {
  id: string;
  user_id: string;
  coins_delta: number;
  xp_delta: number;
  balance_after: number;
  source: string;
  rule_id: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

function mapTransaction(r: TransactionRow): PointTransaction {
  return {
    id: r.id,
    userId: r.user_id,
    coinsDelta: int(r.coins_delta),
    xpDelta: int(r.xp_delta),
    balanceAfter: int(r.balance_after),
    source: oneOf<PointSource>(POINT_SOURCES, r.source, "behavior"),
    ruleId: r.rule_id,
    referenceId: r.reference_id,
    description: r.description ?? "",
    createdAt: r.created_at,
  };
}

interface PurchaseRow {
  id: string;
  user_id: string;
  partner_id: string | null;
  partner_name: string;
  category_id: string;
  end_to_end_id: string;
  pix_key: string | null;
  amount: number | string;
  fee_pct: number | string;
  commission_amount: number | string;
  coins_awarded: number;
  xp_awarded: number;
  match_method: string;
  source: string;
  created_at: string;
}

function mapPurchase(r: PurchaseRow): PartnerPurchase {
  return {
    id: r.id,
    userId: r.user_id,
    partnerId: r.partner_id,
    partnerName: r.partner_name,
    categoryId: r.category_id,
    endToEndId: r.end_to_end_id,
    pixKey: r.pix_key ?? "",
    amount: money(r.amount),
    feePct: money(r.fee_pct),
    commission: money(r.commission_amount),
    coins: int(r.coins_awarded),
    xp: int(r.xp_awarded),
    matchMethod: r.match_method === "document" || r.match_method === "pix_key" ? r.match_method : "name",
    source: r.source === "baas_webhook" ? "baas_webhook" : "sandbox",
    createdAt: r.created_at,
  };
}

class SupabaseRulesRepository implements RulesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listRules() {
    const { data, error } = await this.db.from("behavior_point_rules").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw dbError(error, "Não foi possível carregar as regras de pontos");
    return (data as RuleRow[]).map(mapRule);
  }

  async getRule(id: string) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db.from("behavior_point_rules").select("*").eq("id", id).maybeSingle();
    if (error) throw dbError(error, "Não foi possível carregar a regra");
    return data ? mapRule(data as RuleRow) : null;
  }

  async insertRule(input: PointRuleInput) {
    const { data, error } = await this.db.from("behavior_point_rules").insert(ruleRow(input)).select("*").single();
    if (error) throw dbError(error, "Não foi possível criar a regra");
    return mapRule(data as RuleRow);
  }

  async updateRule(id: string, input: PointRuleInput) {
    if (!isUuid(id)) return null;
    const { data, error } = await this.db
      .from("behavior_point_rules")
      .update({ ...ruleRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw dbError(error, "Não foi possível atualizar a regra");
    return data ? mapRule(data as RuleRow) : null;
  }

  async deleteRule(id: string) {
    if (!isUuid(id)) return false;
    const { data, error } = await this.db.from("behavior_point_rules").delete().eq("id", id).select("id");
    if (error) throw dbError(error, "Não foi possível excluir a regra");
    return (data as unknown[]).length > 0;
  }
}

interface ApplyRow {
  transaction_id: string;
  coins: number;
  xp: number;
  level: number;
  duplicate: boolean;
}

class SupabaseWalletRepository implements WalletRepository, LedgerReader {
  constructor(private readonly db: SupabaseClient) {}

  async getBalance(userId: string) {
    const { data, error } = await this.db.from("profiles").select("prx_coins, nxt_score").eq("id", userId).maybeSingle();
    if (error) throw dbError(error, "Não foi possível consultar os PRX Coins");
    const row = data as { prx_coins?: number | null; nxt_score?: number | null } | null;
    return { coins: int(row?.prx_coins ?? WELCOME_COINS), xp: int(row?.nxt_score ?? 0) };
  }

  async listTransactions(userId: string, limit: number) {
    const { data, error } = await this.db.from("point_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw dbError(error, "Não foi possível carregar o extrato de pontos");
    return (data as TransactionRow[]).map(mapTransaction);
  }

  async lastClaims(userId: string) {
    const { data, error } = await this.db
      .from("point_transactions")
      .select("rule_id, created_at")
      .eq("user_id", userId)
      .eq("source", "behavior")
      .not("rule_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw dbError(error, "Não foi possível consultar os check-ins");
    const out: Record<string, string> = {};
    for (const row of data as Array<{ rule_id: string; created_at: string }>) if (!out[row.rule_id]) out[row.rule_id] = row.created_at;
    return out;
  }

  async apply(userId: string, movement: PointMovement): Promise<ApplyResult> {
    const { data, error } = await this.db.rpc("prx_apply_point_transaction", {
      p_user_id: userId,
      p_coins_delta: movement.coinsDelta,
      p_xp_delta: movement.xpDelta,
      p_source: movement.source,
      p_rule_id: movement.ruleId && isUuid(movement.ruleId) ? movement.ruleId : null,
      p_reference_id: movement.referenceId ?? null,
      p_description: movement.description,
    });
    if (error) {
      if ((error.message || "").includes("PRX_INSUFFICIENT_COINS")) throw new PartnerError(INSUFFICIENT_COINS, 409);
      if (error.code === "PGRST202" || error.code === "42883") throw dbError({ code: "42P01" }, "Função de pontos ausente");
      throw dbError(error, "Não foi possível registrar os pontos");
    }
    const row = (Array.isArray(data) ? data[0] : data) as ApplyRow | undefined;
    if (!row) throw new PartnerError("Não foi possível registrar os pontos.", 500);
    const { data: tx, error: txError } = await this.db.from("point_transactions").select("*").eq("id", row.transaction_id).single();
    if (txError) throw dbError(txError, "Não foi possível ler o extrato de pontos");
    return { transaction: mapTransaction(tx as TransactionRow), coins: int(row.coins), xp: int(row.xp), level: int(row.level), duplicate: Boolean(row.duplicate) };
  }

  async listPurchases(userId: string, limit: number) {
    const { data, error } = await this.db.from("partner_bacen_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw dbError(error, "Não foi possível carregar as compras em parceiros");
    return (data as PurchaseRow[]).map(mapPurchase);
  }

  async insertPurchase(p: Omit<PartnerPurchase, "id" | "createdAt">): Promise<{ purchase: PartnerPurchase; duplicate: boolean }> {
    const existing = await this.db.from("partner_bacen_transactions").select("*").eq("end_to_end_id", p.endToEndId).maybeSingle();
    if (existing.error) throw dbError(existing.error, "Não foi possível consultar a compra");
    if (existing.data) return { purchase: mapPurchase(existing.data as PurchaseRow), duplicate: true };
    const { data, error } = await this.db
      .from("partner_bacen_transactions")
      .insert({
        user_id: p.userId,
        partner_id: p.partnerId && isUuid(p.partnerId) ? p.partnerId : null,
        partner_name: p.partnerName,
        category_id: p.categoryId,
        end_to_end_id: p.endToEndId,
        pix_key: p.pixKey,
        amount: p.amount,
        fee_pct: p.feePct,
        commission_amount: p.commission,
        coins_awarded: p.coins,
        xp_awarded: p.xp,
        match_method: p.matchMethod,
        source: p.source,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return this.insertPurchase(p);
      throw dbError(error, "Não foi possível registrar a compra no parceiro");
    }
    return { purchase: mapPurchase(data as PurchaseRow), duplicate: false };
  }

  async listAllPurchases(sinceIso: string) {
    const { data, error } = await this.db.from("partner_bacen_transactions").select("*").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(5000);
    if (error) throw dbError(error, "Não foi possível carregar as compras em parceiros");
    return (data as PurchaseRow[]).map(mapPurchase);
  }

  async coinsOutstanding() {
    const { data, error } = await this.db.rpc("prx_coins_outstanding");
    if (error) throw dbError(error, "Não foi possível somar os PRX Coins em circulação");
    return int(data);
  }
}

/* -------------------------------------------------------------------------- */
/* Memória (desenvolvimento e contas de demonstração)                          */
/* -------------------------------------------------------------------------- */

interface MemoryWallet {
  coins: number;
  /** XP de quem não está no userStore (o XP das contas de demonstração fica no próprio usuário). */
  xp: number;
  transactions: PointTransaction[];
}

interface MemoryPoints {
  rules: PointRule[];
  wallets: Map<string, MemoryWallet>;
  purchases: PartnerPurchase[];
}

const globalState = globalThis as unknown as { __prxPoints?: MemoryPoints };

function memory(): MemoryPoints {
  if (!globalState.__prxPoints) {
    const now = new Date().toISOString();
    globalState.__prxPoints = {
      rules: DEFAULT_POINT_RULES.map(({ slug, ...rule }) => ({ ...rule, id: `rule-${slug}`, createdAt: now, updatedAt: now })),
      wallets: new Map(),
      purchases: [],
    };
  }
  return globalState.__prxPoints;
}

function memoryWallet(userId: string): MemoryWallet {
  const state = memory();
  let wallet = state.wallets.get(userId);
  if (!wallet) {
    wallet = { coins: WELCOME_COINS, xp: userStore.findById(userId)?.prxScore ?? 0, transactions: [] };
    wallet.transactions.push({
      id: crypto.randomUUID(),
      userId,
      coinsDelta: WELCOME_COINS,
      xpDelta: 0,
      balanceAfter: WELCOME_COINS,
      source: "welcome",
      ruleId: null,
      referenceId: "welcome",
      description: "Boas-vindas ao PRX",
      createdAt: userStore.findById(userId)?.createdAt ?? new Date().toISOString(),
    });
    state.wallets.set(userId, wallet);
  }
  return wallet;
}

function memoryXp(userId: string, wallet: MemoryWallet): number {
  return userStore.findById(userId)?.prxScore ?? wallet.xp;
}

class MemoryRulesRepository implements RulesRepository {
  async listRules() {
    return structuredClone([...memory().rules].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)));
  }

  async getRule(id: string) {
    const rule = memory().rules.find((r) => r.id === id);
    return rule ? structuredClone(rule) : null;
  }

  async insertRule(input: PointRuleInput) {
    const now = new Date().toISOString();
    const rule: PointRule = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    memory().rules.push(rule);
    return structuredClone(rule);
  }

  async updateRule(id: string, input: PointRuleInput) {
    const state = memory();
    const index = state.rules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    state.rules[index] = { ...state.rules[index], ...input, updatedAt: new Date().toISOString() };
    return structuredClone(state.rules[index]);
  }

  async deleteRule(id: string) {
    const state = memory();
    const before = state.rules.length;
    state.rules = state.rules.filter((r) => r.id !== id);
    return state.rules.length < before;
  }
}

class MemoryWalletRepository implements WalletRepository, LedgerReader {
  async getBalance(userId: string) {
    const wallet = memoryWallet(userId);
    return { coins: wallet.coins, xp: memoryXp(userId, wallet) };
  }

  async listTransactions(userId: string, limit: number) {
    return structuredClone(memoryWallet(userId).transactions.slice(0, limit));
  }

  async lastClaims(userId: string) {
    const out: Record<string, string> = {};
    for (const tx of memoryWallet(userId).transactions) if (tx.source === "behavior" && tx.ruleId && !out[tx.ruleId]) out[tx.ruleId] = tx.createdAt;
    return out;
  }

  async apply(userId: string, movement: PointMovement): Promise<ApplyResult> {
    const wallet = memoryWallet(userId);
    const xpNow = memoryXp(userId, wallet);
    if (movement.referenceId) {
      const existing = wallet.transactions.find((t) => t.source === movement.source && t.referenceId === movement.referenceId);
      if (existing) return { transaction: structuredClone(existing), coins: wallet.coins, xp: xpNow, level: calculatePrxLevel(xpNow), duplicate: true };
    }
    if (wallet.coins + movement.coinsDelta < 0) throw new PartnerError(INSUFFICIENT_COINS, 409);
    const xp = xpNow + Math.max(0, movement.xpDelta);
    const level = calculatePrxLevel(xp);
    wallet.coins += movement.coinsDelta;
    wallet.xp = xp;
    if (movement.xpDelta > 0) userStore.updateUser(userId, { prxScore: xp, prxLevel: level });
    const transaction: PointTransaction = {
      id: crypto.randomUUID(),
      userId,
      coinsDelta: movement.coinsDelta,
      xpDelta: Math.max(0, movement.xpDelta),
      balanceAfter: wallet.coins,
      source: movement.source,
      ruleId: movement.ruleId ?? null,
      referenceId: movement.referenceId ?? null,
      description: movement.description,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
    return { transaction: structuredClone(transaction), coins: wallet.coins, xp, level, duplicate: false };
  }

  async listPurchases(userId: string, limit: number) {
    return structuredClone(memory().purchases.filter((p) => p.userId === userId).slice(0, limit));
  }

  async insertPurchase(p: Omit<PartnerPurchase, "id" | "createdAt">) {
    const state = memory();
    const existing = state.purchases.find((x) => x.endToEndId === p.endToEndId);
    if (existing) return { purchase: structuredClone(existing), duplicate: true };
    const purchase: PartnerPurchase = { ...p, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.purchases.unshift(purchase);
    return { purchase: structuredClone(purchase), duplicate: false };
  }

  async listAllPurchases(sinceIso: string) {
    return structuredClone(memory().purchases.filter((p) => p.createdAt >= sinceIso));
  }

  async coinsOutstanding() {
    let total = 0;
    for (const wallet of memory().wallets.values()) total += wallet.coins;
    return total;
  }
}

/** Regras: Supabase quando configurado; memória no desenvolvimento. */
export function getRulesRepository(): RulesRepository {
  return supabaseAdmin ? new SupabaseRulesRepository(supabaseAdmin) : new MemoryRulesRepository();
}

/** Carteira: Supabase para contas reais (uuid); memória para as contas de demonstração. */
export function getWalletRepository(userId: string): WalletRepository {
  return supabaseAdmin && isUuid(userId) ? new SupabaseWalletRepository(supabaseAdmin) : new MemoryWalletRepository();
}

/** Leituras agregadas do painel financeiro (somam Supabase e memória quando os dois existem). */
export function getLedgerReaders(): LedgerReader[] {
  return supabaseAdmin ? [new SupabaseWalletRepository(supabaseAdmin), new MemoryWalletRepository()] : [new MemoryWalletRepository()];
}

/** Só para testes: limpa o estado em memória. */
export function resetPointsMemory() {
  delete globalState.__prxPoints;
}
