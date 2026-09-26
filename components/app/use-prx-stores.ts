// Hello World
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { BankAccountView } from "@/lib/prx/bank";
import type { MemberWallet, PublicEvent } from "@/lib/live/service";

/**
 * Dados do PRX BANK e do PRX LIVE vindos do servidor (/api/bank e /api/live),
 * compartilhados entre as telas por um cache em memória por membro.
 * Nada fica no aparelho: saldo, ingressos e pedidos existem só no banco de dados.
 */

interface ResourceState<T> {
  owner: string | null;
  data: T | null;
  error: string | null;
  loading: boolean;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function createResource<T>(url: string, pick: (json: Record<string, unknown>) => T | null) {
  let state: ResourceState<T> = { owner: null, data: null, error: null, loading: false };
  let inflight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = (next: Partial<ResourceState<T>>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  function load(owner: string): Promise<void> {
    if (state.owner !== owner) {
      state = { owner, data: null, error: null, loading: false };
      inflight = null;
    }
    if (inflight) return inflight;
    emit({ loading: true, error: null });
    inflight = fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (state.owner !== owner) return;
        if (!res.ok) {
          emit({ loading: false, error: typeof json.error === "string" ? json.error : "Não foi possível carregar agora." });
          return;
        }
        emit({ loading: false, data: pick(json) });
      })
      .catch(() => {
        if (state.owner === owner) emit({ loading: false, error: "Sem conexão com o servidor." });
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => state,
    load,
    set(owner: string, data: T) {
      if (state.owner === owner) emit({ data, error: null });
    },
  };
}

const SERVER_SNAPSHOT: ResourceState<never> = { owner: null, data: null, error: null, loading: true };
const serverSnapshot = () => SERVER_SNAPSHOT;

/** Remove carteiras locais de versões antigas (dados de demonstração guardados no aparelho). */
function dropLegacyStorage(userId: string) {
  try {
    window.localStorage.removeItem(`prx:bank:${userId}`);
    window.localStorage.removeItem(`prx:live:${userId}`);
  } catch {
    // sem storage: nada a limpar
  }
}

function useResource<T>(resource: ReturnType<typeof createResource<T>>, userId: string) {
  const state = useSyncExternalStore(resource.subscribe, resource.get, serverSnapshot) as ResourceState<T>;
  const mine = state.owner === userId;
  const needsLoad = !mine || (!state.data && !state.loading && !state.error);

  useEffect(() => {
    if (needsLoad) {
      dropLegacyStorage(userId);
      void resource.load(userId);
    }
  }, [needsLoad, resource, userId]);

  const reload = useCallback(() => resource.load(userId), [resource, userId]);
  return { data: mine ? state.data : null, loading: !mine || state.loading, error: mine ? state.error : null, reload };
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: { error: "Sem conexão com o servidor." } };
  }
}

const failure = (json: Record<string, unknown>, fallback: string): ActionResult => ({ ok: false, error: typeof json.error === "string" ? json.error : fallback });

/* -------------------------------------------------------------------------- */
/* PRX BANK                                                                    */
/* -------------------------------------------------------------------------- */

const bankResource = createResource<BankAccountView>("/api/bank", (json) => (json.account as BankAccountView) ?? null);

export function useBankAccount(userId: string) {
  const { data, loading, error, reload } = useResource(bankResource, userId);

  const run = useCallback(
    async (body: { action: string } & Record<string, unknown>): Promise<ActionResult> => {
      const { ok, json } = await postJson("/api/bank", body);
      if (!ok) return failure(json, "Não foi possível concluir a operação.");
      if (json.account) bankResource.set(userId, json.account as BankAccountView);
      return { ok: true };
    },
    [userId]
  );

  return { account: data, loading, error, reload, run };
}

/* -------------------------------------------------------------------------- */
/* PRX LIVE                                                                    */
/* -------------------------------------------------------------------------- */

export interface LiveData {
  events: PublicEvent[];
  wallet: MemberWallet;
}

const liveResource = createResource<LiveData>("/api/live", (json) =>
  Array.isArray(json.events) && json.wallet ? { events: json.events as PublicEvent[], wallet: json.wallet as MemberWallet } : null
);

export function useLiveData(userId: string) {
  const { data, loading, error, reload } = useResource(liveResource, userId);

  const applyWallet = useCallback(
    (wallet: MemberWallet) => {
      const current = liveResource.get();
      if (current.owner === userId && current.data) liveResource.set(userId, { ...current.data, wallet });
    },
    [userId]
  );

  /** Reserva/garante o ingresso; depois recarrega a vitrine (lugares restantes mudaram). */
  const reserve = useCallback(
    async (input: { eventId: string; batchId: string; run?: unknown }): Promise<ActionResult> => {
      const { ok, json } = await postJson("/api/live", { action: "reserve", ...input });
      if (!ok) return failure(json, "Não foi possível garantir o ingresso.");
      if (json.wallet) applyWallet(json.wallet as MemberWallet);
      void liveResource.load(userId);
      return { ok: true };
    },
    [applyWallet, userId]
  );

  const cancel = useCallback(
    async (ticketId: string): Promise<ActionResult> => {
      const { ok, json } = await postJson("/api/live", { action: "cancel", ticketId });
      if (!ok) return failure(json, "Não foi possível cancelar.");
      if (json.wallet) applyWallet(json.wallet as MemberWallet);
      void liveResource.load(userId);
      return { ok: true };
    },
    [applyWallet, userId]
  );

  const submitFounders = useCallback(
    async (form: FormData): Promise<ActionResult> => {
      try {
        const res = await fetch("/api/live/founders", { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) return failure(json, "Não foi possível enviar sua startup.");
        if (json.wallet) applyWallet(json.wallet as MemberWallet);
        return { ok: true };
      } catch {
        return { ok: false, error: "Sem conexão com o servidor." };
      }
    },
    [applyWallet]
  );

  return { data, loading, error, reload, reserve, cancel, submitFounders };
}

/* Preferência de "ocultar saldo" — conveniência por aparelho. */
const HIDE_KEY = "prx:hide-balance";
const hideListeners = new Set<() => void>();
let memoryHidden = false;

function readHidden(): boolean {
  try {
    const stored = window.localStorage.getItem(HIDE_KEY);
    return stored === null ? memoryHidden : stored === "1";
  } catch {
    return memoryHidden;
  }
}

export function useHiddenBalance(): [boolean, () => void] {
  const hidden = useSyncExternalStore(
    (listener) => {
      hideListeners.add(listener);
      return () => hideListeners.delete(listener);
    },
    readHidden,
    () => false
  );
  const toggle = useCallback(() => {
    memoryHidden = !readHidden();
    try {
      window.localStorage.setItem(HIDE_KEY, memoryHidden ? "1" : "0");
    } catch {
      // sem storage: a preferência vale só nesta sessão
    }
    hideListeners.forEach((listener) => listener());
  }, []);
  return [hidden, toggle];
}
