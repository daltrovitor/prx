// Hello World
import { cn } from "@/lib/utils";

/**
 * Chancela do prestador do BaaS (Resolução Conjunta CMN/BCB nº 16/2025): a
 * instituição autorizada que opera a conta aparece de forma visível no app,
 * nos comprovantes e nos termos de aceite.
 */
export const PROVIDER_DISCLOSURE = "Conta de pagamento operada em parceria com Asaas Gestão Financeira Instituição de Pagamento S.A. (Código Bacen 461)";

export function ProviderDisclosure({ className }: { className?: string }) {
  return <p className={cn("text-[12px] leading-relaxed text-muted-foreground", className)}>{PROVIDER_DISCLOSURE}.</p>;
}
