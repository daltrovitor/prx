// Hello World
"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@/hooks/use-auth";
import { useAppNav } from "@/components/app/app-nav";
import { useBank, useHiddenBalance } from "@/components/app/use-prx-stores";
import { SandboxNotice, TransactionRow } from "@/components/app/shared";
import { CardVisual } from "@/components/app/bank/card-visual";
import { QrScanner } from "@/components/app/qr-scanner";
import { CopyButton, useQrDataUrl } from "@/components/app/pass/voucher-sheet";
import { Button, EmptyState, Field, Input, Notice, Segmented, Select, Sheet, Tag, Textarea, formatBRL } from "@/components/app/ui";
import { IconCheck, IconEye, IconEyeOff, IconLock, IconTrash, IconUnlock } from "@/components/icons/prx-icons";
import {
  BANK_MODE,
  BankError,
  PHYSICAL_CARD_STAGES,
  addCharge,
  createRandomKey,
  filterTransactions,
  physicalCardStageIndex,
  registerPixKey,
  removePixKey,
  requestPhysicalCard,
  sendPix,
  setCardLocked,
  simulateChargePaid,
  summarize,
  type BankState,
  type StatementFilter,
  type StatementPeriod,
} from "@/lib/prx/bank";
import { PIX_KEY_LABEL, buildPixPayload, detectPixKeyType, isValidCpf, parsePixPayload, type PixKeyType } from "@/lib/prx/pix";
import { cn } from "@/lib/utils";
import Image from "next/image";

type BankSection = "extrato" | "pix" | "cobrar" | "cartoes" | "chaves";
const SECTIONS: ReadonlyArray<BankSection> = ["extrato", "pix", "cobrar", "cartoes", "chaves"];

/** Converte "1.234,56" ou "1234.56" em número. */
function parseMoney(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

type Updater = (updater: (current: BankState) => BankState) => void;

export function BankScreen({ member }: { member: User }) {
  const { sub, go } = useAppNav();
  const section: BankSection = SECTIONS.includes(sub as BankSection) ? (sub as BankSection) : "extrato";
  const [bank, setBank] = useBank(member.id);
  const [hidden, toggleHidden] = useHiddenBalance();

  const last30 = useMemo(() => summarize(filterTransactions(bank.transactions, 30, "all")), [bank.transactions]);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-[-0.045em] text-ink sm:text-6xl">PRX BANK</h1>
        {BANK_MODE === "sandbox" && (
          <SandboxNotice>
            Modo demonstração: nenhum dinheiro real é movimentado. A conta digital, o Pix e os cartões passam a operar de verdade
            quando a integração com o banco parceiro (BaaS) for ativada.
          </SandboxNotice>
        )}
      </header>

      <section aria-label="Saldo" className="grid gap-px border border-line bg-line md:grid-cols-12">
        <div className="flex flex-col justify-between gap-8 bg-ink p-6 text-white sm:p-8 md:col-span-7">
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-medium text-white/70">Saldo disponível</p>
            <button
              type="button"
              onClick={toggleHidden}
              aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
              aria-pressed={hidden}
              className="-mr-3 -mt-3 flex h-12 w-12 cursor-pointer items-center justify-center text-white/80 hover:text-white"
            >
              {hidden ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
          <p className="font-display text-5xl font-semibold leading-none tracking-[-0.05em] tabular-nums sm:text-6xl">
            {hidden ? "R$ ••••" : formatBRL(bank.balance)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="border-white/20 bg-transparent text-white hover:border-white" onClick={() => go("bank", "pix")}>
              Enviar Pix
            </Button>
            <Button variant="secondary" size="sm" className="border-white/20 bg-transparent text-white hover:border-white" onClick={() => go("bank", "cobrar")}>
              Cobrar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line md:col-span-5 md:grid-cols-1">
          <div className="min-w-0 bg-white p-4 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Entradas (30d)</p>
            <p className="mt-2 break-words font-display text-xl font-semibold tracking-[-0.03em] text-primary tabular-nums sm:text-3xl">
              {hidden ? "••••" : formatBRL(last30.income)}
            </p>
          </div>
          <div className="min-w-0 bg-white p-4 sm:p-6">
            <p className="text-[13px] text-muted-foreground">Saídas (30d)</p>
            <p className="mt-2 break-words font-display text-xl font-semibold tracking-[-0.03em] text-ink tabular-nums sm:text-3xl">
              {hidden ? "••••" : formatBRL(last30.outcome)}
            </p>
          </div>
        </div>
      </section>

      <Segmented
        label="Seções do PRX BANK"
        value={section}
        onChange={(value) => go("bank", value === "extrato" ? null : value)}
        options={[
          { value: "extrato", label: "Extrato" },
          { value: "pix", label: "Pix" },
          { value: "cobrar", label: "Cobrar" },
          { value: "cartoes", label: "Cartões" },
          { value: "chaves", label: "Chaves Pix", count: bank.pixKeys.length },
        ]}
      />

      {section === "extrato" && <StatementPanel bank={bank} hidden={hidden} />}
      {section === "pix" && <PixPanel bank={bank} setBank={setBank} />}
      {section === "cobrar" && <ChargePanel bank={bank} setBank={setBank} member={member} onCreateKey={() => go("bank", "chaves")} />}
      {section === "cartoes" && <CardsPanel bank={bank} setBank={setBank} holder={member.name || "Membro PRX"} />}
      {section === "chaves" && <KeysPanel bank={bank} setBank={setBank} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function StatementPanel({ bank, hidden }: { bank: BankState; hidden: boolean }) {
  const [period, setPeriod] = useState<StatementPeriod>(30);
  const [filter, setFilter] = useState<StatementFilter>("all");
  const list = useMemo(() => filterTransactions(bank.transactions, period, filter), [bank.transactions, period, filter]);
  const totals = summarize(list);

  return (
    <section aria-label="Extrato" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Período" className="flex gap-2">
          {([7, 30, 90] as const).map((p) => (
            <FilterChip key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p} dias
            </FilterChip>
          ))}
        </div>
        <div role="group" aria-label="Tipo de movimentação" className="flex gap-2">
          {(
            [
              ["all", "Tudo"],
              ["in", "Entradas"],
              ["out", "Saídas"],
            ] as const
          ).map(([value, label]) => (
            <FilterChip key={value} active={filter === value} onClick={() => setFilter(value)}>
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground">
        {list.length} {list.length === 1 ? "movimentação" : "movimentações"} ·{" "}
        <span className="text-primary">+{hidden ? "••••" : formatBRL(totals.income)}</span> ·{" "}
        <span className="text-ink">−{hidden ? "••••" : formatBRL(totals.outcome)}</span>
      </p>

      {list.length === 0 ? (
        <EmptyState title="Sem movimentações no período" body="Mude o período ou o tipo para ver mais." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {list.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} hidden={hidden} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-10 cursor-pointer rounded-[2px] border px-3.5 text-sm transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line text-muted-foreground hover:border-ink hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------ */

type PixMethod = "chave" | "copia" | "qr";

interface PixDraft {
  key: string;
  recipient: string;
  amount: number;
  description: string;
  fixedAmount: boolean;
}

function PixPanel({ bank, setBank }: { bank: BankState; setBank: Updater }) {
  const [method, setMethod] = useState<PixMethod>("chave");
  const [key, setKey] = useState("");
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [pasted, setPasted] = useState("");
  const [draft, setDraft] = useState<PixDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PixDraft | null>(null);

  const keyType = detectPixKeyType(key);

  function reviewFromKey(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!keyType) {
      setError("Chave inválida. Use CPF, CNPJ, e-mail, celular com DDD ou chave aleatória.");
      return;
    }
    const amount = parseMoney(amountText);
    if (!(amount > 0)) {
      setError("Informe o valor do Pix.");
      return;
    }
    setDraft({ key: key.trim(), recipient: `${PIX_KEY_LABEL[keyType]} ${key.trim()}`, amount, description, fixedAmount: false });
  }

  function reviewFromPayload(raw: string) {
    setError(null);
    const parsed = parsePixPayload(raw);
    if (!parsed) {
      setError("Esse código não é um Pix Copia e Cola válido.");
      return;
    }
    if (!parsed.valid) {
      setError("O código Pix está incompleto ou foi alterado (falha na verificação). Peça um novo código.");
      return;
    }
    setDraft({
      key: parsed.key,
      recipient: parsed.merchantName || parsed.key,
      amount: parsed.amount ?? 0,
      description: "",
      fixedAmount: Boolean(parsed.amount),
    });
  }

  function confirm() {
    if (!draft) return;
    try {
      setBank((state) => sendPix(state, { key: draft.key, amount: draft.amount, recipient: draft.recipient, description: draft.description }));
      setReceipt(draft);
      setDraft(null);
      setKey("");
      setAmountText("");
      setDescription("");
      setPasted("");
    } catch (err) {
      setError(err instanceof BankError ? err.message : "Não foi possível concluir o Pix.");
      setDraft(null);
    }
  }

  return (
    <section aria-label="Enviar Pix" className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <Segmented
          label="Forma de pagamento Pix"
          value={method}
          onChange={(value) => {
            setMethod(value);
            setError(null);
          }}
          options={[
            { value: "chave", label: "Chave" },
            { value: "copia", label: "Copia e cola" },
            { value: "qr", label: "Ler QR Code" },
          ]}
        />

        {method === "chave" && (
          <form onSubmit={reviewFromKey} className="space-y-5">
            <Field label="Chave Pix" hint={keyType ? `Tipo identificado: ${PIX_KEY_LABEL[keyType]}` : "CPF, CNPJ, e-mail, celular ou chave aleatória."}>
              {(id, describedBy) => (
                <Input id={id} aria-describedby={describedBy} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
              )}
            </Field>
            <Field label="Valor" hint={`Disponível: ${formatBRL(bank.balance)}`}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className="font-mono text-lg"
                />
              )}
            </Field>
            <Field label="Mensagem (opcional)">
              {(id) => <Input id={id} value={description} maxLength={60} onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            <Button type="submit" block>
              Revisar Pix
            </Button>
          </form>
        )}

        {method === "copia" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              reviewFromPayload(pasted);
            }}
            className="space-y-5"
          >
            <Field label="Código Pix Copia e Cola">
              {(id) => (
                <Textarea id={id} value={pasted} onChange={(e) => setPasted(e.target.value)} className="font-mono text-sm" spellCheck={false} placeholder="00020126…" />
              )}
            </Field>
            <Button type="submit" block disabled={!pasted.trim()}>
              Ler código
            </Button>
          </form>
        )}

        {method === "qr" && <QrScanner onScan={reviewFromPayload} active={!draft} />}

        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <aside className="space-y-4 lg:col-span-5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">Pix recentes</h2>
        <ul className="divide-y divide-line border-y border-line">
          {bank.transactions
            .filter((t) => t.kind === "pix_out")
            .slice(0, 4)
            .map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
        </ul>
      </aside>

      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Confirmar Pix"
        footer={
          <Button block onClick={confirm} disabled={!draft || !(draft.amount > 0)}>
            Enviar {draft ? formatBRL(draft.amount) : ""}
          </Button>
        }
      >
        {draft && (
          <dl className="divide-y divide-line border-y border-line text-[15px]">
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-muted-foreground">Para</dt>
              <dd className="text-right font-medium text-ink">{draft.recipient}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-muted-foreground">Chave</dt>
              <dd className="break-all text-right font-mono text-sm text-ink">{draft.key}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <dt className="text-muted-foreground">Valor</dt>
              <dd>
                {draft.fixedAmount ? (
                  <span className="font-display text-2xl font-semibold text-ink">{formatBRL(draft.amount)}</span>
                ) : draft.amount > 0 ? (
                  <span className="font-display text-2xl font-semibold text-ink">{formatBRL(draft.amount)}</span>
                ) : (
                  <Input
                    aria-label="Valor do Pix"
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-36 text-right font-mono"
                    onChange={(e) => setDraft({ ...draft, amount: parseMoney(e.target.value) })}
                  />
                )}
              </dd>
            </div>
            {draft.description && (
              <div className="flex justify-between gap-4 py-3.5">
                <dt className="text-muted-foreground">Mensagem</dt>
                <dd className="text-right text-ink">{draft.description}</dd>
              </div>
            )}
          </dl>
        )}
      </Sheet>

      <Sheet open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Pix enviado" footer={<Button block variant="ink" onClick={() => setReceipt(null)}>Fechar</Button>}>
        {receipt && (
          <div className="space-y-4">
            <span className="flex h-12 w-12 items-center justify-center bg-primary text-white">
              <IconCheck size={24} />
            </span>
            <p className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink">{formatBRL(receipt.amount)}</p>
            <p className="text-[15px] text-muted-foreground">
              Para {receipt.recipient}
              {BANK_MODE === "sandbox" ? " · simulação, sem movimentação real." : "."}
            </p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function ChargePanel({ bank, setBank, member, onCreateKey }: { bank: BankState; setBank: Updater; member: User; onCreateKey: () => void }) {
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const current = bank.charges[0];
  const qr = useQrDataUrl(current?.payload);
  const receivingKey = bank.pixKeys[0];

  function create(event: FormEvent) {
    event.preventDefault();
    if (!receivingKey) return;
    const amount = parseMoney(amountText);
    const payload = buildPixPayload({
      key: receivingKey.value,
      merchantName: member.name || "PRX",
      merchantCity: "Sao Paulo",
      amount: amount > 0 ? amount : undefined,
      description: description || undefined,
    });
    setBank((state) => addCharge(state, { amount: amount > 0 ? amount : undefined, description: description || undefined, payload }));
  }

  if (!receivingKey) {
    return (
      <EmptyState
        title="Cadastre uma chave Pix para cobrar"
        body="A cobrança usa a sua chave para gerar o QR Code e o código Copia e Cola."
        action={<Button onClick={onCreateKey}>Cadastrar chave</Button>}
      />
    );
  }

  return (
    <section aria-label="Cobrar com Pix" className="grid gap-10 lg:grid-cols-12">
      <form onSubmit={create} className="space-y-5 lg:col-span-5">
        <Field label="Valor (opcional)" hint="Sem valor, quem paga escolhe quanto enviar.">
          {(id, describedBy) => (
            <Input id={id} aria-describedby={describedBy} inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="font-mono text-lg" />
          )}
        </Field>
        <Field label="Descrição (opcional)">
          {(id) => <Input id={id} value={description} maxLength={40} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <p className="text-[13px] text-muted-foreground">
          Recebendo na chave {PIX_KEY_LABEL[receivingKey.type]} <span className="font-mono text-ink">{receivingKey.value}</span>
        </p>
        <Button type="submit" block>
          Gerar QR Code
        </Button>
      </form>

      <div className="lg:col-span-7">
        {current ? (
          <div className="grid gap-6 border border-line p-6 sm:grid-cols-[220px_1fr]">
            <div className="border border-line p-2">
              {qr ? <Image src={qr} alt="QR Code da cobrança Pix" width={280} height={280} unoptimized className="h-auto w-full" /> : <div className="aspect-square bg-surface" />}
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">{current.amount ? formatBRL(current.amount) : "Valor livre"}</p>
                  {current.paid ? <Tag tone="success">Recebido</Tag> : <Tag>Aguardando</Tag>}
                </div>
                {current.description && <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>}
              </div>
              <p className="break-all font-mono text-[12px] leading-relaxed text-muted-foreground">{current.payload}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={current.payload} label="Copiar código" />
                {BANK_MODE === "sandbox" && !current.paid && (
                  <Button variant="ghost" size="sm" onClick={() => setBank((state) => simulateChargePaid(state, current.id))}>
                    Simular pagamento
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="Nenhuma cobrança criada" body="Preencha ao lado para gerar um QR Code de cobrança." />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function CardsPanel({ bank, setBank, holder }: { bank: BankState; setBank: Updater; holder: string }) {
  const [revealed, setRevealed] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [address, setAddress] = useState({ cep: "", street: "", number: "", complement: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const card = bank.virtualCard;
  const stageIndex = bank.physicalCard ? physicalCardStageIndex(bank.physicalCard) : -1;

  function submitRequest(event: FormEvent) {
    event.preventDefault();
    const cepDigits = address.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8 || !address.street.trim() || !address.number.trim() || !address.city.trim()) {
      setError("Preencha CEP, endereço, número e cidade.");
      return;
    }
    try {
      const full = `${address.street.trim()}, ${address.number.trim()}${address.complement ? ` — ${address.complement.trim()}` : ""} · ${address.city.trim()} · CEP ${cepDigits.replace(/(\d{5})(\d{3})/, "$1-$2")}`;
      setBank((state) => requestPhysicalCard(state, full));
      setRequestOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof BankError ? err.message : "Não foi possível solicitar o cartão.");
    }
  }

  return (
    <section aria-label="Cartões" className="grid gap-12 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">Cartão virtual</h2>
        <CardVisual card={card} holder={holder} revealed={revealed && !card.locked} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRevealed((v) => !v)} disabled={card.locked} aria-pressed={revealed}>
            {revealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            {revealed ? "Ocultar dados" : "Ver dados"}
          </Button>
          {revealed && !card.locked && <CopyButton value={card.number} label="Copiar número" />}
          <Button
            variant={card.locked ? "primary" : "danger"}
            size="sm"
            onClick={() => {
              setRevealed(false);
              setBank((state) => setCardLocked(state, !card.locked));
            }}
          >
            {card.locked ? <IconUnlock size={16} /> : <IconLock size={16} />}
            {card.locked ? "Desbloquear" : "Bloquear"}
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {card.locked
            ? "Cartão bloqueado: novas compras são recusadas até você desbloquear."
            : "Use em compras online. O bloqueio é instantâneo e pode ser desfeito a qualquer momento."}
        </p>
      </div>

      <div className="space-y-6 lg:col-span-6">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">Cartão físico</h2>
        {bank.physicalCard ? (
          <div className="space-y-6">
            <ol className="space-y-0">
              {PHYSICAL_CARD_STAGES.map((stage, index) => {
                const done = index <= stageIndex;
                const date = new Date(new Date(bank.physicalCard!.requestedAt).getTime() + stage.afterDays * 86_400_000);
                return (
                  <li key={stage.stage} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < PHYSICAL_CARD_STAGES.length - 1 && (
                      <span aria-hidden className={cn("absolute left-[7px] top-5 h-[calc(100%-12px)] w-px", index < stageIndex ? "bg-ink" : "bg-line")} />
                    )}
                    <span aria-hidden className={cn("mt-1 h-[15px] w-[15px] shrink-0 border-2", done ? "border-ink bg-ink" : "border-line bg-white")} />
                    <div>
                      <p className={cn("text-[15px] font-medium", done ? "text-ink" : "text-muted-foreground")}>{stage.label}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {done ? "Concluído" : "Previsão"} · {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <dl className="space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rastreio</dt>
                <dd className="font-mono text-ink">{bank.physicalCard.trackingCode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Entrega</dt>
                <dd className="text-right text-ink">{bank.physicalCard.address}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="space-y-4 border border-line p-6">
            <p className="text-[15px] text-ink">Peça o cartão físico sem anuidade e acompanhe a entrega por aqui.</p>
            <Button onClick={() => setRequestOpen(true)}>Solicitar cartão físico</Button>
          </div>
        )}
      </div>

      <Sheet
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Endereço de entrega"
        footer={
          <Button block type="submit" form="physical-card-form">
            Confirmar pedido
          </Button>
        }
      >
        <form id="physical-card-form" onSubmit={submitRequest} className="grid gap-4 sm:grid-cols-6">
          <Field label="CEP" className="sm:col-span-2">
            {(id) => <Input id={id} inputMode="numeric" autoComplete="postal-code" value={address.cep} onChange={(e) => setAddress({ ...address, cep: e.target.value })} />}
          </Field>
          <Field label="Endereço" className="sm:col-span-4">
            {(id) => <Input id={id} autoComplete="address-line1" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />}
          </Field>
          <Field label="Número" className="sm:col-span-2">
            {(id) => <Input id={id} value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />}
          </Field>
          <Field label="Complemento" className="sm:col-span-4">
            {(id) => <Input id={id} autoComplete="address-line2" value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />}
          </Field>
          <Field label="Cidade / UF" className="sm:col-span-6">
            {(id) => <Input id={id} autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />}
          </Field>
          {error && <Notice tone="error" className="sm:col-span-6">{error}</Notice>}
        </form>
      </Sheet>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function KeysPanel({ bank, setBank }: { bank: BankState; setBank: Updater }) {
  const [type, setType] = useState<PixKeyType>("random");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const raw = type === "random" ? createRandomKey() : value.trim();
    const digits = raw.replace(/\D/g, "");
    if (type === "cpf" && !isValidCpf(digits)) return setError("CPF inválido.");
    if (type === "cnpj" && digits.length !== 14) return setError("CNPJ precisa de 14 dígitos.");
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return setError("E-mail inválido.");
    if (type === "phone" && (digits.length < 10 || digits.length > 13)) return setError("Celular inválido. Use DDD + número.");
    const normalized = type === "cpf" || type === "cnpj" ? digits : type === "phone" ? `+55${digits.replace(/^55/, "")}` : raw;
    try {
      setBank((state) => registerPixKey(state, type, normalized));
      setValue("");
    } catch (err) {
      setError(err instanceof BankError ? err.message : "Não foi possível cadastrar a chave.");
    }
  }

  return (
    <section aria-label="Chaves Pix" className="grid gap-10 lg:grid-cols-12">
      <form onSubmit={add} className="space-y-5 lg:col-span-5">
        <Field label="Tipo de chave">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as PixKeyType)}>
              <option value="random">Chave aleatória</option>
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="phone">Celular</option>
            </Select>
          )}
        </Field>
        {type !== "random" && (
          <Field label={PIX_KEY_LABEL[type]}>
            {(id) => (
              <Input
                id={id}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode={type === "email" ? "email" : "numeric"}
                autoComplete={type === "email" ? "email" : type === "phone" ? "tel" : "off"}
              />
            )}
          </Field>
        )}
        <Button type="submit" block>
          Cadastrar chave
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>

      <div className="lg:col-span-7">
        {bank.pixKeys.length === 0 ? (
          <EmptyState title="Nenhuma chave cadastrada" body="Com uma chave você recebe Pix e gera cobranças com QR Code." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {bank.pixKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-muted-foreground">{PIX_KEY_LABEL[k.type]}</p>
                  <p className="truncate font-mono text-[15px] text-ink">{k.value}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <CopyButton value={k.value} />
                  <Button variant="ghost" size="sm" aria-label={`Excluir chave ${k.value}`} onClick={() => setBank((state) => removePixKey(state, k.id))}>
                    <IconTrash size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
