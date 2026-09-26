// Hello World
"use client";

import { useEffect } from "react";

/**
 * Registrador do Service Worker PWA para PRX.
 * Compatível com iOS (Safari e Home Screen standalone PWA),
 * Android (Chrome e WebAPK) e Desktop.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Checa atualizações periodicamente
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Nova versão instalada em background
              }
            };
          };
        })
        .catch(() => {
          // Erro de registro silenciosamente tratado
        });
    };

    if (document.readyState === "complete") {
      registerWorker();
    } else {
      window.addEventListener("load", registerWorker, { once: true });
    }
  }, []);

  return null;
}
