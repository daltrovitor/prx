// Hello World
import { errorMessage } from "@/lib/errors";
import type { BankProviderView, PixKey } from "@/lib/prx/bank";
import { asaasActiveFor, asaasDeps } from "@/lib/bank/asaas/deps";
import { subaccountView } from "@/lib/bank/asaas/onboarding";
import { providerPixKeys } from "@/lib/bank/asaas/cash-in";

/**
 * O que a aba PRX BANK mostra direto do banco parceiro. Cada parte falha
 * sozinha: sem o Asaas (ou sem a migração), a aba segue com o espelho local.
 */
export interface ProviderSnapshot {
  provider: BankProviderView;
  /** Chaves registradas no DICT pela subconta (null = usar o espelho). */
  pixKeys: PixKey[] | null;
}

export async function providerSnapshot(userId: string): Promise<ProviderSnapshot | null> {
  if (!asaasActiveFor(userId)) return null;
  try {
    const deps = asaasDeps();
    const sub = subaccountView(await deps.store.getSubaccount(userId));
    const provider: BankProviderView = { name: "asaas", environment: deps.client.environment, state: sub.state, rejectReason: sub.rejectReason };
    if (sub.state !== "active") return { provider, pixKeys: null };
    const pixKeys = await providerPixKeys(userId, deps).catch((err: unknown) => {
      console.warn("[bank] chaves Pix do banco parceiro indisponíveis:", errorMessage(err));
      return null;
    });
    return { provider, pixKeys };
  } catch (err) {
    console.warn("[bank] banco parceiro indisponível na visão da conta:", errorMessage(err));
    return null;
  }
}
