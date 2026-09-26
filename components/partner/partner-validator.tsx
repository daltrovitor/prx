// Hello World
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import confetti from "canvas-confetti";
import { QrScanner } from "@/components/app/qr-scanner";
import { Button, EmptyState, Field, Input, Notice, Segmented, Sheet, Tag } from "@/components/app/ui";
import { IconCheck, IconRefresh } from "@/components/icons/prx-icons";

interface PartnerVoucher {
  id: string;
  code: string;
  benefitTitle?: string;
  discountLabel?: string;
  status: "valid" | "used";
  expired?: boolean;
  redeemedAt?: string | null;
  validatedAt?: string | null;
  expiresAt?: string | null;
  userName?: string;
  terms?: string;
}

interface ValidateResponse {
  success?: boolean;
  error?: string;
  warning?: string;
  voucher?: PartnerVoucher;
  vouchers?: PartnerVoucher[];
}

type Mode = "scanner" | "manual";

async function fetchHistory(): Promise<PartnerVoucher[] | null> {
  try {
    const res = await fetch("/api/partner/validate", { cache: "no-store" });
    const data = (await res.json()) as ValidateResponse;
    return res.ok && Array.isArray(data.vouchers) ? data.vouchers : null;
  } catch {
    return null;
  }
}

/** Leitura do QR no balcão. O servidor só aceita vouchers dos benefícios deste parceiro. */
export function PartnerValidator() {
  const [mode, setMode] = useState<Mode>("scanner");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<PartnerVoucher | null>(null);
  const [justRedeemed, setJustRedeemed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [history, setHistory] = useState<PartnerVoucher[]>([]);
  const [scanKey, setScanKey] = useState(0);

  const loadHistory = useCallback(async () => {
    const list = await fetchHistory();
    if (list) setHistory(list);
  }, []);

  useEffect(() => {
    let active = true;
    fetchHistory().then((list) => {
      if (active && list) setHistory(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const lookup = useCallback(
    async (raw: string) => {
      if (!raw.trim() || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/partner/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: raw, action: "lookup" }),
        });
        const data = (await res.json()) as ValidateResponse;
        if (!res.ok || !data.success || !data.voucher) {
          setError(data.error || "Voucher não encontrado. Confira o código.");
          setScanKey((k) => k + 1);
          return;
        }
        setVoucher(data.voucher);
        setWarning(data.warning ?? null);
        setJustRedeemed(false);
      } catch {
        setError("Sem conexão com o servidor.");
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  async function redeem() {
    if (!voucher) return;
    setBusy(true);
    try {
      const res = await fetch("/api/partner/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucher.code, action: "redeem" }),
      });
      const data = (await res.json()) as ValidateResponse;
      if (!res.ok || !data.success) {
        setWarning(data.error || "Não foi possível dar baixa.");
        if (data.voucher) setVoucher(data.voucher);
        return;
      }
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: ["#6c0cf0", "#0b0b10", "#0f7b4f"] });
      }
      setVoucher(data.voucher ?? { ...voucher, status: "used" });
      setJustRedeemed(true);
      void loadHistory();
    } catch {
      setWarning("Sem conexão com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setVoucher(null);
    setWarning(null);
    setJustRedeemed(false);
    setCode("");
    setScanKey((k) => k + 1);
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    void lookup(code);
  }

  const canRedeem = voucher?.status === "valid" && !voucher.expired && !justRedeemed;
  const failed = !justRedeemed && (voucher?.status === "used" || voucher?.expired);

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section aria-labelledby="validate-title" className="space-y-6 lg:col-span-7">
        <div>
          <h2 id="validate-title" className="font-display text-3xl font-semibold leading-none tracking-[-0.04em] text-ink sm:text-4xl">
            Validar voucher
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">Leia o QR Code do app do cliente ou digite o código. Só vouchers dos seus benefícios são aceitos.</p>
        </div>

        <Segmented
          label="Forma de validação"
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError(null);
          }}
          options={[
            { value: "scanner", label: "Câmera" },
            { value: "manual", label: "Código" },
          ]}
        />

        {mode === "scanner" ? (
          <QrScanner key={scanKey} onScan={(text) => void lookup(text)} active={!voucher} />
        ) : (
          <form onSubmit={submitManual} className="space-y-4">
            <Field label="Código do voucher" hint="Formato PRX-0000-0000.">
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-lg tracking-[0.12em]"
                />
              )}
            </Field>
            <Button type="submit" block disabled={busy || !code.trim()}>
              {busy ? "Consultando…" : "Consultar voucher"}
            </Button>
          </form>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </section>

      <section aria-labelledby="history-title" className="space-y-4 lg:col-span-5">
        <div className="flex items-end justify-between gap-4">
          <h2 id="history-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Últimos vouchers
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void loadHistory()} aria-label="Atualizar histórico">
            <IconRefresh size={16} />
          </Button>
        </div>
        {history.length === 0 ? (
          <EmptyState title="Nenhum voucher ainda" body="Os resgates dos seus benefícios aparecem aqui." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {history.map((item) => (
              <li key={item.id || item.code} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink">{item.code}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {item.benefitTitle || item.discountLabel} · {item.userName}
                  </p>
                </div>
                <Tag tone={item.status === "used" ? "neutral" : "accent"}>{item.status === "used" ? "Baixado" : "Pendente"}</Tag>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={Boolean(voucher)}
        onClose={close}
        title={justRedeemed ? "Baixa registrada" : voucher?.status === "used" ? "Voucher já utilizado" : voucher?.expired ? "Voucher expirado" : "Voucher válido"}
        description={voucher?.benefitTitle}
        footer={
          canRedeem ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={redeem} disabled={busy}>
                {busy ? "Registrando…" : "Confirmar uso e dar baixa"}
              </Button>
            </div>
          ) : (
            <Button block variant="ink" onClick={close}>
              Validar outro
            </Button>
          )
        }
      >
        {voucher && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center text-white ${failed ? "bg-destructive" : "bg-success"}`}>
                <IconCheck size={24} />
              </span>
              <p className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink">{voucher.discountLabel}</p>
            </div>
            <dl className="divide-y divide-line border-y border-line text-[15px]">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Código</dt>
                <dd className="font-mono text-ink">{voucher.code}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="text-right text-ink">{voucher.userName || "Membro PRX"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Resgatado</dt>
                <dd className="text-ink">{voucher.redeemedAt}</dd>
              </div>
              {voucher.expiresAt && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Usar até</dt>
                  <dd className="text-ink">{voucher.expiresAt}</dd>
                </div>
              )}
              {voucher.validatedAt && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Baixa</dt>
                  <dd className="text-ink">{voucher.validatedAt}</dd>
                </div>
              )}
            </dl>
            {voucher.terms && <p className="text-sm text-muted-foreground">Regra: {voucher.terms}</p>}
            {warning && <Notice tone="warning">{warning}</Notice>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
