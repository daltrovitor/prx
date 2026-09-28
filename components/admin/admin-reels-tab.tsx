// Hello World
"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useConfirmToast } from "@/components/ui/confirm-toast";
import { Button, Checkbox, EmptyState, Field, Input, Notice, Select, Sheet, Tag, Textarea } from "@/components/app/ui";
import { IconPlus, IconUpload } from "@/components/icons/prx-icons";
import type { PartnerOverview } from "@/lib/partners/service";
import type { Benefit } from "@/lib/pass-data";
import {
  REEL_COLLECTIONS,
  REEL_COLLECTION_LABEL,
  REEL_CTA_KINDS,
  REEL_CTA_LABEL,
  ctaLabelOf,
  type PartnerReel,
  type ReelCollection,
  type ReelCtaKind,
} from "@/lib/reels/types";

interface ReelForm {
  partnerId: string;
  brandName: string;
  collection: ReelCollection;
  title: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  ctaKind: ReelCtaKind;
  ctaLabel: string;
  ctaTarget: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY: ReelForm = {
  partnerId: "",
  brandName: "",
  collection: "descubra",
  title: "",
  caption: "",
  videoUrl: "",
  posterUrl: "",
  ctaKind: "catalog",
  ctaLabel: "",
  ctaTarget: "",
  sortOrder: "0",
  active: true,
};

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Envio em duas etapas: o servidor valida e devolve uma URL assinada do
 * Supabase Storage, e o navegador manda o arquivo direto para lá (sem o limite
 * de corpo da hospedagem). Sem Supabase, o arquivo vai para a própria API.
 */
async function upload(file: File, kind: "video" | "poster"): Promise<string> {
  const res = await fetch("/api/admin/reels/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: file.type, size: file.size }),
  });
  const json = (await res.json().catch(() => ({}))) as { mode?: "signed" | "direct"; signedUrl?: string; publicUrl?: string; error?: string };
  if (!res.ok) throw new Error(json.error || "Falha no envio.");

  if (json.mode === "signed" && json.signedUrl && json.publicUrl) {
    const body = new FormData();
    body.append("cacheControl", "31536000");
    body.append("", file);
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const put = await fetch(json.signedUrl, { method: "PUT", headers: { "x-upsert": "false", ...(anon ? { apikey: anon } : {}) }, body });
    if (!put.ok) throw new Error(`O Storage recusou o arquivo (${put.status}). Tente de novo.`);
    return json.publicUrl;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const direct = await fetch("/api/admin/reels/upload", { method: "POST", body: form });
  const data = (await direct.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!direct.ok || !data.url) throw new Error(data.error || "Falha no envio.");
  return data.url;
}

/**
 * Destaques: vídeos verticais 9:16 com produtos e novidades dos parceiros no
 * feed da aba Destaques. O feed mostra a marca e o botão de ação; métricas
 * ficam só aqui. Parceiro cadastrado é opcional (basta o nome da marca).
 */
export function AdminReelsTab({ partners, benefits }: { partners: PartnerOverview[]; benefits: Benefit[] }) {
  const { confirmDelete, showToast } = useConfirmToast();
  const [reels, setReels] = useState<PartnerReel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerReel | null>(null);
  const [form, setForm] = useState<ReelForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"video" | "poster" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectable = partners.filter((p) => p.status !== "BLOQUEADO");
  const partnerBenefits = useMemo(() => benefits.filter((b) => b.partnerId === form.partnerId), [benefits, form.partnerId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reels", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { reels?: PartnerReel[]; error?: string };
      if (!res.ok || !json.reels) throw new Error(json.error || "Não foi possível carregar os Destaques.");
      setReels(json.reels);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Sem conexão.");
      setReels((r) => r ?? []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, partnerId: selectable[0]?.id ?? "" });
    setError(null);
    setOpen(true);
  }

  function openEdit(reel: PartnerReel) {
    setEditing(reel);
    setForm(reelToForm(reel));
    setError(null);
    setOpen(true);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>, kind: "video" | "poster") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const url = await upload(file, kind);
      setForm((f) => (kind === "video" ? { ...f, videoUrl: url } : { ...f, posterUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setUploading(null);
    }
  }

  async function save(body: Record<string, unknown>, method: "POST" | "PUT") {
    const res = await fetch("/api/admin/reels", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !json.success) throw new Error(json.error || "Não foi possível salvar o vídeo.");
  }

  function payload(f: ReelForm) {
    return { ...f, sortOrder: Number(f.sortOrder) || 0, ctaTarget: f.ctaKind === "catalog" ? "" : f.ctaTarget };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await save(editing ? { id: editing.id, ...payload(form) } : payload(form), editing ? "PUT" : "POST");
      showToast("success", editing ? "Destaque atualizado." : "Vídeo publicado nos Destaques.");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sem conexão com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(reel: PartnerReel) {
    try {
      await save({ id: reel.id, ...payload({ ...reelToForm(reel), active: !reel.active }) }, "PUT");
      await load();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Não foi possível alterar.");
    }
  }

  async function remove(reel: PartnerReel) {
    const ok = await confirmDelete({ title: "Excluir vídeo", message: `"${reel.title}" sai do feed e as métricas são apagadas.`, confirmText: "Excluir", cancelText: "Cancelar" });
    if (!ok) return;
    const res = await fetch(`/api/admin/reels?id=${encodeURIComponent(reel.id)}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Vídeo excluído.");
      await load();
    } else showToast("error", "Não foi possível excluir.");
  }

  const totals = (reels ?? []).reduce((acc, r) => ({ views: acc.views + r.views, likes: acc.likes + r.likes, clicks: acc.clicks + r.ctaClicks }), { views: 0, likes: 0, clicks: 0 });

  return (
    <section aria-labelledby="reels-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="reels-title" className="text-2xl font-semibold tracking-[-0.03em] text-ink">
            Destaques
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Vídeos verticais 9:16 com produtos e novidades dos parceiros. Cada vídeo leva a um benefício, ao catálogo ou à loja.
          </p>
        </div>
        <Button onClick={openCreate}>
          <IconPlus size={18} />
          Novo vídeo
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Kpi label="Visualizações" value={compact.format(totals.views)} />
        <Kpi label="Curtidas" value={compact.format(totals.likes)} />
        <Kpi label="Cliques no botão" value={compact.format(totals.clicks)} />
      </dl>

      {loadError && <Notice tone="error">{loadError}</Notice>}

      {reels === null ? (
        <div role="status" aria-label="Carregando" className="h-32 rounded-2xl bg-surface" />
      ) : reels.length === 0 ? (
        <EmptyState title="Nenhum vídeo nos Destaques" body="Publique o primeiro vídeo vertical de um parceiro." action={<Button onClick={openCreate}>Publicar vídeo</Button>} />
      ) : (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[13px] text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Vídeo</th>
                <th scope="col" className="px-4 py-3 font-medium">Parceiro</th>
                <th scope="col" className="px-4 py-3 font-medium">Ação</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Ordem</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Views</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Curtidas · salvos</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cliques</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reels.map((reel) => (
                <tr key={reel.id} className="transition-colors hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative block h-14 w-8 shrink-0 overflow-hidden rounded-md bg-[#0b0b10]">
                        {reel.posterUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- capa enviada pelo admin (Storage ou memória), sem otimização de imagem
                          <img src={reel.posterUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{reel.title}</p>
                        <p className="text-[13px] text-muted-foreground">{REEL_COLLECTION_LABEL[reel.collection]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink">{reel.partnerName}</td>
                  <td className="px-4 py-3 text-[13px] text-ink">{ctaLabelOf(reel)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{reel.sortOrder}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{reel.views.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {reel.likes.toLocaleString("pt-BR")} · {reel.saves.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{reel.ctaClicks.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">{reel.active ? <Tag tone="success">No feed</Tag> : <Tag>Pausado</Tag>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(reel)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void toggle(reel)}>
                        {reel.active ? "Pausar" : "Ativar"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(reel)}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? "Editar destaque" : "Novo vídeo nos Destaques"}
        description="Formato vertical 9:16, até 60 segundos e 50 MB. O feed mostra a marca e o botão de ação."
        footer={
          <Button block type="submit" form="reel-form" disabled={saving || uploading !== null}>
            {uploading ? "Enviando arquivo…" : saving ? "Salvando…" : editing ? "Salvar destaque" : "Publicar nos Destaques"}
          </Button>
        }
      >
        <form id="reel-form" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Parceiro" hint={selectable.length === 0 ? "Nenhum parceiro cadastrado: informe só a marca ao lado." : undefined}>
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value, ctaKind: !e.target.value && form.ctaKind === "benefit" ? "catalog" : form.ctaKind, ctaTarget: form.ctaKind === "benefit" ? "" : form.ctaTarget })}
              >
                <option value="">Sem cadastro (só a marca)</option>
                {selectable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tradeName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!form.partnerId && (
            <Field label="Nome da marca" hint="Aparece no cartão do vídeo.">
              {(id, describedBy) => <Input id={id} aria-describedby={describedBy} required minLength={2} maxLength={80} value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />}
            </Field>
          )}
          <Field label="Coleção">
            {(id) => (
              <Select id={id} value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value as ReelCollection })}>
                {REEL_COLLECTIONS.map((c) => (
                  <option key={c} value={c}>
                    {REEL_COLLECTION_LABEL[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Título" className="sm:col-span-2">
            {(id) => <Input id={id} required minLength={2} maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
          </Field>
          <Field label="Legenda (opcional)" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} maxLength={220} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />}
          </Field>

          <MediaField label="Vídeo vertical (MP4, WEBM ou MOV, até 50 MB)" value={form.videoUrl} busy={uploading === "video"} accept="video/mp4,video/webm,video/quicktime" onUrl={(videoUrl) => setForm({ ...form, videoUrl })} onFile={(e) => void onFile(e, "video")} />
          <MediaField label="Capa (JPG, PNG ou WEBP)" value={form.posterUrl} busy={uploading === "poster"} accept="image/jpeg,image/png,image/webp" onUrl={(posterUrl) => setForm({ ...form, posterUrl })} onFile={(e) => void onFile(e, "poster")} />

          <Field label="Ação do botão">
            {(id) => (
              <Select id={id} value={form.ctaKind} onChange={(e) => setForm({ ...form, ctaKind: e.target.value as ReelCtaKind, ctaTarget: "" })}>
                {REEL_CTA_KINDS.filter((k) => k !== "benefit" || form.partnerId).map((k) => (
                  <option key={k} value={k}>
                    {REEL_CTA_LABEL[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Texto do botão (opcional)" hint={`Vazio usa "${REEL_CTA_LABEL[form.ctaKind]}".`}>
            {(id, describedBy) => <Input id={id} aria-describedby={describedBy} maxLength={28} value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} />}
          </Field>
          {form.ctaKind === "benefit" && (
            <Field label="Benefício do parceiro" className="sm:col-span-2" hint={partnerBenefits.length === 0 ? "Este parceiro ainda não tem benefícios no catálogo." : undefined}>
              {(id, describedBy) => (
                <Select id={id} aria-describedby={describedBy} required value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })}>
                  <option value="" disabled>
                    Escolha o benefício
                  </option>
                  {partnerBenefits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} · {b.discountLabel}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {form.ctaKind === "external" && (
            <Field label="Link da loja (https://)" className="sm:col-span-2">
              {(id) => <Input id={id} type="url" required pattern="https://.*" value={form.ctaTarget} onChange={(e) => setForm({ ...form, ctaTarget: e.target.value })} placeholder="https://" />}
            </Field>
          )}
          <Field label="Ordem no feed" hint="Menor aparece primeiro.">
            {(id, describedBy) => <Input id={id} aria-describedby={describedBy} type="number" min={0} max={9999} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />}
          </Field>
          <Checkbox className="self-end" label="Ativo no feed" checked={form.active} onChange={(active) => setForm({ ...form, active })} />

          {error && (
            <Notice tone="error" className="sm:col-span-2">
              {error}
            </Notice>
          )}
        </form>
      </Sheet>
    </section>
  );
}

function reelToForm(reel: PartnerReel): ReelForm {
  return {
    partnerId: reel.partnerId,
    brandName: reel.partnerId ? "" : reel.partnerName,
    collection: reel.collection,
    title: reel.title,
    caption: reel.caption,
    videoUrl: reel.videoUrl,
    posterUrl: reel.posterUrl,
    ctaKind: reel.ctaKind,
    ctaLabel: reel.ctaLabel,
    ctaTarget: reel.ctaTarget,
    sortOrder: String(reel.sortOrder),
    active: reel.active,
  };
}

function MediaField({
  label,
  value,
  busy,
  accept,
  onUrl,
  onFile,
}: {
  label: string;
  value: string;
  busy: boolean;
  accept: string;
  onUrl: (url: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Field label={label} hint="Envie o arquivo ou cole uma URL https.">
        {(id, describedBy) => <Input id={id} aria-describedby={describedBy} value={value} onChange={(e) => onUrl(e.target.value)} placeholder="https://" />}
      </Field>
      <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-line has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
        <IconUpload size={16} />
        {busy ? "Enviando…" : "Enviar arquivo"}
        <input type="file" accept={accept} className="sr-only" onChange={onFile} disabled={busy} />
      </label>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl glass p-4 sm:p-5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-[26px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{value}</dd>
    </div>
  );
}
