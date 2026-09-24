// Hello World
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import type { UserVoucher } from "@/lib/pass-data";
import { Button, Sheet, Tag } from "@/components/app/ui";
import { IconCheck, IconCopy } from "@/components/icons/prx-icons";

/** QR em PNG gerado no cliente, com margem branca para leitura no balcão. */
export function useQrDataUrl(payload: string | null | undefined, size = 280): string {
  const [generated, setGenerated] = useState<{ payload: string; url: string } | null>(null);
  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toDataURL(payload, { width: size, margin: 1, color: { dark: "#0b0b10", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setGenerated({ payload, url });
      })
      .catch(() => {
        if (!cancelled) setGenerated(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);
  // Só devolve o QR do payload atual; enquanto o novo é gerado, nada é exibido.
  return payload && generated?.payload === payload ? generated.url : "";
}

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function VoucherSheet({ voucher, onClose }: { voucher: UserVoucher | null; onClose: () => void }) {
  const qr = useQrDataUrl(voucher?.qrPayload);
  return (
    <Sheet open={Boolean(voucher)} onClose={onClose} title={voucher?.partnerName ?? "Voucher"} description={voucher?.benefitTitle}>
      {voucher && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{voucher.discountLabel}</span>
            {voucher.status === "valid" ? <Tag tone="success">Pronto para usar</Tag> : <Tag>Já utilizado</Tag>}
          </div>

          <div className="mx-auto w-full max-w-[280px] border border-line p-3">
            {qr ? (
              <Image src={qr} alt={`QR Code do voucher ${voucher.code}`} width={280} height={280} unoptimized className="h-auto w-full" />
            ) : (
              <div className="aspect-square w-full bg-surface" />
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-y border-line py-4">
            <div>
              <p className="text-[13px] text-muted-foreground">Código para digitar no caixa</p>
              <p className="mt-1 font-mono text-lg tracking-[0.12em] text-ink">{voucher.code}</p>
            </div>
            <CopyButton value={voucher.code} />
          </div>

          <p className="text-sm text-muted-foreground">
            {voucher.status === "valid"
              ? "Mostre este QR Code ao atendente. Depois da validação o voucher sai da sua lista de ativos."
              : `Validado no estabelecimento. Resgatado em ${voucher.redeemedAt}.`}
          </p>
          {voucher.terms && <p className="text-[13px] text-muted-foreground">Regras: {voucher.terms}</p>}
        </div>
      )}
    </Sheet>
  );
}
