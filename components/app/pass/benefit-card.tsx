// Hello World
"use client";

import { useState } from "react";
import Image from "next/image";
import type { Benefit } from "@/lib/pass-data";
import { cn } from "@/lib/utils";

interface BenefitCardProps {
  benefit: Benefit;
  redeemed: boolean;
  locked: boolean;
  onSelect: (benefit: Benefit) => void;
}

function partnerInitials(name: string): string {
  return (name || "PRX")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function BenefitCard({ benefit, redeemed, locked, onSelect }: BenefitCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = !imageFailed ? benefit.partnerBanner?.trim() || benefit.partnerLogo?.trim() : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(benefit)}
      className="group flex h-full w-full cursor-pointer flex-col border border-line bg-white text-left transition-colors hover:border-ink"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-6xl font-semibold tracking-[-0.05em] text-ink/15">
            {partnerInitials(benefit.partnerName)}
          </span>
        )}
        <span className="absolute left-0 top-0 bg-ink px-2.5 py-1.5 font-display text-[15px] font-semibold tracking-[-0.02em] text-white">
          {benefit.discountLabel}
        </span>
        {redeemed && (
          <span className="absolute bottom-0 right-0 bg-primary px-2.5 py-1 text-[12px] font-medium text-white">Voucher ativo</span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {benefit.partnerName} · {benefit.partnerLocation}
          </p>
          <p className="mt-1 text-base font-semibold leading-snug tracking-[-0.01em] text-ink">{benefit.title}</p>
        </div>
        <p className={cn("text-[13px] font-medium", locked ? "text-muted-foreground" : "text-ink")}>
          {locked ? `Libera no nível ${benefit.minPrxLevel}` : redeemed ? "Abrir voucher" : "Usar benefício"}
          {!locked && (
            <span aria-hidden className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          )}
        </p>
      </div>
    </button>
  );
}
