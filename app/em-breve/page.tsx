// Hello World
import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "PRX · O futuro paga mais. Em breve em prx.app.br",
  description: "PRX: benefícios, conta digital, eventos e cultura para as gerações Z e Alpha. Entre na Lista de Espera VIP e seja avisado primeiro.",
  alternates: { canonical: "/em-breve" },
  openGraph: {
    title: "PRX · O futuro paga mais",
    description: "Em breve em prx.app.br. Entre na Lista de Espera VIP.",
    locale: "pt_BR",
    type: "website",
    url: "https://prx.app.br",
  },
};

export default function ComingSoonPage() {
  return <ComingSoon />;
}
