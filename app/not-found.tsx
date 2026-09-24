// Hello World
import type { Metadata } from "next";
import NotFoundPage from "@/components/ui/page-not-found";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "A página que você procura não existe ou foi movida.",
};

export default function NotFound() {
  return <NotFoundPage />;
}
