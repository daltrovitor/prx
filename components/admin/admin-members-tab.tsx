// Hello World
"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, EmptyState, Field, Input, Notice, Select, Sheet, Tag, formatBRL } from "@/components/app/ui";
import { IconSearch } from "@/components/icons/prx-icons";
import type { SystemVoucher } from "@/lib/pass-store";

export type MemberRole = "user" | "partner" | "staff" | "admin";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  prxScore: number;
  prxLevel: number;
  walletBalance: number;
  createdAt: string;
  vouchersCount: number;
  vouchers: SystemVoucher[];
}

interface AdminMembersTabProps {
  users: AdminUser[];
  onRefresh: () => Promise<void>;
}

const ROLE_LABEL: Record<MemberRole, string> = { user: "Membro", partner: "Parceiro", staff: "Equipe", admin: "Admin" };

interface ApiResult {
  success?: boolean;
  error?: string;
}

export function AdminMembersTab({ users, onRefresh }: AdminMembersTabProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [inspecting, setInspecting] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ level: 1, score: 0, balance: 0, role: "user" as MemberRole });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  function openEdit(user: AdminUser) {
    setEditing(user);
    setForm({ level: user.prxLevel, score: user.prxScore, balance: user.walletBalance, role: user.role });
    setFeedback(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, prxLevel: form.level, prxScore: form.score, walletBalance: form.balance, role: form.role }),
      });
      const data = (await res.json()) as ApiResult;
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, text: data.error || "Não foi possível atualizar o membro." });
        return;
      }
      setFeedback({ ok: true, text: `${editing.name} atualizado: nível ${form.level}, ${form.score.toLocaleString("pt-BR")} XP.` });
      setEditing(null);
      await onRefresh();
    } catch {
      setFeedback({ ok: false, text: "Sem conexão com o servidor." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleVoucher(voucher: SystemVoucher) {
    const status = voucher.status === "valid" ? "used" : "valid";
    const res = await fetch("/api/admin/vouchers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: voucher.id, status }),
    });
    if (!res.ok) return;
    setInspecting((prev) => (prev ? { ...prev, vouchers: prev.vouchers.map((v) => (v.id === voucher.id ? { ...v, status } : v)) } : prev));
    await onRefresh();
  }

  return (
    <section aria-labelledby="members-title" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="members-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Membros
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Níveis, XP, papel de acesso e vouchers de cada conta.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="member-search" className="sr-only">
            Buscar membro
          </label>
          <Input id="member-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou e-mail" className="pl-11" />
        </div>
      </div>

      {feedback && <Notice tone={feedback.ok ? "success" : "error"}>{feedback.text}</Notice>}

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum membro encontrado" body={query ? "Tente outro nome ou e-mail." : "Os cadastros aparecem aqui."} />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[13px] text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Membro</th>
                <th scope="col" className="px-4 py-3 font-medium">Papel</th>
                <th scope="col" className="px-4 py-3 font-medium">Nível</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">XP</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Carteira</th>
                <th scope="col" className="px-4 py-3 font-medium">Vouchers</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{user.name}</p>
                    <p className="text-[13px] text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Tag tone={user.role === "admin" ? "ink" : user.role === "partner" ? "accent" : "neutral"}>{ROLE_LABEL[user.role] ?? user.role}</Tag>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink">{user.prxLevel}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{user.prxScore.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{formatBRL(Number(user.walletBalance || 0))}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setInspecting(user)}>
                      {(() => {
                        const count = user.vouchersCount || user.vouchers?.length || 0;
                        return `${count} ${count === 1 ? "resgate" : "resgates"}`;
                      })()}
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(user)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Editar membro"
        description={editing ? `${editing.name} · ${editing.email}` : undefined}
        footer={
          <Button block type="submit" form="member-form" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        }
      >
        <form id="member-form" onSubmit={save} className="grid gap-5 sm:grid-cols-2">
          <Field label="Nível" hint="Muda os benefícios liberados na hora.">
            {(id, describedBy) => (
              <Select id={id} aria-describedby={describedBy} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Nível {lvl}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="XP (PRX Score)">
            {(id) => <Input id={id} type="number" min={0} step={50} value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} />}
          </Field>
          <Field label="Saldo em carteira (R$)">
            {(id) => <Input id={id} type="number" min={0} step={0.5} value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} />}
          </Field>
          <Field label="Papel de acesso">
            {(id) => (
              <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>
                <option value="user">Membro</option>
                <option value="partner">Parceiro credenciado</option>
                <option value="admin">Administrador</option>
              </Select>
            )}
          </Field>
        </form>
      </Sheet>

      <Sheet open={Boolean(inspecting)} onClose={() => setInspecting(null)} title={inspecting ? `Vouchers de ${inspecting.name}` : "Vouchers"} description={inspecting?.email}>
        {inspecting && (!inspecting.vouchers || inspecting.vouchers.length === 0) ? (
          <EmptyState title="Nenhum resgate" body="Este membro ainda não gerou vouchers." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {inspecting?.vouchers.map((voucher) => (
              <li key={voucher.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink">{voucher.code}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {voucher.partnerName} · {voucher.benefitTitle || voucher.discountLabel} · {voucher.redeemedAt}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag tone={voucher.status === "valid" ? "success" : "neutral"}>{voucher.status === "valid" ? "Válido" : "Usado"}</Tag>
                  <Button variant="secondary" size="sm" onClick={() => toggleVoucher(voucher)}>
                    {voucher.status === "valid" ? "Marcar usado" : "Reativar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </section>
  );
}
