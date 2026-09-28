// Hello World
"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Liga o RAF do Lenis ao ticker do GSAP assim que a instância existe.
 * O ReactLenis cria o Lenis num efeito próprio e só expõe a instância na
 * renderização seguinte; ler o ref no primeiro efeito do pai devolvia
 * undefined e, com autoRaf desligado, o Lenis nunca andava: a roda do mouse
 * ficava presa no computador (no toque o Lenis não intercepta a rolagem).
 */
function LenisGsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(update);
    };
  }, [lenis]);

  return null;
}

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (listener: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

/**
 * Rolagem inercial do app (Lenis) com o RAF sincronizado ao ticker do GSAP,
 * para que ScrollTrigger e Lenis andem no mesmo quadro, sem trepidação.
 * Com movimento reduzido, a roda do mouse volta a ser a rolagem nativa.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.1, autoRaf: false, smoothWheel: !reduceMotion, syncTouch: false }}>
      <LenisGsapBridge />
      {children}
    </ReactLenis>
  );
}
