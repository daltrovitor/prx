// Hello World
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Rolagem inercial do app (Lenis) com o RAF sincronizado ao ticker do GSAP,
 * para que ScrollTrigger e Lenis andem no mesmo quadro, sem trepidação.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;
    if (reduceMotion) {
      lenis.destroy();
      return;
    }

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(update);
    };
  }, []);

  return (
    <ReactLenis root ref={lenisRef} options={{ lerp: 0.08, duration: 1.2, autoRaf: false }}>
      {children}
    </ReactLenis>
  );
}
