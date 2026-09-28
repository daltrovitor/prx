// Hello World
import { supabaseAdmin } from "@/lib/supabase/client";

/**
 * Chaves de acesso (WebAuthn/passkeys) para entrar com biometria ou
 * reconhecimento facial. A biometria nunca sai do aparelho: guardamos só a
 * chave pública e o contador de assinaturas de cada credencial.
 * Tabela webauthn_credentials no Supabase (só service role); memória no dev.
 */
export interface PasskeyRecord {
  /** ID da credencial (base64url), único no mundo. */
  id: string;
  userId: string;
  /** Chave pública COSE em base64url. */
  publicKey: string;
  counter: number;
  transports: string[];
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PasskeyRepository {
  listByUser(userId: string): Promise<PasskeyRecord[]>;
  get(id: string): Promise<PasskeyRecord | null>;
  insert(record: PasskeyRecord): Promise<void>;
  touch(id: string, counter: number): Promise<void>;
  remove(userId: string, id: string): Promise<boolean>;
}

interface PasskeyRow {
  id: string;
  user_id: string;
  public_key: string;
  counter: number | string | null;
  transports: string[] | null;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

const mapRow = (row: PasskeyRow): PasskeyRecord => ({
  id: row.id,
  userId: row.user_id,
  publicKey: row.public_key,
  counter: Number(row.counter ?? 0) || 0,
  transports: row.transports ?? [],
  deviceName: row.device_name ?? "",
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

function supabaseRepository(): PasskeyRepository {
  const db = supabaseAdmin!;
  const table = () => db.from("webauthn_credentials");
  return {
    async listByUser(userId) {
      const { data, error } = await table().select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw new Error(`Falha ao listar biometrias: ${error.message}`);
      return ((data ?? []) as PasskeyRow[]).map(mapRow);
    },
    async get(id) {
      const { data, error } = await table().select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Falha ao ler biometria: ${error.message}`);
      return data ? mapRow(data as PasskeyRow) : null;
    },
    async insert(r) {
      const { error } = await table().insert({
        id: r.id,
        user_id: r.userId,
        public_key: r.publicKey,
        counter: r.counter,
        transports: r.transports,
        device_name: r.deviceName,
        created_at: r.createdAt,
      });
      if (error) throw new Error(`Falha ao salvar biometria: ${error.message}`);
    },
    async touch(id, counter) {
      const { error } = await table().update({ counter, last_used_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(`Falha ao atualizar biometria: ${error.message}`);
    },
    async remove(userId, id) {
      const { data, error } = await table().delete().eq("id", id).eq("user_id", userId).select("id");
      if (error) throw new Error(`Falha ao remover biometria: ${error.message}`);
      return (data ?? []).length > 0;
    },
  };
}

const globalState = globalThis as unknown as { __prxPasskeys?: Map<string, PasskeyRecord> };
const memory = () => (globalState.__prxPasskeys ??= new Map());

const memoryRepository: PasskeyRepository = {
  async listByUser(userId) {
    return [...memory().values()].filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async get(id) {
    return memory().get(id) ?? null;
  },
  async insert(record) {
    memory().set(record.id, { ...record });
  },
  async touch(id, counter) {
    const record = memory().get(id);
    if (record) memory().set(id, { ...record, counter, lastUsedAt: new Date().toISOString() });
  },
  async remove(userId, id) {
    const record = memory().get(id);
    if (!record || record.userId !== userId) return false;
    return memory().delete(id);
  },
};

export function getPasskeyRepository(): PasskeyRepository {
  return supabaseAdmin ? supabaseRepository() : memoryRepository;
}

export function resetPasskeysMemory() {
  memory().clear();
}
