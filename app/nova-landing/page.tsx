// Hello World
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevolutLanding } from "@/components/marketing/revolut-landing";
import { verifyAdminRequest } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nova landing · prévia",
  description: "Prévia da nova página inicial da PRX para aprovação da equipe.",
  robots: { index: false, follow: false },
};

/**
 * Prévia da nova landing (Cyber-Luxury Obsidian). A página inicial atual continua no ar;
 * esta rota só abre com sessão de administrador — para o resto do mundo ela não existe.
 */
export default async function NovaLandingPage() {
  const auth = await verifyAdminRequest();
  if (!auth.authorized) notFound();
  return <RevolutLanding preview />;
}
