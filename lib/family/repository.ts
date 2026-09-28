// Hello World
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError, dbError } from "@/lib/partners/errors";
import type {
  AccountType,
  Allowance,
  AllowanceInput,
  DocumentRef,
  EmancipationRequest,
  FamilyIdentity,
  FamilyLink,
  FamilyStatus,
  LinkStatus,
  ParentApplication,
  ReviewStatus,
  SpendingLimits,
} from "@/lib/family/types";

/**
 * Persistência das contas de família: identidades (CPF único, nascimento,
 * tipo de conta), pedidos de Conta Pai e de emancipação, vínculos, mesadas e
 * limites. Tabelas family_* no Supabase (só service role); memória no dev.
 */

export interface FamilyRepository {
  getIdentity(userId: string): Promise<FamilyIdentity | null>;
  findIdentityByCpf(cpf: string): Promise<FamilyIdentity | null>;
  /** Cria a identidade; falha com 409 se o CPF já existir (índice único no banco). */
  insertIdentity(identity: Omit<FamilyIdentity, "createdAt" | "updatedAt">): Promise<FamilyIdentity>;
  updateIdentity(userId: string, patch: Partial<Pick<FamilyIdentity, "accountType" | "status" | "parentUserId">>): Promise<FamilyIdentity | null>;

  insertParentApplication(app: Omit<ParentApplication, "id" | "status" | "reviewNote" | "reviewedBy" | "reviewedAt" | "createdAt">): Promise<ParentApplication>;
  latestParentApplication(userId: string): Promise<ParentApplication | null>;
  getParentApplication(id: string): Promise<ParentApplication | null>;
  listParentApplications(status: ReviewStatus | "all"): Promise<ParentApplication[]>;
  decideParentApplication(id: string, status: ReviewStatus, note: string, reviewer: string): Promise<ParentApplication | null>;

  insertEmancipation(req: Pick<EmancipationRequest, "userId" | "fullName" | "email" | "documents">): Promise<EmancipationRequest>;
  latestEmancipation(userId: string): Promise<EmancipationRequest | null>;
  getEmancipation(id: string): Promise<EmancipationRequest | null>;
  listEmancipations(status: ReviewStatus | "all"): Promise<EmancipationRequest[]>;
  decideEmancipation(id: string, status: ReviewStatus, note: string, reviewer: string): Promise<EmancipationRequest | null>;

  insertLink(link: Omit<FamilyLink, "id" | "createdAt" | "approvedAt">): Promise<FamilyLink>;
  getLink(id: string): Promise<FamilyLink | null>;
  listLinksByParent(parentUserId: string, parentEmail: string): Promise<FamilyLink[]>;
  listLinksByChild(childUserId: string): Promise<FamilyLink[]>;
  updateLink(id: string, patch: { status: LinkStatus; parentUserId?: string }): Promise<FamilyLink | null>;

  getAllowance(childUserId: string): Promise<Allowance | null>;
  upsertAllowance(parentUserId: string, childUserId: string, input: AllowanceInput, nextRunAt: string): Promise<Allowance>;
  deleteAllowance(childUserId: string): Promise<boolean>;
  listDueAllowances(now: string): Promise<Allowance[]>;
  /** Registra a execução do período; false se já foi paga (idempotência). */
  claimAllowanceRun(allowanceId: string, periodKey: string, amount: number): Promise<boolean>;
  markAllowanceRun(id: string, lastRunAt: string, nextRunAt: string): Promise<void>;

  getLimits(childUserId: string): Promise<SpendingLimits | null>;
  setLimits(childUserId: string, limits: SpendingLimits, updatedBy: string): Promise<SpendingLimits>;
}

const now = () => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

interface IdentityRow {
  user_id: string;
  account_type: AccountType;
  status: FamilyStatus;
  cpf: string;
  birth_date: string;
  parent_user_id: string | null;
  created_at: string;
  updated_at: string;
}
const mapIdentity = (r: IdentityRow): FamilyIdentity => ({
  userId: r.user_id,
  accountType: r.account_type,
  status: r.status,
  cpf: r.cpf,
  birthDate: String(r.birth_date).slice(0, 10),
  parentUserId: r.parent_user_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

interface ParentAppRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  profession: string;
  income_range: ParentApplication["incomeRange"];
  child_name: string;
  child_birth_date: string;
  documents: DocumentRef[] | null;
  status: ReviewStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
const mapParentApp = (r: ParentAppRow): ParentApplication => ({
  id: r.id,
  userId: r.user_id,
  fullName: r.full_name,
  email: r.email,
  phone: r.phone,
  profession: r.profession,
  incomeRange: r.income_range,
  childName: r.child_name,
  childBirthDate: String(r.child_birth_date).slice(0, 10),
  documents: r.documents ?? [],
  status: r.status,
  reviewNote: r.review_note ?? "",
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
});

interface EmancipationRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  documents: DocumentRef[] | null;
  status: ReviewStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
const mapEmancipation = (r: EmancipationRow): EmancipationRequest => ({
  id: r.id,
  userId: r.user_id,
  fullName: r.full_name,
  email: r.email,
  documents: r.documents ?? [],
  status: r.status,
  reviewNote: r.review_note ?? "",
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  createdAt: r.created_at,
});

interface LinkRow {
  id: string;
  parent_user_id: string | null;
  parent_email: string;
  child_user_id: string;
  child_name: string;
  status: LinkStatus;
  created_at: string;
  approved_at: string | null;
}
const mapLink = (r: LinkRow): FamilyLink => ({
  id: r.id,
  parentUserId: r.parent_user_id,
  parentEmail: r.parent_email,
  childUserId: r.child_user_id,
  childName: r.child_name,
  status: r.status,
  createdAt: r.created_at,
  approvedAt: r.approved_at,
});

interface AllowanceRow {
  id: string;
  parent_user_id: string;
  child_user_id: string;
  amount: number | string;
  frequency: Allowance["frequency"];
  weekday: number;
  month_day: number;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
}
const mapAllowance = (r: AllowanceRow): Allowance => ({
  id: r.id,
  parentUserId: r.parent_user_id,
  childUserId: r.child_user_id,
  amount: Number(r.amount),
  frequency: r.frequency,
  weekday: r.weekday,
  monthDay: r.month_day,
  active: r.active,
  nextRunAt: r.next_run_at,
  lastRunAt: r.last_run_at,
  createdAt: r.created_at,
});

function fail(action: string, error: { message: string; code?: string } | null): void {
  if (!error) return;
  throw dbError(error, `Falha ao ${action}`);
}

function supabaseRepository(): FamilyRepository {
  const db = supabaseAdmin!;
  return {
    async getIdentity(userId) {
      const { data, error } = await db.from("family_identities").select("*").eq("user_id", userId).maybeSingle();
      fail("ler a identidade", error);
      return data ? mapIdentity(data as IdentityRow) : null;
    },
    async findIdentityByCpf(cpf) {
      const { data, error } = await db.from("family_identities").select("*").eq("cpf", cpf).maybeSingle();
      fail("consultar o CPF", error);
      return data ? mapIdentity(data as IdentityRow) : null;
    },
    async insertIdentity(identity) {
      const { data, error } = await db
        .from("family_identities")
        .insert({
          user_id: identity.userId,
          account_type: identity.accountType,
          status: identity.status,
          cpf: identity.cpf,
          birth_date: identity.birthDate,
          parent_user_id: identity.parentUserId,
        })
        .select("*")
        .single();
      fail("salvar a identidade", error);
      return mapIdentity(data as IdentityRow);
    },
    async updateIdentity(userId, patch) {
      const row: Record<string, unknown> = { updated_at: now() };
      if (patch.accountType) row.account_type = patch.accountType;
      if (patch.status) row.status = patch.status;
      if (patch.parentUserId !== undefined) row.parent_user_id = patch.parentUserId;
      const { data, error } = await db.from("family_identities").update(row).eq("user_id", userId).select("*").maybeSingle();
      fail("atualizar a identidade", error);
      return data ? mapIdentity(data as IdentityRow) : null;
    },

    async insertParentApplication(app) {
      const { data, error } = await db
        .from("family_parent_applications")
        .insert({
          user_id: app.userId,
          full_name: app.fullName,
          email: app.email,
          phone: app.phone,
          profession: app.profession,
          income_range: app.incomeRange,
          child_name: app.childName,
          child_birth_date: app.childBirthDate,
          documents: app.documents,
        })
        .select("*")
        .single();
      fail("salvar o pedido de Conta Pai", error);
      return mapParentApp(data as ParentAppRow);
    },
    async latestParentApplication(userId) {
      const { data, error } = await db.from("family_parent_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      fail("ler o pedido de Conta Pai", error);
      return data ? mapParentApp(data as ParentAppRow) : null;
    },
    async getParentApplication(id) {
      const { data, error } = await db.from("family_parent_applications").select("*").eq("id", id).maybeSingle();
      fail("ler o pedido de Conta Pai", error);
      return data ? mapParentApp(data as ParentAppRow) : null;
    },
    async listParentApplications(status) {
      let q = db.from("family_parent_applications").select("*").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      fail("listar pedidos de Conta Pai", error);
      return ((data ?? []) as ParentAppRow[]).map(mapParentApp);
    },
    async decideParentApplication(id, status, note, reviewer) {
      const { data, error } = await db
        .from("family_parent_applications")
        .update({ status, review_note: note, reviewed_by: reviewer, reviewed_at: now() })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      fail("decidir o pedido de Conta Pai", error);
      return data ? mapParentApp(data as ParentAppRow) : null;
    },

    async insertEmancipation(req) {
      const { data, error } = await db
        .from("family_emancipation_requests")
        .insert({ user_id: req.userId, full_name: req.fullName, email: req.email, documents: req.documents })
        .select("*")
        .single();
      fail("salvar o pedido de emancipação", error);
      return mapEmancipation(data as EmancipationRow);
    },
    async latestEmancipation(userId) {
      const { data, error } = await db.from("family_emancipation_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      fail("ler o pedido de emancipação", error);
      return data ? mapEmancipation(data as EmancipationRow) : null;
    },
    async getEmancipation(id) {
      const { data, error } = await db.from("family_emancipation_requests").select("*").eq("id", id).maybeSingle();
      fail("ler o pedido de emancipação", error);
      return data ? mapEmancipation(data as EmancipationRow) : null;
    },
    async listEmancipations(status) {
      let q = db.from("family_emancipation_requests").select("*").order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      fail("listar pedidos de emancipação", error);
      return ((data ?? []) as EmancipationRow[]).map(mapEmancipation);
    },
    async decideEmancipation(id, status, note, reviewer) {
      const { data, error } = await db
        .from("family_emancipation_requests")
        .update({ status, review_note: note, reviewed_by: reviewer, reviewed_at: now() })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      fail("decidir o pedido de emancipação", error);
      return data ? mapEmancipation(data as EmancipationRow) : null;
    },

    async insertLink(link) {
      const { data, error } = await db
        .from("family_links")
        .insert({ parent_user_id: link.parentUserId, parent_email: link.parentEmail, child_user_id: link.childUserId, child_name: link.childName, status: link.status, approved_at: link.status === "active" ? now() : null })
        .select("*")
        .single();
      fail("salvar o vínculo", error);
      return mapLink(data as LinkRow);
    },
    async getLink(id) {
      const { data, error } = await db.from("family_links").select("*").eq("id", id).maybeSingle();
      fail("ler o vínculo", error);
      return data ? mapLink(data as LinkRow) : null;
    },
    async listLinksByParent(parentUserId, parentEmail) {
      const { data, error } = await db
        .from("family_links")
        .select("*")
        .or(`parent_user_id.eq.${parentUserId},and(parent_user_id.is.null,parent_email.eq."${parentEmail}")`)
        .neq("status", "revoked")
        .order("created_at", { ascending: true });
      fail("listar os vínculos", error);
      return ((data ?? []) as LinkRow[]).map(mapLink);
    },
    async listLinksByChild(childUserId) {
      const { data, error } = await db.from("family_links").select("*").eq("child_user_id", childUserId).neq("status", "revoked");
      fail("listar os vínculos", error);
      return ((data ?? []) as LinkRow[]).map(mapLink);
    },
    async updateLink(id, patch) {
      const row: Record<string, unknown> = { status: patch.status };
      if (patch.parentUserId) row.parent_user_id = patch.parentUserId;
      if (patch.status === "active") row.approved_at = now();
      const { data, error } = await db.from("family_links").update(row).eq("id", id).select("*").maybeSingle();
      fail("atualizar o vínculo", error);
      return data ? mapLink(data as LinkRow) : null;
    },

    async getAllowance(childUserId) {
      const { data, error } = await db.from("family_allowances").select("*").eq("child_user_id", childUserId).maybeSingle();
      fail("ler a mesada", error);
      return data ? mapAllowance(data as AllowanceRow) : null;
    },
    async upsertAllowance(parentUserId, childUserId, input, nextRunAt) {
      const { data, error } = await db
        .from("family_allowances")
        .upsert(
          {
            parent_user_id: parentUserId,
            child_user_id: childUserId,
            amount: input.amount,
            frequency: input.frequency,
            weekday: input.weekday,
            month_day: input.monthDay,
            active: input.active,
            next_run_at: nextRunAt,
          },
          { onConflict: "child_user_id" }
        )
        .select("*")
        .single();
      fail("salvar a mesada", error);
      return mapAllowance(data as AllowanceRow);
    },
    async deleteAllowance(childUserId) {
      const { data, error } = await db.from("family_allowances").delete().eq("child_user_id", childUserId).select("id");
      fail("cancelar a mesada", error);
      return (data ?? []).length > 0;
    },
    async listDueAllowances(at) {
      const { data, error } = await db.from("family_allowances").select("*").eq("active", true).lte("next_run_at", at).limit(500);
      fail("listar mesadas", error);
      return ((data ?? []) as AllowanceRow[]).map(mapAllowance);
    },
    async claimAllowanceRun(allowanceId, periodKey, amount) {
      const { error } = await db.from("family_allowance_runs").insert({ allowance_id: allowanceId, period_key: periodKey, amount });
      if (error?.code === "23505") return false;
      fail("registrar a mesada", error);
      return true;
    },
    async markAllowanceRun(id, lastRunAt, nextRunAt) {
      const { error } = await db.from("family_allowances").update({ last_run_at: lastRunAt, next_run_at: nextRunAt }).eq("id", id);
      fail("atualizar a mesada", error);
    },

    async getLimits(childUserId) {
      const { data, error } = await db.from("family_spending_limits").select("*").eq("child_user_id", childUserId).maybeSingle();
      fail("ler os limites", error);
      return data ? { perTransaction: Number(data.per_transaction), daily: Number(data.daily), monthly: Number(data.monthly) } : null;
    },
    async setLimits(childUserId, limits, updatedBy) {
      const { error } = await db
        .from("family_spending_limits")
        .upsert(
          { child_user_id: childUserId, per_transaction: limits.perTransaction, daily: limits.daily, monthly: limits.monthly, updated_by: updatedBy, updated_at: now() },
          { onConflict: "child_user_id" }
        );
      fail("salvar os limites", error);
      return limits;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Memória                                                                    */
/* -------------------------------------------------------------------------- */

interface MemoryFamily {
  identities: Map<string, FamilyIdentity>;
  parentApps: ParentApplication[];
  emancipations: EmancipationRequest[];
  links: FamilyLink[];
  allowances: Map<string, Allowance>;
  runs: Set<string>;
  limits: Map<string, SpendingLimits>;
}

const globalState = globalThis as unknown as { __prxFamily?: MemoryFamily };

/** Conta de demonstração do membro (memória): adulta, com CPF de teste, sem passar pelo portão de identidade. */
const DEMO_IDENTITIES: FamilyIdentity[] = [
  { userId: "usr_demo_member", accountType: "member", status: "active", cpf: "52998224725", birthDate: "2004-05-10", parentUserId: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

function memory(): MemoryFamily {
  return (globalState.__prxFamily ??= {
    identities: new Map(DEMO_IDENTITIES.map((i) => [i.userId, { ...i }])),
    parentApps: [],
    emancipations: [],
    links: [],
    allowances: new Map(),
    runs: new Set(),
    limits: new Map(),
  });
}

const clone = <T>(value: T): T => structuredClone(value);

const memoryRepository: FamilyRepository = {
  async getIdentity(userId) {
    const found = memory().identities.get(userId);
    return found ? clone(found) : null;
  },
  async findIdentityByCpf(cpf) {
    const found = [...memory().identities.values()].find((i) => i.cpf === cpf);
    return found ? clone(found) : null;
  },
  async insertIdentity(identity) {
    const state = memory();
    if ([...state.identities.values()].some((i) => i.cpf === identity.cpf) || state.identities.has(identity.userId)) throw new PartnerError("Registro duplicado.", 409);
    const created: FamilyIdentity = { ...identity, createdAt: now(), updatedAt: now() };
    state.identities.set(identity.userId, created);
    return clone(created);
  },
  async updateIdentity(userId, patch) {
    const current = memory().identities.get(userId);
    if (!current) return null;
    const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), updatedAt: now() } as FamilyIdentity;
    memory().identities.set(userId, next);
    return clone(next);
  },

  async insertParentApplication(app) {
    const created: ParentApplication = { ...app, id: `pa-${crypto.randomUUID()}`, status: "pending", reviewNote: "", reviewedBy: null, reviewedAt: null, createdAt: now() };
    memory().parentApps.unshift(created);
    return clone(created);
  },
  async latestParentApplication(userId) {
    const found = memory().parentApps.find((a) => a.userId === userId);
    return found ? clone(found) : null;
  },
  async getParentApplication(id) {
    const found = memory().parentApps.find((a) => a.id === id);
    return found ? clone(found) : null;
  },
  async listParentApplications(status) {
    return clone(memory().parentApps.filter((a) => status === "all" || a.status === status));
  },
  async decideParentApplication(id, status, note, reviewer) {
    const found = memory().parentApps.find((a) => a.id === id && a.status === "pending");
    if (!found) return null;
    Object.assign(found, { status, reviewNote: note, reviewedBy: reviewer, reviewedAt: now() });
    return clone(found);
  },

  async insertEmancipation(req) {
    const created: EmancipationRequest = { ...req, id: `em-${crypto.randomUUID()}`, status: "pending", reviewNote: "", reviewedBy: null, reviewedAt: null, createdAt: now() };
    memory().emancipations.unshift(created);
    return clone(created);
  },
  async latestEmancipation(userId) {
    const found = memory().emancipations.find((a) => a.userId === userId);
    return found ? clone(found) : null;
  },
  async getEmancipation(id) {
    const found = memory().emancipations.find((a) => a.id === id);
    return found ? clone(found) : null;
  },
  async listEmancipations(status) {
    return clone(memory().emancipations.filter((a) => status === "all" || a.status === status));
  },
  async decideEmancipation(id, status, note, reviewer) {
    const found = memory().emancipations.find((a) => a.id === id && a.status === "pending");
    if (!found) return null;
    Object.assign(found, { status, reviewNote: note, reviewedBy: reviewer, reviewedAt: now() });
    return clone(found);
  },

  async insertLink(link) {
    const state = memory();
    if (state.links.some((l) => l.childUserId === link.childUserId && l.status !== "revoked" && (l.parentUserId === link.parentUserId || l.parentEmail === link.parentEmail))) {
      throw new PartnerError("Registro duplicado.", 409);
    }
    const created: FamilyLink = { ...link, id: `fl-${crypto.randomUUID()}`, createdAt: now(), approvedAt: link.status === "active" ? now() : null };
    state.links.push(created);
    return clone(created);
  },
  async getLink(id) {
    const found = memory().links.find((l) => l.id === id);
    return found ? clone(found) : null;
  },
  async listLinksByParent(parentUserId, parentEmail) {
    return clone(memory().links.filter((l) => l.status !== "revoked" && (l.parentUserId === parentUserId || (!l.parentUserId && l.parentEmail === parentEmail))));
  },
  async listLinksByChild(childUserId) {
    return clone(memory().links.filter((l) => l.childUserId === childUserId && l.status !== "revoked"));
  },
  async updateLink(id, patch) {
    const found = memory().links.find((l) => l.id === id);
    if (!found) return null;
    found.status = patch.status;
    if (patch.parentUserId) found.parentUserId = patch.parentUserId;
    if (patch.status === "active") found.approvedAt = now();
    return clone(found);
  },

  async getAllowance(childUserId) {
    const found = memory().allowances.get(childUserId);
    return found ? clone(found) : null;
  },
  async upsertAllowance(parentUserId, childUserId, input, nextRunAt) {
    const state = memory();
    const current = state.allowances.get(childUserId);
    const next: Allowance = {
      ...input,
      id: current?.id ?? `al-${crypto.randomUUID()}`,
      parentUserId,
      childUserId,
      nextRunAt,
      lastRunAt: current?.lastRunAt ?? null,
      createdAt: current?.createdAt ?? now(),
    };
    state.allowances.set(childUserId, next);
    return clone(next);
  },
  async deleteAllowance(childUserId) {
    return memory().allowances.delete(childUserId);
  },
  async listDueAllowances(at) {
    return clone([...memory().allowances.values()].filter((a) => a.active && a.nextRunAt <= at));
  },
  async claimAllowanceRun(allowanceId, periodKey) {
    const key = `${allowanceId}:${periodKey}`;
    if (memory().runs.has(key)) return false;
    memory().runs.add(key);
    return true;
  },
  async markAllowanceRun(id, lastRunAt, nextRunAt) {
    const found = [...memory().allowances.values()].find((a) => a.id === id);
    if (found) Object.assign(found, { lastRunAt, nextRunAt });
  },

  async getLimits(childUserId) {
    const found = memory().limits.get(childUserId);
    return found ? clone(found) : null;
  },
  async setLimits(childUserId, limits) {
    memory().limits.set(childUserId, clone(limits));
    return clone(limits);
  },
};

/**
 * Supabase quando configurado e o usuário é real (uuid); memória para as contas
 * de demonstração locais — o mesmo critério do PRX BANK.
 */
export function getFamilyRepository(): FamilyRepository {
  return supabaseAdmin ? supabaseRepository() : memoryRepository;
}

export function resetFamilyMemory() {
  delete globalState.__prxFamily;
}
