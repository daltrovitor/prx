// Hello World
import type { Metadata } from "next";
import { ObsidianShowcase } from "@/components/obsidian/obsidian-showcase";

export const metadata: Metadata = {
  title: "Showcase Obsidian",
  description: "Celular 3D interativo com o app PRX, visão em tela cheia, componentes e assets da identidade Cyber-Luxury Obsidian.",
  alternates: { canonical: "/teste" },
  robots: { index: false, follow: false },
};

/** Vitrine da identidade Cyber-Luxury Obsidian (aberta, sem login). */
export default function TestePage() {
  return <ObsidianShowcase />;
}
