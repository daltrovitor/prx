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

## Estrutura

- `app/`: rotas (App Router). `/` é a landing e o app; `/admin` e `/partner` são servidas pelos subdomínios (`proxy.ts`).
- `components/app/`: shell do app, telas (Início, Pass, Bank, Live, Perfil) e UI do Modelo Padrão.
- `components/brand/`: logo vetorial e abertura animada.
- `components/icons/`: ícones próprios da PRX.
- `lib/prx/`: domínio do PRX BANK (Pix EMV, cartões, extrato) e do PRX LIVE.
- `docs/`: [relatório](docs/RELATORIO_PRX.md), [plano de BaaS](docs/PLANO_BAAS.md) e [infraestrutura para escala](docs/INFRA_ESCALA.md).

## Qualidade

```bash
npx tsc --noEmit
npm run lint
npm run build
```
