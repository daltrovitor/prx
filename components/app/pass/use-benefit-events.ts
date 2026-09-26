// Hello World
"use client";

import { useCallback, useEffect, useRef } from "react";

const ENDPOINT = "/api/pass/events";
const SEEN_KEY = "prx:benefit-impressions";
const FLUSH_MS = 1500;

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-500)));
  } catch {
    // storage indisponível: a deduplicação vale só para esta tela
  }
}

function send(body: { impressions?: string[]; click?: string }, beacon = false) {
  const payload = JSON.stringify(body);
  if (beacon && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
}

/**
 * Métricas do catálogo para o parceiro: exibição (card 50% visível, uma vez por
 * sessão) e clique (abrir o benefício). O servidor grava só benefício e faixa
 * etária — nunca quem viu ou clicou.
 */
export function useBenefitEvents() {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const observer = useRef<IntersectionObserver | null>(null);

  const flush = useCallback((beacon = false) => {
    window.clearTimeout(timer.current);
    while (queue.current.length > 0) {
      send({ impressions: queue.current.splice(0, 60) }, beacon);
    }
  }, []);

  const enqueue = useCallback(
    (id: string) => {
      seen.current ??= readSeen();
      if (seen.current.has(id)) return;
      seen.current.add(id);
      writeSeen(seen.current);
      queue.current.push(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(), FLUSH_MS);
    },
    [flush]
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      observer.current?.disconnect();
      observer.current = null;
      flush(true);
    };
  }, [flush]);

  /** Ref callback para o elemento do card. */
  const track = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (!element || typeof IntersectionObserver === "undefined") return;
      observer.current ??= new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const benefitId = (entry.target as HTMLElement).dataset.benefitId;
            if (entry.isIntersecting && benefitId) {
              enqueue(benefitId);
              observer.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      element.dataset.benefitId = id;
      observer.current.observe(element);
    },
    [enqueue]
  );

  const click = useCallback((id: string) => send({ click: id }), []);

  return { track, click };
}
