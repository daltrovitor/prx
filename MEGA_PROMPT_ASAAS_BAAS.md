<!-- Hello World -->
# 🏛️ MEGA PROMPT: IMPLEMENTAÇÃO DO SISTEMA BANCÁRIO (BaaS ASAAS) NO APP PRX

> **Instruções para o Agente ou Desenvolvedor:**
> Você é um Engenheiro de Software Sênior especialista em Arquitetura Fintech, Next.js (App Router), TypeScript Estrito e Banking as a Service (BaaS).
> Sua missão é integrar a infraestrutura financeira do **Asaas API v3** como o provedor oficial de BaaS do ecossistema bancário **PRX (PRX BANK)**, substituindo com segurança os mocks em memória e conectando o fluxo financeiro real em ambiente Sandbox e Produção.

---

## 🎯 1. Contexto do Projeto e Objetivos

O **PRX** é uma plataforma que atende jovens das gerações Z e Alpha, composta por:
1. **PRX BANK**: Conta de pagamento digital com saldo individual, Pix (Envio, Recebimento, Copia e Cola, QR Code dinâmico), extrato unificado, pagamento de contas e limites transacionais.
2. **Conta Família**: Vínculo entre Conta Pai (`/sou-pai`) e Conta Filho (menores de idade), com mesada programada, controle parental de limites e acompanhamento.
3. **Economia de Fidelidade (PRX Coins & PASS)**: Cashbacks e compras integradas via Pix em parceiros cadastrados.

O Asaas atua como a **Instituição de Pagamento prestadora (Código Bacen 461)** no modelo **BaaS / White Label**, emitindo subcontas individualizadas via API, sem expor o painel do Asaas aos correntistas finais.

---

## 🛠️ 2. Stack Tecnológica e Requisitos Técnicos

- **Framework**: Next.js 16 (App Router com Route Handlers e Server Components).
- **Linguagem**: TypeScript com modo estrito (`strict: true`, zero `any`).
- **Banco de Dados**: Supabase (PostgreSQL) com RLS (*Row Level Security*).
- **Provedor BaaS**: Asaas API v3 (`https://sandbox.asaas.com/api/v3` em testes e `https://api.asaas.com/v3` em produção).
- **Validação de Entrada**: Zod schemas para todas as requisições e payloads de webhook.
- **Segurança Transacional**:
  - As credenciais de API (`ASAAS_API_KEY` e subconta `apiKey`) **jamais** devem trafegar para o cliente/navegador.
  - Todas as chamadas para o Asaas são feitas exclusivamente *server-side* (`lib/asaas/*` e rotas `app/api/bank/*`).
  - Webhooks devem ser protegidos pela validação obrigatória do token de autenticação no cabeçalho `asaas-access-token` e com verificação de idempotência (tabela de deduplicação).
  - Primeira linha obrigatória em arquivos de código: `// Hello World` ou `<!-- Hello World -->`.
- **Automação de Versionamento e Entrega Contínua (Push Automático na `main`)**:
  - A cada fase implementada e empiricamente validada (`npm run typecheck` e testes com zero erros), o agente DEVE automaticamente fazer o commit com mensagem semântica (Conventional Commits) e executar `git push origin main` de forma imediata e autônoma, sem pedir autorização extra ao usuário.


---

## 🏗️ 3. Arquitetura da Integração

```
Navegador / App Client (components/app/screens/bank-screen.tsx)
      │
      ▼  (Chamadas seguras com Cookie/Bearer)
Rotas do Servidor PRX (app/api/bank/*)
      │
      ▼
Camada de Domínio e Adaptadores (lib/prx/bank.ts & lib/asaas/client.ts)
      │
      ├──▶ Supabase (Espelho de contas, auditoria, webhooks e mapeamento de IDs)
      │
      └──▶ API Externa Asaas v3 (Instituição Bacen 461)
            • POST /v3/accounts (Subcontas individualizadas)
            • GET  /v3/finance/balance (Saldo da subconta)
            • GET  /v3/financialTransactions (Extrato)
            • POST /v3/pix/qrCodes/static e /v3/payments (Pix Cobrança / QR Code)
            • POST /v3/transfers e /v3/pix/qrCodes/pay (Pix Envio e TED)
            • POST /v3/bill (Pague Contas / Boletos)
            • POST /v3/myAccount/documents (Onboarding KYC)
```

---

## 📋 4. Roteiro Passo a Passo de Execução

### Fase 1: Camada HTTP do Asaas (`lib/asaas/client.ts`)
1. Crie uma classe singleton tipada `AsaasClient` que implemente:
   - Suporte a chamadas pela Conta Mãe (`ASAAS_API_KEY`) e chamadas em nome da Subconta (passando a `apiKey` individual da subconta no header `access_token`).
   - Tratamento resiliente de Rate Limits (códigos 429) com retry exponencial.
   - Normalização de erros da API do Asaas (captura dos arrays `errors: [{ code, description }]`).

### Fase 2: Modelagem no Banco de Dados (Supabase Migration)
Crie uma migration SQL em `supabase/migrations/` para registrar:
1. `bank_subaccounts`:
   - `id` (uuid, PK vinculado a `auth.users`)
   - `asaas_account_id` (string, ID da conta retornado pelo Asaas `act_...`)
   - `wallet_id` (string)
   - `api_key` (string criptografada para requisições em nome do cliente)
   - `account_number` e `agency`
   - `status` (`pending_activation`, `active`, `blocked`, `rejected`)
   - `kyc_status` (`PENDING`, `APPROVED`, `REJECTED`)
2. `bank_webhooks_log`:
   - `id` (uuid, PK)
   - `event_id` (string, identificador único do evento para idempotência)
   - `event_type` (string, ex: `PAYMENT_RECEIVED`, `TRANSFER_DONE`)
   - `payload` (jsonb)
   - `processed_at` (timestamptz)

### Fase 3: Abertura de Conta e Onboarding KYC
1. **Endpoint `POST /api/bank/accounts`**:
   - Cria a subconta BaaS via `POST /v3/accounts` enviando nome, CPF/CNPJ, e-mail, celular, renda e endereço.
   - Já injeta a URL do Webhook PRX e o `authToken` de segurança na criação da subconta.
   - Salva o `apiKey` e `walletId` da subconta de forma segura no Supabase.
2. **KYC / Documentos**:
   - Rota para consultar documentos pendentes (`GET /v3/myAccount/documents`) e enviar arquivos de identidade/selfie (`POST /v3/myAccount/documents`).
   - Escuta ao webhook `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` para mudar a conta para status `active`.

### Fase 4: Movimentação de Entrada (Pix Cash-in)
1. **Chaves Pix**:
   - Listar chaves da subconta (`GET /v3/pix/addressKeys`).
   - Cadastrar nova chave Pix (`POST /v3/pix/addressKeys`).
2. **Gerar Pix Cobrança / Depósito**:
   - Criar cobrança imediata (`POST /v3/payments` com `billingType: 'PIX'`).
   - Recuperar QR Code dinâmico e payload Copia e Cola (`GET /v3/payments/{id}/pixQrCode`).
   - Retornar ao app para exibição em tela com o leitor/copiador.

### Fase 5: Movimentação de Saída (Pix Cash-out & Pague Contas)
1. **Decodificação de QR Code ou Chave**:
   - Endpoint para consultar chave ou decodificar QR Code (`POST /v3/pix/qrCodes/decode`).
   - Retorna recebedor, banco de destino e valor para confirmação pelo usuário na tela.
2. **Efetivação de Pix**:
   - Efetua pagamento com saldo da subconta via `POST /v3/pix/qrCodes/pay` ou `POST /v3/transfers`.
   - Requer confirmação de senha transacional / biometria (WebAuthn).
3. **Pague Contas (Boletos de Concessionárias / Tributos)**:
   - Simulação e validação de linha digitável (`POST /v3/bill/simulate`).
   - Agendamento ou liquidação imediata da conta (`POST /v3/bill`).

### Fase 6: Consulta de Saldo, Extrato, Webhooks e Notificações no App
1. **Saldo e Extrato**:
   - Rota `GET /api/bank/balance`: Consulta saldo em tempo real no Asaas (`GET /v3/finance/balance`).
   - Rota `GET /api/bank/statement`: Retorna transações paginadas (`GET /v3/financialTransactions`).

2. **Webhooks Oficiais do PRX**:
   - **Token de Autenticação Obrigatório**: `ASAAS_WEBHOOK_AUTH_TOKEN` (valor só no `.env.local` e na Vercel, nunca no repositório; recebido no header `asaas-access-token`).
   - **Webhook de Eventos Financeiros (`POST /api/bank/webhooks/asaas`)**:
     - URL oficial: `https://prx.app.br/api/bank/webhooks/asaas`
     - Valida `asaas-access-token` contra `ASAAS_WEBHOOK_AUTH_TOKEN`.
     - Deduplicação e idempotência via `bank_webhooks_log` (rejeita duplicados com HTTP 200).
   - **Webhook de Validação de Saque (`POST /api/bank/webhooks/validate-withdraw`)**:
     - URL oficial: `https://prx.app.br/api/bank/webhooks/validate-withdraw`
     - Valida `asaas-access-token`, compara com a transação solicitada no banco e responde com `{"status": "APPROVED"}` ou `{"status": "REFUSED"}`.

3. **Sistema de Notificações em Tempo Real no App do Usuário**:
   - Todos os eventos recebidos pelo webhook do Asaas devem gerar notificações instantâneas e persistidas para o usuário correntista:
     - **Persistência**: Gravar na tabela `bank_notifications` no Supabase vinculada ao `user_id` do correntista.
     - **Integração com o Sino e Feed do App**: Conectar ao componente de notificações do app (`components/app/notifications.tsx` via `useNotices`), habilitando a categoria `kind: "bank"` com redirecionamento direto para a aba `tab: "bank"`.
     - **Alertas e Toasts por Evento**:
       - `PAYMENT_RECEIVED`: *"Pix recebido! R$ {valor} de {pagador}."* (Atualiza saldo em tempo real no client).
       - `TRANSFER_DONE`: *"Pix enviado com sucesso! R$ {valor} para {favorecido}."*
       - `TRANSFER_FAILED`: *"Falha na transferência de R$ {valor}. O valor foi estornado ao seu saldo."*
       - `BILL_PAID`: *"Boleto pago com sucesso! Pagamento de R$ {valor} compensado."*
       - `BILL_FAILED`: *"Falha no pagamento de conta. O saldo foi liberado."*
       - `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`: *"Sua conta bancária foi aprovada! 🎉 Você já pode enviar e receber Pix."*
       - `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED`: *"Atenção aos seus documentos: refaça o envio para ativar sua conta."*

### Fase 7: Compliance Regulatória BACEN (Resolução Conjunta nº 16/2025)
1. **Branding e Transparência**:
   - Em todas as telas do banco (`components/app/screens/bank-screen.tsx`), comprovantes de transferência e termos de aceite, exibir a chancela:
     *"Conta de pagamento operada em parceria com Asaas Gestão Financeira Instituição de Pagamento S.A. (Código Bacen 461)"*.
2. **Limites Operacionais**:
   - Respeitar limites de Pix noturno (entre 20h e 06h) e limites para menores de idade conforme a Conta Família.

---

## 🚀 Protocolo de Execução com Push Automático

1. **Prontidão do Ambiente**:
   - As variáveis de ambiente, URLs de webhook e tokens já estão configurados no `.env.local`. Inicie diretamente a codificação a partir da Fase 1.
2. **Execução Sequencial por Fases com Push Automático na `main`**:
   - Desenvolva cada fase passo a passo (Fases 1 a 7).
   - Valide rigorosamente com `npm run typecheck` e `npm test`.
   - **Obrigatório:** Assim que os testes e a compilação passarem com zero erros na fase, execute imediatamente no terminal:
     ```bash
     git add .
     git commit -m "feat(bank): implementa fase X - <descrição da fase>"
     git push origin main
     ```
   - Não pare nem aguarde o usuário pedir para fazer commit/push; realize o push para a branch `main` de forma contínua e autônoma a cada marco completado.
