// Hello World
import type { Metadata } from "next";
import { StaffApp, type StaffAuthResult } from "@/components/staff/staff-app";
import { verifyStaffRequest } from "@/lib/auth";
import { PartnerError } from "@/lib/partners/errors";
import { requireStaffActor } from "@/lib/staff/service";

export const metadata: Metadata = {
  title: "Equipe PRX",
  description: "Portaria de eventos PRX LIVE e validação de benefícios PRX PASS pela equipe PRX.",
  robots: { index: false, follow: false },
};

async function resolveStaff(): Promise<StaffAuthResult> {
  try {
    const auth = await verifyStaffRequest();
    if (!auth.authorized || !auth.staffUser) {
      return auth.status === 401 ? { status: "unauthenticated" } : { status: "denied", message: "Esta conta não faz parte da Equipe PRX." };
    }
    return { status: "authenticated", actor: await requireStaffActor(auth.staffUser) };
  } catch (error) {
    return { status: "denied", message: error instanceof PartnerError ? error.message : "Acesso negado." };
  }
}

/** A sessão é verificada no servidor: o HTML já chega com o login ou com o validador. */
export default async function StaffPage() {
  return <StaffApp initial={await resolveStaff()} />;
}
