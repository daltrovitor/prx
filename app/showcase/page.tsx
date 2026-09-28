// Hello World
import { redirect } from "next/navigation";

/** /showcase é um atalho para a vitrine Obsidian em /teste. */
export default function ShowcasePage() {
  redirect("/teste");
}
