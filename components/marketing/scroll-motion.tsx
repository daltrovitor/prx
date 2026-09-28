// Hello World
"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Movimento das páginas públicas: rolagem inercial Lenis com o RAF no ticker
 * do GSAP (lenis.on("scroll", ScrollTrigger.update) + gsap.ticker.add) e três
 * efeitos declarativos no HTML renderizado no servidor:
 *   data-reveal            entra de baixo quando aparece na tela
 *   data-parallax="0.15"   desloca no ritmo da rolagem (maquetes flutuantes)
 *   data-count="11"        conta de 0 até o número quando aparece
 * GSAP e Lenis são carregados depois que a página fica ociosa, fora do caminho
 * crítico. Sem JavaScript ou com movimento reduzido, o conteúdo aparece pronto.
 */
export function ScrollMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

    const start = async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const format = new Intl.NumberFormat("pt-BR");

      const lenis = new Lenis({ lerp: 0.09, autoRaf: false });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      // Âncoras internas (#pass, #bank…) com a mesma inércia.
      const onAnchor = (event: MouseEvent) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href*='#']");
        if (!link) return;
        const url = new URL(link.href, window.location.href);
        if (url.pathname !== window.location.pathname || !url.hash) return;
        const target = document.querySelector<HTMLElement>(url.hash);
        if (!target) return;
        event.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
        history.replaceState(null, "", url.hash);
      };
      document.addEventListener("click", onAnchor);

      // Só anima o que ainda não passou pela tela: o que o visitante já está vendo não some.
      const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.9;

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").filter(below).forEach((el) => {
          gsap.from(el, {
            y: 36,
            autoAlpha: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: Number(el.dataset.revealDelay || 0),
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          const speed = Number(el.dataset.parallax || 0.12);
          gsap.fromTo(
            el,
            { yPercent: speed * 60 },
            { yPercent: -speed * 60, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true } }
          );
        });

        gsap.utils.toArray<HTMLElement>("[data-count]").filter(below).forEach((el) => {
          const target = Number(el.dataset.count || 0);
          const counter = { value: 0 };
          el.textContent = "0" + (el.dataset.suffix || "");
          gsap.to(counter, {
            value: target,
            duration: 1.6,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onUpdate: () => {
              el.textContent = format.format(Math.round(counter.value)) + (el.dataset.suffix || "");
            },
          });
        });
      }, scope);

      cleanup = () => {
        ctx.revert();
        document.removeEventListener("click", onAnchor);
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    };

    const useIdle = typeof w.requestIdleCallback === "function";
    const idle = useIdle ? w.requestIdleCallback!(() => void start(), { timeout: 1500 }) : window.setTimeout(() => void start(), 300);

    return () => {
      cancelled = true;
      if (useIdle) w.cancelIdleCallback?.(idle);
      else window.clearTimeout(idle);
      cleanup?.();
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
