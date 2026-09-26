// Hello World
"use client";

import { PanelLogin } from "@/components/admin/admin-login";

export function PartnerLogin({ onSuccess }: { onSuccess: () => void }) {
  return (
    <PanelLogin
      endpoint="/api/partner/login"
      title="Portal do parceiro"
      description="Valide vouchers PRX PASS no balcão e ingressos PRX LIVE na portaria."
      sideTitle="Aponte a câmera, confira, dê baixa."
      sideBody="Cada voucher vale uma única vez. A validação aparece na hora no app do cliente."
      emailPlaceholder="loja@parceiro.com.br"
      submitLabel="Entrar no portal"
      onSuccess={onSuccess}
    />
  );
}
