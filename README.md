<!-- Hello World -->
# PRX

Experiências que conectam gerações. App de benefícios (PRX PASS), conta digital (PRX BANK) e eventos (PRX LIVE) para as gerações Z e Alpha.

## Rodar localmente

```bash
npm install
npm run dev
```

- App: <http://localhost:3000>
- Painel admin: <http://adminprx.localhost:3000>
- Portal do parceiro: <http://partnerprx.localhost:3000>

Sem variáveis do Supabase o app roda com contas de demonstração, que só existem em desenvolvimento:

| Papel | E-mail | Senha |
|---|---|---|
| Membro | `membro@prx.dev` | `Prx2026!` |
| Admin | `admin@prx.dev` | `AdminPrx2026!` |
| Parceiro | `parceiro@prx.dev` | `PartnerPrx2026!` |

## Variáveis de ambiente

| Nome | Uso |
|---|---|
| `URL` / `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) |
| `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (somente servidor) |
| `JWT_SECRET_OR_HMAC_KEY` | Segredo das sessões (32+ caracteres). Sem ele, é derivado do service role |
| `PRX_ADMIN_EMAILS` | Lista de e-mails admin separada por vírgula (opcional) |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app (opcional) |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | Link da Política de Privacidade na tela de aceite do parceiro (opcional) |
| `NEXT_PUBLIC_PRX_LEGAL_NAME` / `NEXT_PUBLIC_PRX_CNPJ` | Razão social e CNPJ exibidos no rodapé e na Política de Privacidade |
| `NEXT_PUBLIC_PRX_DPO_EMAIL` / `NEXT_PUBLIC_PRX_SUPPORT_EMAIL` | Canal do Encarregado (LGPD) e contato (padrão `privacidade@` e `contato@prx.app.br`) |
| `PRX_BAAS_WEBHOOK_SECRET` | Segredo HMAC (32+ caracteres) do webhook `POST /api/bank/webhooks/pix` do banco parceiro |
| `PRX_BAAS_MODE=sandbox` | Liga a conta sandbox (saldo fictício) fora do desenvolvimento, só para contas em memória |
| `PRX_TEASER_HOSTS` | Hosts extras que abrem o teaser `/em-breve` na raiz (além de `prx.app.br`) |
| `CRON_SECRET` | Protege `GET /api/cron/allowances` (mesada automática, agendada no `vercel.json` para 09:05 de Brasília) |
| `PRX_WEBAUTHN_RP_ID` / `PRX_WEBAUTHN_ORIGINS` | Domínio e origens da biometria (passkeys). Padrão: o host da requisição |

## Estrutura

- `app/`: rotas (App Router). `/` é a landing e o app; `/admin` e `/partner` são servidas pelos subdomínios (`proxy.ts`). Páginas públicas: `/termos`, `/privacidade`, `/sou-pai` (cadastro da Conta Pai) e `/em-breve` (raiz do domínio `prx.app.br`). `/nova-landing` é a prévia da nova página inicial, só para administradores (aba "Nova landing" do painel).
- `components/app/`: shell do app, telas (Início, Pass, Destaques, Bank, Live e Perfil no cabeçalho) e UI do Modelo Padrão em Liquid Glass (classes `.glass*`, `.prx-holo` e `.prx-metal` em `app/globals.css`).
- `components/auth/` e `lib/passkeys/`: "Lembrar de mim" com tela de login dedicada (foto, nome, senha ou biometria via WebAuthn) e cadastro com verificação de idade e CPF.
- `components/family/` e `lib/family/`: contas de família — Conta Pai (`/sou-pai`), Conta Filho, emancipação, mesada, limites de gasto e acompanhamento; análise na aba "Famílias" do admin.
- `components/brand/`: logo vetorial e abertura animada.
- `components/icons/`: ícones próprios da PRX.
- `lib/prx/`: domínio do PRX BANK (Pix EMV, cartões, extrato) e do PRX LIVE.
- `lib/points/`: economia PRX: PRX Coins, régua infinita de níveis, regras de bom comportamento, calculadora de viabilidade e motor de compras em parceiros via Pix.
- `lib/reels/`: Reels de parceiros (feed, curtidas, salvos e métricas).
- `lib/partners/`: programa de parceiros: Termo e Resumo Comercial, aceite eletrônico, planos de mídia e métricas agregadas. Ver [docs/PARCEIROS.md](docs/PARCEIROS.md), que inclui a ordem de implantação.
- `docs/`: [relatório](docs/RELATORIO_PRX.md), [plano de BaaS](docs/PLANO_BAAS.md), [infraestrutura para escala](docs/INFRA_ESCALA.md) e [programa de parceiros](docs/PARCEIROS.md).

## Banco de dados

Aplique as migrações de `supabase/migrations` em ordem. A `20260927_prx_points_reels_finance.sql` cria PRX Coins, extrato de pontos, regras de comportamento, Reels, compras em parceiros (BACEN) e lista VIP, com crédito atômico por `prx_apply_point_transaction` (só a service role executa). A `20260928_prx_family_passkeys.sql` zera os coins iniciais, cria a fila de análise de bom comportamento, as biometrias (passkeys), as contas de família (CPF único, Conta Pai, emancipação, vínculos, mesada e limites) e o bucket privado `family-docs`.

Regras de idade (horário de Brasília): menores de 16 só entram pela Conta Pai; 16–17 escolhem Conta Filho (vinculada ao responsável) ou comprovam emancipação; 18–29 abrem conta comum. A Conta Pai não guarda dinheiro nem rende: Pix e mesada saem do banco do responsável direto para a conta do filho, e os limites do menor são conferidos no servidor a cada Pix.

## Qualidade

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
BASE=http://localhost:3000 node scripts/e2e-partners.mjs   # com npm run dev, sem Supabase
BASE=http://localhost:3000 node scripts/e2e-prx2.mjs       # pontos, Pix em parceiro, Reels, financeiro, LGPD
```
