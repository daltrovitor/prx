// Hello World
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button, Sheet } from "@/components/app/ui";
import { useConfirmToast } from "@/components/ui/confirm-toast";
import { dismissInstallCard, promptInstall, usePwaInstall, type InstallBrowser, type InstallPlatform } from "@/lib/pwa-install";

const DEVICE: Record<InstallPlatform, string> = {
  android: "Android",
  windows: "Windows",
  ios: "iPhone",
  macos: "Mac",
  linux: "computador",
  other: "dispositivo",
};

/** Passo a passo quando o navegador não oferece o prompt nativo (Firefox, Safari ou prompt já usado). */
function manualSteps(platform: InstallPlatform, browser: InstallBrowser): { title: string; steps: string[] } {
  if (platform === "android") {
    if (browser === "samsung")
      return {
        title: "Adicionar à tela inicial",
        steps: ["Toque no menu ☰ no canto inferior.", "Escolha “Adicionar página a” e depois “Tela inicial”.", "Confirme em “Adicionar”."],
      };
    if (browser === "firefox")
      return {
        title: "Adicionar à tela inicial",
        steps: ["Toque no menu ⋮ ao lado da barra de endereço.", "Escolha “Instalar” (ou “Adicionar à tela inicial”).", "Confirme em “Adicionar”."],
      };
    return {
      title: "Adicionar à tela inicial",
      steps: ["Toque no menu ⋮ no canto superior direito.", "Escolha “Instalar app” ou “Adicionar à tela inicial”.", "Confirme em “Instalar”."],
    };
  }
  if (platform === "windows") {
    if (browser === "firefox")
      return {
        title: "Instalar no Windows",
        steps: [
          "O Firefox não instala apps da web no Windows.",
          "Abra o PRX no Microsoft Edge ou no Google Chrome.",
          "Clique no ícone de instalar na barra de endereço e confirme.",
        ],
      };
    if (browser === "edge")
      return {
        title: "Instalar no Windows",
        steps: ["Clique em ⋯ (Configurações e mais) no canto superior direito.", "Vá em “Aplicativos” e depois “Instalar o PRX”.", "Confirme em “Instalar”."],
      };
    return {
      title: "Instalar no Windows",
      steps: [
        "Clique no ícone de instalar no fim da barra de endereço.",
        "Ou abra o menu ⋮ → “Transmitir, salvar e compartilhar” → “Instalar página como app”.",
        "Confirme em “Instalar”.",
      ],
    };
  }
  if (platform === "ios")
    return {
      title: "Adicionar à Tela de Início",
      steps: ["Toque em Compartilhar (quadrado com seta para cima).", "Role e escolha “Adicionar à Tela de Início”.", "Confirme em “Adicionar”."],
    };
  if (platform === "macos" && browser === "safari") return { title: "Adicionar ao Dock", steps: ["No menu Arquivo, escolha “Adicionar ao Dock”.", "Confirme em “Adicionar”."] };
  return { title: "Instalar o PRX", steps: ["Clique no ícone de instalar na barra de endereço do navegador.", "Confirme em “Instalar”."] };
}

const PIN_STEPS = [
  "Clique com o botão direito no ícone do PRX na Barra de Tarefas e escolha “Fixar na barra de tarefas”.",
  "No Menu Iniciar, procure “PRX”, clique com o botão direito e escolha “Fixar em Iniciar”.",
];

/**
 * Convite para instalar o PRX (Android e Windows, com passo a passo para os
 * demais). Some quando o app já está instalado ou quando o membro dispensa.
 */
export function PwaInstallCard() {
  const { visible, canPrompt, platform, browser } = usePwaInstall();
  const { showToast } = useConfirmToast();
  const [sheet, setSheet] = useState<"manual" | "pin" | null>(null);
  const [busy, setBusy] = useState(false);

  // Depois de instalar o card some, mas a janela de "fixar na Barra de Tarefas" continua aberta.
  if (!visible && sheet === null) return null;

  const mobile = platform === "android" || platform === "ios";
  const cta = mobile ? (platform === "ios" ? "Adicionar à Tela de Início" : "Adicionar à Tela Inicial") : "Instalar App";
  const manual = manualSteps(platform, browser);

  async function install() {
    if (!canPrompt) return setSheet("manual");
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "accepted") {
      if (platform === "windows") setSheet("pin");
      else showToast("success", "PRX instalado. Abra pela tela inicial.");
    } else if (outcome === "unavailable") {
      setSheet("manual");
    }
  }

  return (
    <>
      {visible && (
        <motion.section
          aria-labelledby="pwa-install-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="glass flex flex-col gap-4 rounded-[24px] p-4 sm:p-5"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            {/* Ícone oficial do app, o mesmo da tela inicial. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/prx-icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[14px] shadow-[0_4px_12px_-6px_rgba(22,12,52,0.35)]" />
            <div className="min-w-0">
              <h2 id="pwa-install-title" className="text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                Instale o PRX no seu dispositivo
              </h2>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">Acesso instantâneo e offline no seu {DEVICE[platform]}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pl-[62px]">
            <Button size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => void install()} disabled={busy}>
              {busy ? "Abrindo…" : cta}
            </Button>
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => dismissInstallCard("dismissed")}>
              Agora não
            </Button>
            <button
              type="button"
              onClick={() => dismissInstallCard("installed")}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Já instalado
            </button>
          </div>
        </motion.section>
      )}

      <Sheet open={sheet === "manual"} onClose={() => setSheet(null)} title={manual.title} description={`No seu ${DEVICE[platform]}, leva menos de um minuto.`}>
        <ol className="space-y-3">
          {manual.steps.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-2xl bg-surface p-4 text-[15px] leading-relaxed text-ink">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {platform === "windows" && <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">Depois de instalar: {PIN_STEPS[0]}</p>}
      </Sheet>

      <Sheet open={sheet === "pin"} onClose={() => setSheet(null)} title="Pronto! O PRX está instalado" description="Deixe o app a um clique no Windows.">
        <ol className="space-y-3">
          {PIN_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-2xl bg-surface p-4 text-[15px] leading-relaxed text-ink">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}
