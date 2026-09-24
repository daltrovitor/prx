// Hello World
"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button, Notice } from "@/components/app/ui";
import { IconRefresh, IconUpload } from "@/components/icons/prx-icons";

interface QrScannerProps {
  /** Chamado uma única vez por leitura válida. */
  onScan: (text: string) => void;
  /** Liga/desliga a câmera sem desmontar o componente. */
  active?: boolean;
}

/**
 * Leitor de QR Code pela câmera (html5-qrcode carregado sob demanda), com
 * troca de câmera e leitura de foto como alternativa quando a permissão é negada.
 * Usado no Pix do PRX BANK e no validador do portal de parceiros.
 */
export function QrScanner({ onScan, active = true }: QrScannerProps) {
  const regionId = `qr-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState<"starting" | "running" | "error" | "idle">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let handled = false;

    async function start() {
      setStatus("starting");
      setError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (disposed) return;
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode },
          { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (text) => {
            if (handled) return;
            handled = true;
            if ("vibrate" in navigator) navigator.vibrate(60);
            onScanRef.current(text);
          },
          () => undefined
        );
        if (!disposed) setStatus("running");
      } catch (err) {
        if (disposed) return;
        const denied = err instanceof Error && /NotAllowed|Permission/i.test(`${err.name} ${err.message}`);
        setError(
          denied
            ? "A câmera foi bloqueada. Libere o acesso nas configurações do navegador ou envie uma foto do QR Code."
            : "Não foi possível abrir a câmera. Tente trocar de câmera ou envie uma foto do QR Code."
        );
        setStatus("error");
      }
    }

    void start();

    return () => {
      disposed = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        const stop = scanner.isScanning ? scanner.stop() : Promise.resolve();
        stop.catch(() => undefined).finally(() => {
          try {
            scanner.clear();
          } catch {
            // já limpo
          }
        });
      }
    };
  }, [active, facingMode, regionId]);

  async function scanFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = scannerRef.current ?? new Html5Qrcode(regionId, { verbose: false });
      const text = await reader.scanFile(file, false);
      onScanRef.current(text);
    } catch {
      setError("Não encontramos um QR Code nessa imagem. Tente uma foto mais nítida.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden bg-ink">
        <div id={regionId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {status !== "running" && (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-white/70">
            {status === "starting" ? "Abrindo a câmera…" : status === "error" ? "Câmera indisponível" : "Câmera desligada"}
          </p>
        )}
        {/* Retículo de leitura em cantos retos */}
        <span aria-hidden className="pointer-events-none absolute inset-[18%] border-2 border-white/0 [box-shadow:0_0_0_9999px_rgba(11,11,16,0.35)]">
          <span className="absolute -left-0.5 -top-0.5 h-6 w-6 border-l-2 border-t-2 border-white" />
          <span className="absolute -right-0.5 -top-0.5 h-6 w-6 border-r-2 border-t-2 border-white" />
          <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 border-b-2 border-l-2 border-white" />
          <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 border-b-2 border-r-2 border-white" />
        </span>
      </div>

      {error && <Notice tone="warning">{error}</Notice>}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}>
          <IconRefresh size={16} />
          Trocar câmera
        </Button>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-line px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink">
          <IconUpload size={16} />
          Enviar foto
          <input type="file" accept="image/*" className="sr-only" onChange={scanFile} />
        </label>
      </div>
    </div>
  );
}
