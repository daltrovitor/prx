// Hello World
"use client";

import { useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PRX_GRADIENTS, PRX_LAYOUT, PRX_PATHS } from "@/lib/brand/prx-logo-data";

gsap.registerPlugin(useGSAP);

const SESSION_KEY = "prx_intro_seen";

/**
 * Abertura completa na primeira visita da sessão, versão curta nas seguintes.
 * Decidido uma única vez por carregamento de página: em desenvolvimento o
 * StrictMode executa os efeitos duas vezes e não pode transformar a primeira
 * visita em "já vista".
 */
let introMode: "full" | "quick" | null = null;

function resolveIntroMode(): "full" | "quick" {
  if (introMode) return introMode;
  try {
    introMode = sessionStorage.getItem(SESSION_KEY) === "true" ? "quick" : "full";
    sessionStorage.setItem(SESSION_KEY, "true");
  } catch {
    // Storage bloqueado (aba privada): segue com a abertura completa.
    introMode = "full";
  }
  return introMode;
}

/** Deslocamento que centraliza o símbolo sozinho antes do lockup abrir (unidades do viewBox). */
const SYMBOL_CENTER_OFFSET = PRX_LAYOUT.viewBox.full[2] / 2 - PRX_LAYOUT.viewBox.symbol[2] / 2;

type Stops = ReadonlyArray<readonly [number, string]>;

function GradientStops({ stops }: { stops: Stops }) {
  return (
    <>
      {stops.map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </>
  );
}

interface PrxLoaderProps {
  /** Quando false, a animação segura o logo montado até os dados ficarem prontos. */
  ready: boolean;
  onComplete: () => void;
}

/**
 * Abertura animada da marca PRX (3–4s na primeira visita da sessão, ~1.3s nas seguintes).
 * 1. As duas peças do símbolo deslizam e se encaixam no centro.
 * 2. O símbolo desliza para a esquerda enquanto P, R e X sobem de uma máscara.
 * 3. A assinatura é revelada da esquerda para a direita e a barra se abre do centro.
 * 4. A tela é recolhida para cima, revelando o app.
 */
export function PrxLoader({ ready, onComplete }: PrxLoaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const [introFinished, setIntroFinished] = useState(false);
  const exitStarted = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const ids = {
    symbol: `ld-s-${uid}`,
    x: `ld-x-${uid}`,
    bar: `ld-b-${uid}`,
    wordClip: `ld-wc-${uid}`,
    tagClip: `ld-tc-${uid}`,
  };

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const seen = resolveIntroMode() === "quick";

      if (reduceMotion) {
        gsap.set(q("[data-tag-clip]"), { attr: { width: PRX_LAYOUT.viewBox.full[2] } });
        gsap.fromTo(
          q("[data-logo]"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6, onComplete: () => setIntroFinished(true) }
        );
        return;
      }

      const speed = seen ? 0.42 : 1;
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "expo.out" },
        onComplete: () => setIntroFinished(true),
      });

      gsap.set(q("[data-symbol-group]"), { x: SYMBOL_CENTER_OFFSET });
      tl.from(q("[data-piece='white']"), { x: -90, y: -20, autoAlpha: 0, duration: 0.85 }, 0.1)
        .from(q("[data-piece='color']"), { x: 90, y: 20, autoAlpha: 0, duration: 0.85 }, 0.18)
        .to(q("[data-symbol-group]"), { x: 0, duration: 0.85, ease: "expo.inOut" }, 0.8)
        .from(q("[data-letter]"), { y: 130, duration: 0.9, stagger: 0.09 }, 1.38)
        .from(q("[data-piece='x-arm']"), { x: 46, y: -46, autoAlpha: 0, duration: 0.7, ease: "back.out(2)" }, 1.78)
        .to(q("[data-tag-clip]"), { attr: { width: PRX_LAYOUT.viewBox.full[2] }, duration: 0.9, ease: "power3.inOut" }, 2.0)
        .from(q("[data-bar]"), { scaleX: 0, transformOrigin: "50% 50%", duration: 0.7, ease: "power3.out" }, 2.35)
        .to({}, { duration: 0.3 });

      // Estados iniciais já aplicados pelos .from(): agora o SVG pode aparecer sem "piscar" montado.
      gsap.set(q("[data-logo]"), { autoAlpha: 1 });

      // Relógio próprio da abertura: o app usa lagSmoothing(0) para sincronizar o Lenis,
      // o que faria a animação "pular" quadros enquanto a página ainda carrega (3D, hidratação).
      // Aqui cada quadro avança no máximo 1/30s: a animação nunca salta, só desacelera.
      let elapsed = 0;
      let last = performance.now();
      let frame = 0;
      const step = (now: number) => {
        elapsed += Math.min(now - last, 1000 / 30) / 1000;
        last = now;
        tl.time(elapsed / speed);
        if (tl.progress() < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame((now) => {
        last = now;
        frame = requestAnimationFrame(step);
      });

      return () => cancelAnimationFrame(frame);
    },
    { scope: rootRef }
  );

  useEffect(() => {
    if (!introFinished || !ready || exitStarted.current || !rootRef.current) return;
    exitStarted.current = true;
    const root = rootRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const logo = root.querySelector("[data-logo]");

    const exit = gsap.timeline({ onComplete: () => onCompleteRef.current() });
    if (reduceMotion) {
      exit.to(root, { autoAlpha: 0, duration: 0.3 });
    } else {
      exit
        .to(logo, { y: -36, autoAlpha: 0, duration: 0.5, ease: "power3.in" }, 0)
        .to(root, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.75, ease: "power4.inOut" }, 0.12);
    }
    return () => {
      exit.kill();
    };
  }, [introFinished, ready]);

  const [vx, vy, vw, vh] = PRX_LAYOUT.viewBox.full;
  const { symbol: sg, x: xg, bar: bg } = PRX_GRADIENTS;
  const bar = PRX_LAYOUT.bar;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label="Carregando PRX"
      className="prx-loader fixed inset-0 z-[100] flex items-center justify-center bg-white text-[#0b0b10]"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
    >
      <svg
        data-logo
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        className="w-[min(78vw,540px)] h-auto overflow-visible"
        style={{ visibility: "hidden" }}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={ids.symbol} gradientUnits="userSpaceOnUse" cx={sg.cx} cy={sg.cy} r={sg.r}>
            <GradientStops stops={sg.stops} />
          </radialGradient>
          <linearGradient id={ids.x} gradientUnits="userSpaceOnUse" x1={xg.x1} y1={xg.y1} x2={xg.x2} y2={xg.y2}>
            <GradientStops stops={xg.stops} />
          </linearGradient>
          <linearGradient id={ids.bar} gradientUnits="userSpaceOnUse" x1={bar.x} y1={0} x2={bar.x + bar.w} y2={0}>
            <GradientStops stops={bg.stops} />
          </linearGradient>
          {/* Janela do wordmark nas coordenadas do arquivo mestre: as letras sobem por baixo dela. */}
          <clipPath id={ids.wordClip}>
            <rect x={90} y={296} width={500} height={112} />
          </clipPath>
          <clipPath id={ids.tagClip}>
            <rect data-tag-clip x={0} y={0} width={0} height={vh} />
          </clipPath>
        </defs>

        <g data-symbol-group>
          <g transform={PRX_LAYOUT.symbol}>
            <path data-piece="white" fill="currentColor" d={PRX_PATHS.symbolWhite} />
            <path data-piece="color" fill={`url(#${ids.symbol})`} d={PRX_PATHS.symbolColor} />
          </g>
        </g>

        <g transform={PRX_LAYOUT.wordFull}>
          <g clipPath={`url(#${ids.wordClip})`}>
            <path data-letter fill="currentColor" fillRule="evenodd" d={PRX_PATHS.p} />
            <path data-letter fill="currentColor" fillRule="evenodd" d={PRX_PATHS.r} />
            <path data-letter fill={`url(#${ids.x})`} d={PRX_PATHS.xMain} />
          </g>
          <path data-piece="x-arm" fill={`url(#${ids.x})`} d={PRX_PATHS.xArm} />
        </g>

        <g clipPath={`url(#${ids.tagClip})`}>
          <path fill="currentColor" transform={PRX_LAYOUT.tagline} d={PRX_PATHS.tagline} />
        </g>
        <rect data-bar x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={`url(#${ids.bar})`} />
      </svg>
    </div>
  );
}
