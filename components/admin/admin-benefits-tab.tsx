// Hello World
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { PRX_CATEGORIES, type Benefit } from "@/lib/pass-data";
import { useConfirmToast } from "@/components/ui/confirm-toast";
import { Button, EmptyState, Field, Input, Notice, Select, Sheet, Tag, Textarea } from "@/components/app/ui";
import { IconImage, IconPlus, IconUpload } from "@/components/icons/prx-icons";

interface AdminBenefitsTabProps {
  benefits: Benefit[];
  onRefresh: () => Promise<void>;
}

interface BenefitForm {
  partnerName: string;
  categoryId: string;
  title: string;
  description: string;
  discountLabel: string;
  minPrxLevel: number;
  partnerLocation: string;
  partnerLogo: string;
  partnerBanner: string;
  terms: string;
}

const EMPTY_FORM: BenefitForm = {
  partnerName: "",
  categoryId: "gastronomia",
  title: "",
  description: "",
  discountLabel: "",
  minPrxLevel: 1,
  partnerLocation: "São Paulo, SP",
  partnerLogo: "",
  partnerBanner: "",
  terms: "Apresente o QR Code no balcão ao pedir a conta.",
};

interface ApiResult {
  success?: boolean;
  error?: string;
  url?: string;
}

export function AdminBenefitsTab({ benefits, onRefresh }: AdminBenefitsTabProps) {
  const { confirmDelete, showToast } = useConfirmToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [form, setForm] = useState<BenefitForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(benefit: Benefit) {
    setEditing(benefit);
    setForm({
      partnerName: benefit.partnerName,
      categoryId: benefit.categoryId,
      title: benefit.title,
      description: benefit.description,
      discountLabel: benefit.discountLabel,
      minPrxLevel: benefit.minPrxLevel,
      partnerLocation: benefit.partnerLocation,
      partnerLogo: benefit.partnerLogo || "",
      partnerBanner: benefit.partnerBanner || "",
      terms: benefit.terms?.join("\n") || "",
    });
    setError(null);
    setOpen(true);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, target: "logo" | "banner") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(target);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("type", target);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as ApiResult;
      if (!res.ok || !data.url) {
        setError(data.error || "Falha no envio da imagem.");
        return;
      }
      const url = data.url;
      setForm((prev) => (target === "logo" ? { ...prev, partnerLogo: url } : { ...prev, partnerBanner: url }));
    } catch {
      setError("Falha no envio da imagem.");
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      partnerName: form.partnerName,
      categoryId: form.categoryId,
      title: form.title,
      description: form.description,
      discountLabel: form.discountLabel,
      minPrxLevel: Number(form.minPrxLevel),
      partnerLocation: form.partnerLocation,
      partnerLogo: form.partnerLogo.trim() || undefined,
      partnerBanner: form.partnerBanner.trim() || undefined,
      terms: form.terms.split("\n").map((t) => t.trim()).filter(Boolean),
    };
    try {
      const res = await fetch("/api/admin/benefits", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = (await res.json()) as ApiResult;
      if (!res.ok || !data.success) {
        setError(data.error || "Não foi possível salvar o benefício.");
        return;
      }
      showToast("success", editing ? "Benefício atualizado." : "Benefício publicado no catálogo.");
      setOpen(false);
      await onRefresh();
    } catch {
      setError("Sem conexão com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(benefit: Benefit) {
    const confirmed = await confirmDelete({
      title: "Excluir benefício",
      message: `"${benefit.title}" sai do catálogo imediatamente. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/benefits?id=${encodeURIComponent(benefit.id)}`, { method: "DELETE" });
      const data = (await res.json()) as ApiResult;
      if (res.ok && data.success) {
        showToast("success", `"${benefit.title}" removido.`);
        await onRefresh();
      } else {
        showToast("error", data.error || "Não foi possível excluir.");
      }
    } catch {
      showToast("error", "Sem conexão com o servidor.");
    }
  }

  return (
    <section aria-labelledby="benefits-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="benefits-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Benefícios
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Ofertas dos parceiros no catálogo do PRX PASS.</p>
        </div>
        <Button onClick={openCreate}>
          <IconPlus size={18} />
          Novo benefício
        </Button>
      </div>

      {benefits.length === 0 ? (
        <EmptyState title="Catálogo vazio" body="Cadastre o primeiro parceiro com foto e regras." action={<Button onClick={openCreate}>Cadastrar benefício</Button>} />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[13px] text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Benefício</th>
                <th scope="col" className="px-4 py-3 font-medium">Categoria</th>
                <th scope="col" className="px-4 py-3 font-medium">Oferta</th>
                <th scope="col" className="px-4 py-3 font-medium">Nível mín.</th>
                <th scope="col" className="px-4 py-3 font-medium">Local</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {benefits.map((benefit) => {
                const cat = PRX_CATEGORIES.find((c) => c.id === benefit.categoryId);
                return (
                  <tr key={benefit.id} className="transition-colors hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden bg-surface">
                          {benefit.partnerLogo ? (
                            <Image src={benefit.partnerLogo} alt="" fill sizes="40px" className="object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <IconImage size={16} />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{benefit.title}</p>
                          <p className="text-[13px] text-muted-foreground">{benefit.partnerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cat?.name ?? benefit.categoryId}</td>
                    <td className="px-4 py-3">
                      <Tag tone="accent">{benefit.discountLabel}</Tag>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">{benefit.minPrxLevel}</td>
                    <td className="px-4 py-3 text-muted-foreground">{benefit.partnerLocation}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(benefit)}>
                          Editar
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => remove(benefit)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? "Editar benefício" : "Novo benefício"}
        description="As imagens vão para o bucket de benefícios do Supabase Storage."
        footer={
          <Button block type="submit" form="benefit-form" disabled={saving || uploading !== null}>
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Publicar benefício"}
          </Button>
        }
      >
        <form id="benefit-form" onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <Field label="Parceiro">
            {(id) => <Input id={id} required value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} />}
          </Field>
          <Field label="Categoria">
            {(id) => (
              <Select id={id} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                {PRX_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Título do benefício">
            {(id) => <Input id={id} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
          </Field>
          <Field label="Rótulo da oferta" hint="Ex.: 25% OFF, Leve 2 pague 1.">
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy} required value={form.discountLabel} onChange={(e) => setForm({ ...form, discountLabel: e.target.value })} />
            )}
          </Field>
          <Field label="Nível mínimo">
            {(id) => (
              <Select id={id} value={form.minPrxLevel} onChange={(e) => setForm({ ...form, minPrxLevel: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl === 1 ? "Nível 1 (todos)" : `Nível ${lvl}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Local ou alcance">
            {(id) => <Input id={id} value={form.partnerLocation} onChange={(e) => setForm({ ...form, partnerLocation: e.target.value })} />}
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          <Field label="Regras (uma por linha)" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />}
          </Field>

          <ImagePicker label="Logo (quadrado)" value={form.partnerLogo} busy={uploading === "logo"} onChange={(e) => upload(e, "logo")} square />
          <ImagePicker label="Capa (retangular)" value={form.partnerBanner} busy={uploading === "banner"} onChange={(e) => upload(e, "banner")} />

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

function ImagePicker({
  label,
  value,
  busy,
  onChange,
  square = false,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  square?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <label className="mt-1.5 flex min-h-20 cursor-pointer items-center gap-4 border border-dashed border-input p-3 transition-colors hover:border-ink">
        <span className={`relative shrink-0 overflow-hidden bg-surface ${square ? "h-14 w-14" : "h-14 w-24"}`}>
          {value ? (
            <Image src={value} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <IconImage size={18} />
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-sm text-ink">
          <IconUpload size={16} />
          {busy ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
        </span>
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={onChange} />
      </label>
    </div>
  );
}
