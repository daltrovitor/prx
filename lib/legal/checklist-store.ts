// Hello World
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/client";
import { PartnerError, dbError, isMissingTable } from "@/lib/partners/errors";
import { LEGAL_SEEDS, LEGAL_STATUSES, seedItem, type LegalChecklistItem, type LegalStatus } from "@/lib/legal/checklist-data";

/*
 * Andamento do checklist jurídico. O texto dos itens mora no código
 * (checklist-data.ts); a tabela legal_checklist guarda só status, responsável,
 * parecer e autoria. Sem a tabela (ou sem Supabase), o andamento fica na memória
 * do servidor e a resposta avisa com persistence: "memory".
 */

export type LegalPersistence = "supabase" | "memory";

export interface LegalMetrics {
  total: number;
  done: number;
  inReview: number;
  pending: number;
  blockers: number;
  /** Itens de prioridade crítica ainda não concluídos. */
  criticalOpen: number;
  percentDone: number;
}

export interface LegalChecklistState {
  items: LegalChecklistItem[];
  metrics: LegalMetrics;
  persistence: LegalPersistence;
}

interface Progress {
  status: LegalStatus;
  responsible: string;
  notes: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface ProgressRow {
  id: string;
  status: LegalStatus;
  responsible: string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const legalPatchSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "Item inválido."),
    status: z.enum(LEGAL_STATUSES, { error: "Status inválido." }).optional(),
    responsible: z.string().trim().max(120, "Responsável muito longo.").optional(),
    notes: z.string().max(4000, "Parecer muito longo (máx. 4.000 caracteres).").optional(),
  })
  .refine((v) => v.status !== undefined || v.responsible !== undefined || v.notes !== undefined, { message: "Nada para atualizar." });
export type LegalPatch = z.output<typeof legalPatchSchema>;

const globalState = globalThis as unknown as { __prxLegalChecklist?: Map<string, Progress> };
const memory = (): Map<string, Progress> => (globalState.__prxLegalChecklist ??= new Map());

export function checklistMetrics(items: ReadonlyArray<LegalChecklistItem>): LegalMetrics {
  const count = (status: LegalStatus) => items.filter((i) => i.status === status).length;
  const done = count("done");
  return {
    total: items.length,
    done,
    inReview: count("in_review"),
    pending: count("pending"),
    blockers: count("blocker"),
    criticalOpen: items.filter((i) => i.priority === "CRITICA" && i.status !== "done").length,
    percentDone: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

/** Andamento salvo: Supabase quando a tabela existe; senão, memória. */
async function readProgress(): Promise<{ progress: Map<string, Progress>; persistence: LegalPersistence }> {
  if (!supabaseAdmin) return { progress: memory(), persistence: "memory" };
  const { data, error } = await supabaseAdmin.from("legal_checklist").select("id, status, responsible, notes, updated_at, updated_by");
  if (error) {
    if (isMissingTable(error)) return { progress: memory(), persistence: "memory" };
    throw dbError(error, "Não foi possível carregar o checklist jurídico");
  }
  const progress = new Map<string, Progress>();
  for (const r of (data ?? []) as ProgressRow[]) {
    progress.set(r.id, { status: r.status, responsible: r.responsible ?? "", notes: r.notes ?? "", updatedAt: r.updated_at, updatedBy: r.updated_by });
  }
  return { progress, persistence: "supabase" };
}

function merge(progress: Map<string, Progress>): LegalChecklistItem[] {
  return LEGAL_SEEDS.map((seed) => {
    const base = seedItem(seed);
    const saved = progress.get(seed.id);
    return saved ? { ...base, ...saved } : base;
  });
}

export async function getLegalChecklist(): Promise<LegalChecklistState> {
  const { progress, persistence } = await readProgress();
  const items = merge(progress);
  return { items, metrics: checklistMetrics(items), persistence };
}

export async function updateLegalItem(patch: LegalPatch, actor: string): Promise<LegalChecklistState & { item: LegalChecklistItem }> {
  const { progress, persistence } = await readProgress();
  const current = merge(progress).find((i) => i.id === patch.id);
  if (!current) throw new PartnerError("Item do checklist não encontrado.", 404);

  const next: Progress = {
    status: patch.status ?? current.status,
    responsible: patch.responsible ?? current.responsible,
    notes: patch.notes ?? current.notes,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };

  if (persistence === "supabase" && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("legal_checklist")
      .upsert({ id: patch.id, status: next.status, responsible: next.responsible, notes: next.notes, updated_at: next.updatedAt, updated_by: next.updatedBy }, { onConflict: "id" });
    if (error) throw dbError(error, "Não foi possível salvar o item do checklist");
  }
  progress.set(patch.id, next);

  const items = merge(progress);
  return { items, metrics: checklistMetrics(items), persistence, item: items.find((i) => i.id === patch.id) ?? { ...current, ...next } };
}

export function resetLegalChecklistMemory(): void {
  delete globalState.__prxLegalChecklist;
}
