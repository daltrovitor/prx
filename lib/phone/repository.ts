// Hello World
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/client";
import { dbError } from "@/lib/partners/errors";
import type { PhoneCode } from "@/lib/phone/types";

/**
 * Códigos de confirmação (phone_verifications) e o celular confirmado do perfil
 * (profiles.phone / phone_verified_at). Só a service role lê e grava; memória
 * no desenvolvimento.
 */
export interface PhoneRepository {
  /** Último código ainda não usado do membro. */
  latestOpenCode(userId: string): Promise<PhoneCode | null>;
  countCodesSince(userId: string, sinceIso: string): Promise<number>;
  insertCode(code: Omit<PhoneCode, "id" | "attempts" | "consumedAt">): Promise<PhoneCode>;
  /** Soma uma tentativa errada; devolve o total (ou null se o código mudou no meio). */
  addAttempt(code: PhoneCode): Promise<number | null>;
  /** Marca como usado; false se outra requisição usou antes. */
  consume(id: string): Promise<boolean>;
  verifiedPhone(userId: string): Promise<{ phone: string; verifiedAt: string } | null>;
  setVerifiedPhone(userId: string, phone: string, verifiedAt: string): Promise<void>;
  /** Um número confirmado pertence a uma única conta. */
  phoneOwner(phone: string): Promise<string | null>;
}

interface CodeRow {
  id: string;
  user_id: string;
  phone: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

const map = (r: CodeRow): PhoneCode => ({
  id: r.id,
  userId: r.user_id,
  phone: r.phone,
  codeHash: r.code_hash,
  attempts: r.attempts,
  expiresAt: r.expires_at,
  consumedAt: r.consumed_at,
  createdAt: r.created_at,
});

function fail(action: string, error: { message: string; code?: string } | null): void {
  if (error) throw dbError(error, `Falha ao ${action}`);
}

function supabaseRepository(): PhoneRepository {
  const codes = () => supabaseAdmin!.from("phone_verifications");
  const profiles = () => supabaseAdmin!.from("profiles");
  return {
    async latestOpenCode(userId) {
      const { data, error } = await codes().select("*").eq("user_id", userId).is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      fail("ler o código de confirmação", error);
      return data ? map(data as CodeRow) : null;
    },
    async countCodesSince(userId, sinceIso) {
      const { count, error } = await codes().select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", sinceIso);
      fail("contar os códigos de confirmação", error);
      return count ?? 0;
    },
    async insertCode(code) {
      const { data, error } = await codes()
        .insert({ user_id: code.userId, phone: code.phone, code_hash: code.codeHash, expires_at: code.expiresAt, created_at: code.createdAt })
        .select("*")
        .single();
      fail("gerar o código de confirmação", error);
      return map(data as CodeRow);
    },
    async addAttempt(code) {
      const { data, error } = await codes()
        .update({ attempts: code.attempts + 1 })
        .eq("id", code.id)
        .eq("attempts", code.attempts)
        .is("consumed_at", null)
        .select("attempts")
        .maybeSingle();
      fail("registrar a tentativa", error);
      return data ? Number((data as { attempts: number }).attempts) : null;
    },
    async consume(id) {
      const { data, error } = await codes().update({ consumed_at: new Date().toISOString() }).eq("id", id).is("consumed_at", null).select("id").maybeSingle();
      fail("usar o código de confirmação", error);
      return Boolean(data);
    },
    async verifiedPhone(userId) {
      const { data, error } = await profiles().select("phone, phone_verified_at").eq("id", userId).maybeSingle();
      fail("ler o celular do perfil", error);
      const row = data as { phone: string | null; phone_verified_at: string | null } | null;
      return row?.phone && row.phone_verified_at ? { phone: row.phone, verifiedAt: row.phone_verified_at } : null;
    },
    async setVerifiedPhone(userId, phone, verifiedAt) {
      const { error } = await profiles().update({ phone, phone_verified_at: verifiedAt, updated_at: verifiedAt }).eq("id", userId);
      fail("salvar o celular confirmado", error);
    },
    async phoneOwner(phone) {
      const { data, error } = await profiles().select("id").eq("phone", phone).not("phone_verified_at", "is", null).limit(1).maybeSingle();
      fail("conferir o celular", error);
      return data ? String((data as { id: string }).id) : null;
    },
  };
}

/* Memória (desenvolvimento). */
interface MemoryState {
  codes: PhoneCode[];
  phones: Map<string, { phone: string; verifiedAt: string }>;
}

const globalState = globalThis as unknown as { __prxPhone?: MemoryState };
const memory = (): MemoryState => (globalState.__prxPhone ??= { codes: [], phones: new Map() });

const memoryRepository: PhoneRepository = {
  async latestOpenCode(userId) {
    const found = memory().codes.find((c) => c.userId === userId && !c.consumedAt);
    return found ? { ...found } : null;
  },
  async countCodesSince(userId, sinceIso) {
    const since = new Date(sinceIso).getTime();
    return memory().codes.filter((c) => c.userId === userId && new Date(c.createdAt).getTime() >= since).length;
  },
  async insertCode(code) {
    const created: PhoneCode = { ...code, id: `phc-${crypto.randomUUID()}`, attempts: 0, consumedAt: null };
    memory().codes.unshift(created);
    memory().codes.length = Math.min(memory().codes.length, 500);
    return { ...created };
  },
  async addAttempt(code) {
    const found = memory().codes.find((c) => c.id === code.id && c.attempts === code.attempts && !c.consumedAt);
    if (!found) return null;
    found.attempts += 1;
    return found.attempts;
  },
  async consume(id) {
    const found = memory().codes.find((c) => c.id === id && !c.consumedAt);
    if (!found) return false;
    found.consumedAt = new Date().toISOString();
    return true;
  },
  async verifiedPhone(userId) {
    const found = memory().phones.get(userId);
    return found ? { ...found } : null;
  },
  async setVerifiedPhone(userId, phone, verifiedAt) {
    memory().phones.set(userId, { phone, verifiedAt });
  },
  async phoneOwner(phone) {
    for (const [userId, entry] of memory().phones) if (entry.phone === phone) return userId;
    return null;
  },
};

export function getPhoneRepository(): PhoneRepository {
  return supabaseAdmin ? supabaseRepository() : memoryRepository;
}

export function resetPhoneMemory(): void {
  delete globalState.__prxPhone;
}
