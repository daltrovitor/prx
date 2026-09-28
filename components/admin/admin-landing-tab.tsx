// Hello World
"use client";

import { useState } from "react";
import { Notice, Segmented } from "@/components/app/ui";
import { IconExternal } from "@/components/icons/prx-icons";
import { cn } from "@/lib/utils";

type Device = "mobile" | "tablet" | "desktop";

const WIDTH: Record<Device, string> = {
  mobile: "max-w-[390px]",
  tablet: "max-w-[820px]",
  desktop: "max-w-none",
};

/**
 * Prévia da nova landing (estilo Revolut) para teste e aprovação. A página
 * inicial atual continua no ar; esta versão só abre para administradores.
 */
export function AdminLandingTab() {
  const [device, setDevice] = useState<Device>("desktop");
  return (
    <section aria-labelledby="landing-preview-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="landing-preview-title" className="text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
            Nova landing · prévia
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            Três momentos guiados pela rolagem: céu azul com &ldquo;Banking &amp; Beyond&rdquo;, cartões que se reorganizam e &ldquo;Your salary, reimagined&rdquo;. Role dentro
            da janela para testar. A página inicial atual segue no ar até a aprovação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tamanho da prévia"
            value={device}
            onChange={setDevice}
            options={[
              { value: "mobile", label: "Celular" },
              { value: "tablet", label: "Tablet" },
              { value: "desktop", label: "Desktop" },
            ]}
          />
          <a
            href="/nova-landing"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-chip inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-ink"
          >
            Abrir em nova aba
            <IconExternal size={16} />
          </a>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-[28px] p-2 sm:p-3">
        <div className={cn("mx-auto overflow-hidden rounded-[20px] bg-white transition-[max-width] duration-300", WIDTH[device])}>
          <iframe src="/nova-landing" title="Prévia da nova landing" className="block h-[78dvh] min-h-[560px] w-full border-0" loading="lazy" />
        </div>
      </div>
      <Notice>Só administradores conseguem abrir esta página; para visitantes o endereço responde como inexistente.</Notice>
    </section>
  );
}
