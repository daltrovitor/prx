"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface Phone3DModelProps {
  highlightBenefits?: boolean;
  animateXp?: boolean;
  glowIntensity?: number;
  rotationX?: number | MotionValue<number>;
  rotationY?: number | MotionValue<number>;
  rotationZ?: number | MotionValue<number>;
  className?: string;
}

// Helper to create a 2D rounded rectangle shape for Three.js extrusion
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

// Procedural Screen UI Drawer onto 2D Canvas (mapped as WebGL Texture)
function renderPhoneScreenCanvas(
  canvas: HTMLCanvasElement,
  options: { animateXp: boolean; highlightBenefits: boolean; isLight?: boolean }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const isLight = !!options.isLight;

  // 1. Screen Background (OLED Deep Black in Dark Mode, Pure Light Porcelain in Light Mode)
  if (isLight) {
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, w, h);

    const bgGradient = ctx.createRadialGradient(w / 2, 280, 50, w / 2, 500, 800);
    bgGradient.addColorStop(0, "rgba(168, 85, 247, 0.08)");
    bgGradient.addColorStop(1, "rgba(248, 250, 252, 0)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#050609";
    ctx.fillRect(0, 0, w, h);

    const bgGradient = ctx.createRadialGradient(w / 2, 280, 50, w / 2, 500, 800);
    bgGradient.addColorStop(0, "rgba(168, 85, 247, 0.22)");
    bgGradient.addColorStop(1, "rgba(5, 6, 9, 0)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Status Bar (9:41, Cellular, WiFi, Battery)
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.font = "800 44px 'Inter', -apple-system, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("9:41", 80, 96);

  // Cellular bars
  const barX = w - 210;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < 4 
      ? (isLight ? "#0F172A" : "#ffffff") 
      : (isLight ? "rgba(15, 23, 42, 0.2)" : "rgba(255,255,255,0.3)");
    ctx.fillRect(barX + i * 13, 98 - (i + 1) * 7, 8, (i + 1) * 7);
  }

  // WiFi Wave symbol
  ctx.strokeStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(w - 140, 93, 16, Math.PI * 1.25, Math.PI * 1.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w - 140, 93, 8, Math.PI * 1.25, Math.PI * 1.75);
  ctx.stroke();

  // Battery capsule
  const batX = w - 100;
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.85)" : "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(batX, 74, 52, 28, 8);
  ctx.stroke();
  ctx.fillStyle = "#10b981"; // Charged indicator
  ctx.beginPath();
  ctx.roundRect(batX + 4, 78, 36, 20, 4);
  ctx.fill();
  ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.85)" : "rgba(255,255,255,0.9)";
  ctx.fillRect(batX + 52, 83, 3.5, 10);

  // Dynamic Island Notch (Always black hardware cut-out)
  const diWidth = 290;
  const diHeight = 76;
  const diX = (w - diWidth) / 2;
  const diY = 46;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(diX, diY, diWidth, diHeight, 38);
  ctx.fill();
  ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Front camera lens inside dynamic island
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(diX + 48, diY + 38, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#312e81";
  ctx.beginPath();
  ctx.arc(diX + 48, diY + 38, 7.5, 0, Math.PI * 2);
  ctx.fill();

  // 3. Top Tag & Notification Bell
  ctx.fillStyle = isLight ? "rgba(139, 92, 246, 0.12)" : "rgba(168, 85, 247, 0.22)";
  ctx.beginPath();
  ctx.roundRect(65, 175, 185, 52, 26);
  ctx.fill();
  ctx.strokeStyle = isLight ? "rgba(139, 92, 246, 0.45)" : "rgba(192, 132, 252, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = "bold 24px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#7C3AED" : "#d8b4fe";
  ctx.textAlign = "center";
  ctx.fillText("PRX PASS", 65 + 185 / 2, 208);

  // Bell button circle
  const bellX = w - 90;
  const bellY = 201;
  ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(bellX, bellY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.1)" : "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "26px 'Inter', sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("🔔", bellX, bellY + 8);

  // Notification dot
  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.beginPath();
  ctx.arc(bellX + 17, bellY - 15, 8, 0, Math.PI * 2);
  ctx.fill();

  // 4. Greeting Header (High Visibility & Bold Contrast)
  ctx.textAlign = "left";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.font = "800 68px 'Inter', system-ui, sans-serif";
  ctx.fillText("Bom dia, Rafael 👋", 65, 310);

  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.font = "800 46px 'Inter', system-ui, sans-serif";
  ctx.fillText("Você está evoluindo!", 65, 375);

  ctx.fillStyle = isLight ? "#64748B" : "#cbd5e1";
  ctx.font = "500 30px 'Inter', system-ui, sans-serif";
  ctx.fillText("Substitua impulsos por benefícios reais.", 65, 428);

  // 5. Level Card (PRX Level 3)
  const cardX = 65;
  const cardY = 485;
  const cardW = w - 130;
  const cardH = 390;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  if (isLight) {
    cardGrad.addColorStop(0, "#FFFFFF");
    cardGrad.addColorStop(1, "#F8FAFC");
  } else {
    cardGrad.addColorStop(0, "#23173d");
    cardGrad.addColorStop(1, "#100c1e");
  }

  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 38);
  ctx.fill();

  ctx.strokeStyle = isLight ? "rgba(139, 92, 246, 0.35)" : "rgba(192, 132, 252, 0.55)";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Card Content
  ctx.font = "bold 26px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#64748B" : "#cbd5e1";
  ctx.fillText("SEU NÍVEL ATUAL", cardX + 45, cardY + 70);

  ctx.font = "800 66px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("PRX Level 3", cardX + 45, cardY + 145);

  ctx.font = "600 26px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#7C3AED" : "#d8b4fe";
  ctx.fillText("Desbloqueie salas VIP ilimitadas no Nível 4", cardX + 45, cardY + 195);

  // Hexagonal Level 3 Badge (High Contrast)
  const badgeCenterX = cardX + cardW - 100;
  const badgeCenterY = cardY + 110;
  const badgeSize = 58;
  ctx.save();
  ctx.translate(badgeCenterX, badgeCenterY);
  ctx.fillStyle = isLight ? "rgba(139, 92, 246, 0.15)" : "rgba(168, 85, 247, 0.4)";
  ctx.strokeStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const px = badgeSize * Math.cos(angle);
    const py = badgeSize * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isLight ? "#7C3AED" : "#ffffff";
  ctx.font = "800 52px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("3", 0, 3);
  ctx.restore();

  // XP Progress Bar
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 28px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.fillText("XP da Temporada", cardX + 45, cardY + 268);

  ctx.textAlign = "right";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.font = "bold 28px 'JetBrains Mono', monospace";
  ctx.fillText("2.150 / 3.000 XP", cardX + cardW - 45, cardY + 268);

  // Progress Bar Track
  const trackX = cardX + 45;
  const trackY = cardY + 292;
  const trackW = cardW - 90;
  const trackH = 26;

  ctx.fillStyle = isLight ? "#E2E8F0" : "rgba(0, 0, 0, 0.75)";
  ctx.beginPath();
  ctx.roundRect(trackX, trackY, trackW, trackH, 13);
  ctx.fill();

  // Progress Bar Fill
  const fillPercent = options.animateXp ? 0.716 : 0.6;
  const fillW = trackW * fillPercent;
  const fillGrad = ctx.createLinearGradient(trackX, trackY, trackX + fillW, trackY);
  fillGrad.addColorStop(0, "#7c3aed");
  fillGrad.addColorStop(0.5, "#9333ea");
  fillGrad.addColorStop(1, "#0284c7");

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(trackX, trackY, fillW, trackH, 13);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = "bold 24px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#059669" : "#34d399";
  ctx.fillText("✓ +350 XP hoje • 71.6% da temporada", cardX + 45, cardY + 358);

  // 6. Benefits Grid Title
  ctx.textAlign = "left";
  ctx.font = "800 42px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("Seus benefícios", 65, 930);

  ctx.textAlign = "right";
  ctx.font = "bold 30px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.fillText("Ver todos ›", w - 65, 930);

  // 7. Benefits Cards (3 Columns)
  const bY = 970;
  const bH = 275;
  const bMargin = 20;
  const bW = (w - 130 - bMargin * 2) / 3;

  const benefits = [
    { title: "Salas VIP", sub: "Ilimitado", desc: "Aeroportos", color: isLight ? "#7C3AED" : "#c084fc", icon: "✈" },
    { title: "Cashback", sub: "R$ 45,00", desc: "Disponível Pix", color: isLight ? "#0284C7" : "#22d3ee", icon: "✦" },
    { title: "Anuidade", sub: "Grátis", desc: "Cartão Black", color: isLight ? "#2563EB" : "#60a5fa", icon: "💳" },
  ];

  benefits.forEach((b, idx) => {
    const bX = 65 + idx * (bW + bMargin);

    // Card background
    ctx.fillStyle = options.highlightBenefits
      ? (isLight ? "#EDE9FE" : "rgba(38, 26, 62, 0.98)")
      : (isLight ? "#FFFFFF" : "rgba(18, 20, 32, 0.92)");
    ctx.beginPath();
    ctx.roundRect(bX, bY, bW, bH, 30);
    ctx.fill();

    ctx.strokeStyle = options.highlightBenefits
      ? (isLight ? "#7C3AED" : "rgba(192, 132, 252, 1.0)")
      : (isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)");
    ctx.lineWidth = options.highlightBenefits ? 4.5 : 2;
    ctx.stroke();

    // Icon Circle
    ctx.fillStyle = isLight ? "rgba(139, 92, 246, 0.1)" : b.color + "30";
    ctx.beginPath();
    ctx.arc(bX + bW / 2, bY + 62, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.color;
    ctx.font = "38px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.icon, bX + bW / 2, bY + 62);

    // Title & Subtitle & Description
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 32px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
    ctx.fillText(b.title, bX + bW / 2, bY + 148);

    ctx.font = "bold 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = b.color;
    ctx.fillText(b.sub, bX + bW / 2, bY + 195);

    ctx.font = "500 22px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = isLight ? "#64748B" : "#94a3b8";
    ctx.fillText(b.desc, bX + bW / 2, bY + 238);
  });

  // 8. Quests & Activities (High Visibility)
  // Quest 1: Meta Semanal
  const q1Y = 1290;
  const qH = 145;
  ctx.fillStyle = isLight ? "#FFFFFF" : "rgba(22, 18, 35, 0.94)";
  ctx.beginPath();
  ctx.roundRect(65, q1Y, w - 130, qH, 30);
  ctx.fill();
  ctx.strokeStyle = isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(115, q1Y + qH / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = "800 30px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("Meta Semanal: Poupança Automática", 150, q1Y + 58);

  ctx.font = "500 24px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#64748B" : "#cbd5e1";
  ctx.fillText("Guarde R$ 50 para liberar cupons exclusivos", 150, q1Y + 104);

  ctx.textAlign = "right";
  ctx.font = "bold 28px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#059669";
  ctx.fillText("+150 XP", w - 100, q1Y + qH / 2 + 10);

  // Quest 2: Desafio Hábitos Saudáveis
  const q2Y = 1465;
  ctx.fillStyle = isLight ? "#FFFFFF" : "rgba(22, 18, 35, 0.94)";
  ctx.beginPath();
  ctx.roundRect(65, q2Y, w - 130, qH, 30);
  ctx.fill();
  ctx.strokeStyle = isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.beginPath();
  ctx.arc(115, q2Y + qH / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = "800 30px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("Desafio: 14 Dias Sem Apostas", 150, q2Y + 58);

  ctx.font = "500 24px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#64748B" : "#cbd5e1";
  ctx.fillText("Progresso da comunidade: 11/14 dias concluídos", 150, q2Y + 104);

  ctx.textAlign = "right";
  ctx.font = "bold 28px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
  ctx.fillText("+500 XP", w - 100, q2Y + qH / 2 + 10);

  // Quest 3: Cupom Ativo em Destaque
  const q3Y = 1640;
  ctx.fillStyle = isLight ? "#FFFFFF" : "rgba(22, 18, 35, 0.94)";
  ctx.beginPath();
  ctx.roundRect(65, q3Y, w - 130, qH, 30);
  ctx.fill();
  ctx.strokeStyle = isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isLight ? "#0284C7" : "#22d3ee";
  ctx.beginPath();
  ctx.arc(115, q3Y + qH / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = "800 30px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#0F172A" : "#ffffff";
  ctx.fillText("Cupom Ativo: 20% Off Starbucks", 150, q3Y + 58);

  ctx.font = "500 24px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = isLight ? "#64748B" : "#cbd5e1";
  ctx.fillText("Válido até 15/10 • Toque para resgate rápido", 150, q3Y + 104);

  ctx.textAlign = "right";
  ctx.font = "bold 26px 'JetBrains Mono', monospace";
  ctx.fillStyle = isLight ? "#0284C7" : "#22d3ee";
  ctx.fillText("Resgatar ›", w - 100, q3Y + qH / 2 + 10);

  // 9. Bottom Navigation Dock (5 Tabs)
  const navY = h - 210;
  const navH = 160;
  ctx.fillStyle = isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(7, 8, 12, 0.97)";
  ctx.fillRect(0, navY, w, navH);

  ctx.strokeStyle = isLight ? "#E2E8F0" : "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, navY);
  ctx.lineTo(w, navY);
  ctx.stroke();

  const tabs = [
    { label: "Início", icon: "⌂", active: false },
    { label: "Cartão", icon: "💳", active: false },
    { label: "Investir", icon: "📈", active: false },
    { label: "Benefícios", icon: "🎁", active: true },
    { label: "Perfil", icon: "👤", active: false },
  ];

  const tabWidth = w / tabs.length;
  tabs.forEach((t, i) => {
    const tX = i * tabWidth + tabWidth / 2;
    ctx.textAlign = "center";
    ctx.font = "40px 'Inter', sans-serif";
    ctx.fillStyle = t.active ? (isLight ? "#7C3AED" : "#c084fc") : (isLight ? "#64748B" : "#64748b");
    ctx.fillText(t.icon, tX, navY + 62);

    ctx.font = t.active ? "bold 24px 'Inter', sans-serif" : "500 22px 'Inter', sans-serif";
    ctx.fillText(t.label, tX, navY + 105);

    if (t.active) {
      ctx.fillStyle = isLight ? "#7C3AED" : "#c084fc";
      ctx.beginPath();
      ctx.arc(tX, navY + 122, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Home Indicator Bar (iOS)
  const barWidth = 280;
  const barYPos = h - 25;
  ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.roundRect((w - barWidth) / 2, barYPos, barWidth, 8, 4);
  ctx.fill();
}

export function Phone3DModel({
  highlightBenefits = false,
  animateXp = false,
  glowIntensity = 1,
  rotationX = 12,
  rotationY = -15,
  rotationZ = 4,
  className,
}: Phone3DModelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const { theme } = useTheme();
  const isLight = theme === "light";

  const titaniumMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const buttonMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const cameraBumpMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const getInitialRot = (val: number | MotionValue<number> | undefined, fallback: number) => {
    if (typeof val === "number") return val;
    if (val && typeof (val as MotionValue<number>).get === "function") return (val as MotionValue<number>).get();
    return fallback;
  };

  const targetRotationRef = useRef({
    x: getInitialRot(rotationX, 12),
    y: getInitialRot(rotationY, -15),
    z: getInitialRot(rotationZ, 4),
  });
  const currentRotationRef = useRef({
    x: getInitialRot(rotationX, 12),
    y: getInitialRot(rotationY, -15),
    z: getInitialRot(rotationZ, 4),
  });
  const mouseOffsetRef = useRef({ x: 0, y: 0 });

  // Update target rotation whenever rotation props change (supports both number and MotionValue)
  useEffect(() => {
    if (typeof rotationX === "number") {
      targetRotationRef.current.x = rotationX;
    } else if (rotationX && typeof (rotationX as MotionValue<number>).on === "function") {
      targetRotationRef.current.x = (rotationX as MotionValue<number>).get();
      return (rotationX as MotionValue<number>).on("change", (latest) => {
        targetRotationRef.current.x = latest;
      });
    }
  }, [rotationX]);

  useEffect(() => {
    if (typeof rotationY === "number") {
      targetRotationRef.current.y = rotationY;
    } else if (rotationY && typeof (rotationY as MotionValue<number>).on === "function") {
      targetRotationRef.current.y = (rotationY as MotionValue<number>).get();
      return (rotationY as MotionValue<number>).on("change", (latest) => {
        targetRotationRef.current.y = latest;
      });
    }
  }, [rotationY]);

  useEffect(() => {
    if (typeof rotationZ === "number") {
      targetRotationRef.current.z = rotationZ;
    } else if (rotationZ && typeof (rotationZ as MotionValue<number>).on === "function") {
      targetRotationRef.current.z = (rotationZ as MotionValue<number>).get();
      return (rotationZ as MotionValue<number>).on("change", (latest) => {
        targetRotationRef.current.z = latest;
      });
    }
  }, [rotationZ]);

  // Dynamically re-render screen canvas texture and chassis materials without re-mounting Three.js scene
  useEffect(() => {
    if (screenCanvasRef.current && screenTextureRef.current) {
      renderPhoneScreenCanvas(screenCanvasRef.current, { highlightBenefits, animateXp, isLight });
      screenTextureRef.current.needsUpdate = true;
    }
    if (titaniumMatRef.current) {
      titaniumMatRef.current.color.set(isLight ? 0xdddddf : 0x211736);
    }
    if (buttonMatRef.current) {
      buttonMatRef.current.color.set(isLight ? 0xb0b0b8 : 0x4c356e);
    }
    if (cameraBumpMatRef.current) {
      cameraBumpMatRef.current.color.set(isLight ? 0xe5e5ea : 0x181126);
    }
  }, [highlightBenefits, animateXp, isLight]);

  // Re-draw once fonts are fully ready so typography is pixel-perfect
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        if (screenCanvasRef.current && screenTextureRef.current) {
          renderPhoneScreenCanvas(screenCanvasRef.current, { highlightBenefits, animateXp, isLight });
          screenTextureRef.current.needsUpdate = true;
        }
      });
    }
  }, [highlightBenefits, animateXp, isLight]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Three.js Scene, Camera & Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 800;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 11.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.className = "w-full h-full pointer-events-none md:pointer-events-auto touch-pan-y md:touch-none";
    renderer.domElement.style.touchAction = "pan-y";
    container.appendChild(renderer.domElement);

    // 2. Studio Lighting Rig (Sharp Titanium & Sapphire Specular Highlights)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    // Key Light (Cyan / Cool White specular edge)
    const keyLight = new THREE.DirectionalLight(0xcffafe, 3.8);
    keyLight.position.set(6, 7, 8);
    scene.add(keyLight);

    // Rim Light (Neon Violet / Purple back-edge)
    const rimLight = new THREE.DirectionalLight(0xc084fc, 4.4);
    rimLight.position.set(-7, -4, 6);
    scene.add(rimLight);

    // Top Rim Light for Chamfered Edge Sheen
    const topLight = new THREE.DirectionalLight(0xffffff, 2.6);
    topLight.position.set(0, 9, 5);
    scene.add(topLight);

    // Rear Light for Camera Module Highlights
    const backLight = new THREE.DirectionalLight(0x818cf8, 2.8);
    backLight.position.set(0, 5, -8);
    scene.add(backLight);

    // 3. iPhone Procedural 3D Mesh Construction (Group)
    const phoneGroup = new THREE.Group();
    scene.add(phoneGroup);

    // Geometry Dimensions (iPhone Pro ratio)
    const phoneW = 3.3;
    const phoneH = 6.8;
    const phoneR = 0.65;
    const phoneDepth = 0.36;

    // A. Titanium Beveled Outer Chassis
    const chassisShape = createRoundedRectShape(phoneW, phoneH, phoneR);
    const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
      depth: phoneDepth,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
    // Center extrusion along Z
    chassisGeo.center();

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xdddddf : 0x211736,
      metalness: 0.88,
      roughness: 0.28,
    });
    titaniumMatRef.current = titaniumMat;

    const chassisMesh = new THREE.Mesh(chassisGeo, titaniumMat);
    phoneGroup.add(chassisMesh);

    // B. Side Hardware Buttons
    const buttonMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xb0b0b8 : 0x4c356e,
      metalness: 0.95,
      roughness: 0.2,
    });
    buttonMatRef.current = buttonMat;

    // Left Buttons: Volume Up, Volume Down, Action Button
    const volUpGeo = new THREE.BoxGeometry(0.06, 0.46, 0.12);
    const volUp = new THREE.Mesh(volUpGeo, buttonMat);
    volUp.position.set(-phoneW / 2 - 0.07, 0.85, 0);
    phoneGroup.add(volUp);

    const volDown = new THREE.Mesh(volUpGeo, buttonMat);
    volDown.position.set(-phoneW / 2 - 0.07, 0.25, 0);
    phoneGroup.add(volDown);

    const actionBtnGeo = new THREE.BoxGeometry(0.06, 0.28, 0.12);
    const actionBtn = new THREE.Mesh(actionBtnGeo, buttonMat);
    actionBtn.position.set(-phoneW / 2 - 0.07, 1.45, 0);
    phoneGroup.add(actionBtn);

    // Right Button: Power / Lock Button
    const powerBtnGeo = new THREE.BoxGeometry(0.06, 0.75, 0.12);
    const powerBtn = new THREE.Mesh(powerBtnGeo, buttonMat);
    powerBtn.position.set(phoneW / 2 + 0.07, 0.7, 0);
    phoneGroup.add(powerBtn);

    // C. Rear Camera Module (Plateau + 3 Lenses)
    const cameraBumpShape = createRoundedRectShape(1.45, 1.45, 0.38);
    const cameraBumpGeo = new THREE.ExtrudeGeometry(cameraBumpShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    cameraBumpGeo.center();

    const cameraBumpMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe5e5ea : 0x181126,
      metalness: 0.85,
      roughness: 0.32,
    });
    cameraBumpMatRef.current = cameraBumpMat;
    const cameraBumpMesh = new THREE.Mesh(cameraBumpGeo, cameraBumpMat);
    cameraBumpMesh.position.set(-0.75, 2.3, -phoneDepth / 2 - 0.09);
    phoneGroup.add(cameraBumpMesh);

    // 3 Camera Lenses with Metallic Rings & Sapphire Glass
    const lensPositions = [
      [-0.42, 0.38],
      [-0.42, -0.38],
      [0.38, 0.0],
    ];

    const lensRingGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 32);
    const lensRingMat = new THREE.MeshStandardMaterial({
      color: 0x5a427d,
      metalness: 0.95,
      roughness: 0.15,
    });

    const lensGlassGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.085, 32);
    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050508,
      metalness: 0.9,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    lensPositions.forEach(([lx, ly]) => {
      const ring = new THREE.Mesh(lensRingGeo, lensRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-0.75 + lx, 2.3 + ly, -phoneDepth / 2 - 0.16);
      phoneGroup.add(ring);

      const glass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(-0.75 + lx, 2.3 + ly, -phoneDepth / 2 - 0.162);
      phoneGroup.add(glass);
    });

    // LED Flash (Circle at top-right of camera module)
    const flashGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      metalness: 0.1,
      roughness: 0.2,
      emissive: 0xfff7ed,
      emissiveIntensity: 0.35,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.rotation.x = Math.PI / 2;
    flashMesh.position.set(-0.75 + 0.38, 2.3 + 0.38, -phoneDepth / 2 - 0.12);
    phoneGroup.add(flashMesh);

    // LiDAR Scanner (Dark matte circle at bottom-right of camera module)
    const lidarGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24);
    const lidarMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.8,
      roughness: 0.4,
    });
    const lidarMesh = new THREE.Mesh(lidarGeo, lidarMat);
    lidarMesh.rotation.x = Math.PI / 2;
    lidarMesh.position.set(-0.75 + 0.38, 2.3 - 0.38, -phoneDepth / 2 - 0.12);
    phoneGroup.add(lidarMesh);

    // Antenna Bands on Titanium Rim
    const bandMat = new THREE.MeshBasicMaterial({ color: 0x140d22 });
    const bandGeo = new THREE.BoxGeometry(0.04, 0.08, phoneDepth + 0.15);
    const bandPositions = [
      [-phoneW / 2 - 0.07, 2.3],
      [-phoneW / 2 - 0.07, -2.3],
      [phoneW / 2 + 0.07, 2.3],
      [phoneW / 2 + 0.07, -2.3],
    ];
    bandPositions.forEach(([bx, by]) => {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(bx, by, 0);
      phoneGroup.add(band);
    });

    // D. Front OLED Screen Canvas & Texture
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 1024;
    screenCanvas.height = 2160;
    renderPhoneScreenCanvas(screenCanvas, { highlightBenefits, animateXp, isLight });
    screenCanvasRef.current = screenCanvas;

    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.minFilter = THREE.LinearFilter;
    screenTexture.magFilter = THREE.LinearFilter;
    screenTextureRef.current = screenTexture;

    // Screen Geometry with Normalized UV Coordinates [0, 1]
    const screenShape = createRoundedRectShape(3.15, 6.65, 0.58);
    const screenGeo = new THREE.ShapeGeometry(screenShape);

    // Compute exact 0..1 UV mapping across the screen geometry
    const pos = screenGeo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      uvs[i * 2] = (px + 3.15 / 2) / 3.15;
      uvs[i * 2 + 1] = (py + 6.65 / 2) / 6.65;
    }
    screenGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      toneMapped: false,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0, phoneDepth / 2 + 0.081);
    phoneGroup.add(screenMesh);

    // E. Sapphire Protective Front Glass Overlay
    const glassGeo = new THREE.ShapeGeometry(screenShape);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.02,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 0, phoneDepth / 2 + 0.083);
    phoneGroup.add(glassMesh);

    // 4. Interactive Pointer Dragging & Expressive Parallax
    const dragOffset = { x: 0, y: 0 };
    const dragVelocity = { x: 0, y: 0 };
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      dragVelocity.x = 0;
      dragVelocity.y = 0;
      try {
        container.setPointerCapture?.(e.pointerId);
      } catch {}
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        dragOffset.y += dx * 0.45;
        dragOffset.x += dy * 0.45;
        dragVelocity.x = dy * 0.45;
        dragVelocity.y = dx * 0.45;
      } else {
        if (e.pointerType === "touch") return;
        const normX = (e.clientX / window.innerWidth) * 2 - 1;
        const normY = (e.clientY / window.innerHeight) * 2 - 1;
        mouseOffsetRef.current = {
          x: normX * 10.0,
          y: -normY * 10.0,
        };
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        try {
          container.releasePointerCapture?.(e.pointerId);
        } catch {}
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    // 5. Animation Render Loop (Silky 60fps interpolation with momentum)
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isDragging) {
        // Momentum decay
        dragVelocity.x *= 0.90;
        dragVelocity.y *= 0.90;
        dragOffset.x += dragVelocity.x;
        dragOffset.y += dragVelocity.y;

        // Smooth spring return to section target angle
        dragOffset.x *= 0.93;
        dragOffset.y *= 0.93;
      }

      // Smooth interpolation toward target rotation + mouse offset + user drag
      // Subtle organic floating levitation (gives alive 3D luxury feel)
      const now = performance.now() * 0.0018;
      const floatY = Math.sin(now) * 0.08;
      const subtleTilt = Math.cos(now * 0.8) * 1.5;
      phoneGroup.position.y = floatY;

      const targetX = targetRotationRef.current.x + mouseOffsetRef.current.y + dragOffset.x + subtleTilt;
      const targetY = targetRotationRef.current.y + mouseOffsetRef.current.x + dragOffset.y;
      const targetZ = targetRotationRef.current.z + (mouseOffsetRef.current.x * 0.35);

      currentRotationRef.current.x += (targetX - currentRotationRef.current.x) * 0.085;
      currentRotationRef.current.y += (targetY - currentRotationRef.current.y) * 0.085;
      currentRotationRef.current.z += (targetZ - currentRotationRef.current.z) * 0.085;

      phoneGroup.rotation.x = THREE.MathUtils.degToRad(currentRotationRef.current.x);
      phoneGroup.rotation.y = THREE.MathUtils.degToRad(currentRotationRef.current.y);
      phoneGroup.rotation.z = THREE.MathUtils.degToRad(currentRotationRef.current.z);

      renderer.render(scene, camera);
    };

    animate();

    // 6. Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 400;
      const newH = container.clientHeight || 800;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    // 7. Cleanup on Unmount
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      chassisGeo.dispose();
      titaniumMat.dispose();
      buttonMat.dispose();
      cameraBumpGeo.dispose();
      cameraBumpMat.dispose();
      lensRingGeo.dispose();
      lensRingMat.dispose();
      lensGlassGeo.dispose();
      lensGlassMat.dispose();
      screenGeo.dispose();
      screenMat.dispose();
      screenTexture.dispose();
      glassGeo.dispose();
      glassMat.dispose();

      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={cn("pointer-events-none md:pointer-events-auto", className)}>
      {/* WebGL 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        className="w-[340px] sm:w-[380px] md:w-[400px] h-[660px] sm:h-[740px] md:h-[780px] flex items-center justify-center pointer-events-none md:pointer-events-auto cursor-default md:cursor-grab md:active:cursor-grabbing select-none touch-pan-y md:touch-none"
      />
    </div>
  );
}
