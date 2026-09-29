// Hello World
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Desenhos em traço fino das páginas sem fotografia (SVG leve, sem imagens):
 * o corredor em ponto de fuga do PRX HOME, a pista do PRX RUN, os círculos do
 * PRX CIRCLE e o sol do PRX UP. Todos decorativos (aria-hidden) e animados só
 * com transform/opacity ligados à rolagem.
 */

/** Corredor em perspectiva central até uma porta acesa: o primeiro apê começa antes da chave. */
export function PerspectiveDoor({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const glow = useTransform(scrollYProgress, [0.2, 1], [0.25, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const rays = [
    [0, 0],
    [400, 0],
    [0, 400],
    [400, 400],
    [0, 200],
    [400, 200],
    [200, 0],
    [200, 400],
  ];
  return (
    <motion.div ref={ref} aria-hidden style={{ scale }} className={cn("relative aspect-square w-full", className)}>
      <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
        {[0.18, 0.34, 0.5, 0.66].map((t) => {
          const inset = 200 * t * 0.78;
          return <rect key={t} x={inset} y={inset} width={400 - inset * 2} height={400 - inset * 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
        })}
        {rays.map(([x, y]) => (
          <line key={`${x}-${y}`} x1={x} y1={y} x2={200 + (x - 200) * 0.22} y2={200 + (y - 200) * 0.22} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        ))}
        <motion.rect x="172" y="162" width="56" height="82" rx="2" fill="#7c3aed" style={{ opacity: glow }} />
        <rect x="172" y="162" width="56" height="82" rx="2" stroke="#c4b5fd" strokeWidth="1.2" />
        <circle cx="219" cy="206" r="2.4" fill="#ffffff" />
      </svg>
      <motion.div style={{ opacity: glow }} className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),transparent)]" />
    </motion.div>
  );
}

/** Raias da pista convergindo ao horizonte, com a linha de chegada em violeta. */
export function RunLanes({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const finishY = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const lanes = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div ref={ref} aria-hidden className={cn("relative w-full overflow-hidden", className)}>
      <svg viewBox="0 0 800 300" preserveAspectRatio="none" className="h-full w-full" fill="none">
        {lanes.map((l) => (
          <line key={l} x1={400 + l * 16} y1="0" x2={400 + l * 150} y2="300" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        ))}
        <line x1="0" y1="0.5" x2="800" y2="0.5" stroke="rgba(255,255,255,0.1)" />
      </svg>
      <motion.div style={{ y: finishY }} className="absolute inset-x-[18%] top-[42%] h-[3px] rounded-full bg-[#7c3aed] shadow-[0_0_24px_rgba(124,58,237,0.9)]" />
    </div>
  );
}

/** Círculos concêntricos com pontos: conexões por afinidade, não por vitrine. */
export function CircleRings({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [-18, 18]);
  const rings = [
    { r: 60, dots: 4 },
    { r: 110, dots: 7 },
    { r: 160, dots: 11 },
  ];
  return (
    <motion.div ref={ref} aria-hidden style={{ rotate }} className={cn("relative aspect-square w-full", className)}>
      <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
        {rings.map(({ r, dots }, ring) => (
          <g key={r}>
            <circle cx="200" cy="200" r={r} stroke="rgba(124,58,237,0.28)" strokeWidth="1" />
            {Array.from({ length: dots }, (_, i) => {
              const a = (i / dots) * Math.PI * 2 + ring * 0.4;
              return <circle key={i} cx={200 + Math.cos(a) * r} cy={200 + Math.sin(a) * r} r={ring === 0 ? 7 : 5} fill={i % 3 === 0 ? "#7c3aed" : "#0b0b10"} fillOpacity={i % 3 === 0 ? 1 : 0.8} />;
            })}
          </g>
        ))}
        <circle cx="200" cy="200" r="16" fill="#7c3aed" />
      </svg>
    </motion.div>
  );
}

/** O sol da manhã nascendo atrás do título (PRX UP). */
export function MorningSun({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 0.6], ["30%", "-4%"]);
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <motion.div
        style={{ y }}
        className="absolute right-[-18vw] top-[8%] aspect-square w-[min(78vw,760px)] rounded-full bg-[radial-gradient(closest-side,rgba(251,191,36,0.22),rgba(244,114,182,0.12)_55%,rgba(124,58,237,0.06)_78%,transparent)] lg:right-[-6vw]"
      />
    </div>
  );
}
