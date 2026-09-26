// Hello World
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PrxLoader } from "@/components/brand/prx-loader";
import { PrxLogo } from "@/components/brand/prx-logo";
import { IconRefresh } from "@/components/icons/prx-icons";

export default function OfflinePage() {
  const [introDone, setIntroDone] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [statusText, setStatusText] = useState("Aguardando sinal para reconectar automaticamente...");

  const handleRetry = (manual = true) => {
    if (retrying) return;
    setRetrying(true);
    setStatusText("Testando conexão...");

    fetch(`/manifest.json?_t=${Date.now()}`, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (res.ok || res.status < 500) {
          setIsOnline(true);
          setStatusText("Conexão restabelecida! Recarregando...");
          setTimeout(() => {
            window.location.reload();
          }, 400);
        } else {
          throw new Error("Offline");
        }
      })
      .catch(() => {
        setRetrying(false);
        setIsOnline(false);
        setStatusText(
          manual
            ? "Sem conexão no momento. Tente novamente em instantes."
            : "Aguardando sinal para reconectar automaticamente..."
        );
      });
  };

  useEffect(() => {
    const onOnline = () => handleRetry(false);
    window.addEventListener("online", onOnline);

    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine && !retrying) {
        handleRetry(false);
      }
    }, 3500);

    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [retrying]);

  return (
    <>
      {!introDone && <PrxLoader ready={true} onComplete={() => setIntroDone(true)} />}

      <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-6 py-12 transition-colors">
        <div className="w-full max-w-[480px] flex flex-col items-center text-center">
          {/* Logo PRX */}
          <div className="mb-8">
            <PrxLogo
              variant="full"
              title="PRX"
              className="h-10 sm:h-12 w-auto text-foreground drop-shadow-[0_0_20px_rgba(108,12,240,0.25)]"
            />
          </div>

          {/* Card Offline */}
          <div className="w-full bg-card border border-border rounded-2xl p-7 sm:p-8 shadow-sm">
            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider mb-5 transition-colors ${
                isOnline
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500"
                  : "bg-amber-500/10 border border-amber-500/30 text-amber-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                }`}
              />
              <span>{isOnline ? "Conectado" : "Sem Conexão"}</span>
            </div>

            {/* Ícone Wi-Fi off geométrico */}
            <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-background border border-border flex items-center justify-center text-primary">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="square"
                strokeLinejoin="miter"
                aria-hidden="true"
              >
                <path d="M1 1l22 22" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <path d="M12 20h.01" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-3">
              Você está offline
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
              Não foi possível carregar a página solicitada porque o dispositivo está sem conexão à internet. Verifique sua rede Wi-Fi ou dados móveis.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                type="button"
                onClick={() => handleRetry(true)}
                disabled={retrying}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-5 min-h-[48px] bg-primary text-primary-foreground font-semibold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-75 disabled:pointer-events-none"
              >
                <IconRefresh size={18} className={retrying ? "animate-spin" : ""} />
                <span>{retrying ? "Verificando..." : "Tentar novamente"}</span>
              </button>

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 py-3.5 px-5 min-h-[48px] bg-transparent text-foreground border border-border font-medium text-sm rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                Início
              </Link>
            </div>

            <div className="mt-5 text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse" />
              <span>{statusText}</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
