# PRX: banco de dados e hospedagem para 50 mil+ usuários

Pergunta: Supabase + Vercel aguentam 50 mil pessoas usando sem cair, e sem virar uma conta alta, se o usuário entra de graça?

Resposta curta: **sim, aguentam**, desde que o projeto saia dos planos gratuitos, rode na região de São Paulo e resolva três pontos do código (seção 3). Na faixa de 50 mil usuários o custo estimado fica em **US$ 60 a 250 por mês**. A troca de fornecedor só compensa bem acima disso ou por exigência regulatória.

Preços consultados nas páginas oficiais em 24/09/2026.

---

## 1. Situação atual (e dois riscos imediatos)

| Item | Hoje | Risco |
|---|---|---|
| Vercel | Plano **Hobby** | O Hobby **não permite uso comercial**. Um app com parceiros, cobrança e banco precisa do **Pro** (US$ 20/mês por membro). |
| Supabase | Verificar o plano | No Free, projetos **pausam após 1 semana sem uso**, com limite de 500 MB e 5 GB de tráfego. Em produção precisa ser **Pro**. |

---

## 2. Quanto 50 mil usuários consomem (estimativa)

Premissas: 50 mil cadastrados, 25% ativos por dia (12,5 mil), cerca de 30 chamadas de API por sessão e pico de 10% dos ativos no mesmo minuto.

| Recurso | Uso estimado/mês | Incluído no plano | Custo extra |
|---|---|---|---|
| Invocações de função (Vercel Pro) | cerca de 11 milhões | 1 milhão | cerca de US$ 6 (US$ 0,60 por milhão) |
| Transferência de dados (Vercel Pro) | 150–400 GB | 1 TB | US$ 0 |
| Usuários ativos no Auth (Supabase Pro) | 50 mil MAU | 100 mil MAU | US$ 0 |
| Banco (Supabase Pro) | 1–4 GB | 8 GB | US$ 0 |
| Computação do Postgres | pico de ~200 req/s | Micro incluído | Small (US$ 15) → Medium (US$ 60) |

**Total estimado:** Vercel Pro (US$ 20 + ~US$ 10 de uso) + Supabase Pro (US$ 25 + computação de US$ 15 a 60) = **cerca de US$ 70 a 115 por mês**. Com Team no Supabase para SSO, backups estendidos e SOC2: **+US$ 599/mês**, necessário só quando um parceiro ou o BaaS exigir.

Para comparar: a versão anterior do dashboard fazia uma requisição **a cada 8 segundos** por usuário com a tela aberta. Isso equivalia a cerca de 100 milhões de chamadas por mês para 12 mil ativos. **Isso já foi corrigido** (ver seção 3).

---

## 3. O que precisa mudar no código para escalar

| # | Problema | Situação |
|---|---|---|
| 1 | Polling a cada 8s em todos os dashboards | **Corrigido**: só atualiza enquanto há voucher aguardando validação (a cada 20s), com a aba visível e ao voltar o foco para o app |
| 2 | Missões, indicações e parte dos vouchers ficam em **memória do servidor** (`lib/pass-store.ts`). Na Vercel cada instância tem a própria memória: dados somem, divergem entre instâncias e permitem repetir XP | **Pendente, prioridade 1**: migrar para as tabelas `user_missions` e `referrals`, que já existem nas migrações |
| 3 | Toda requisição autenticada faz consulta de perfil e mais `auth.admin.getUserById` | **Pendente**: guardar o papel no token de sessão e no `profiles`, eliminando a segunda chamada |
| 4 | O painel admin carrega todos os usuários com `auth.admin.listUsers()` | **Pendente**: paginar (50 por página) e buscar no servidor |
| 5 | Sem limite de requisições (brute force em login e validação de voucher) | **Pendente**: regras do Firewall da Vercel ou Upstash Redis (plano gratuito cobre) |
| 6 | Sem monitoramento de erros | **Pendente**: Sentry (plano gratuito) e alertas de uptime |

Com os itens 2 a 5 resolvidos, o gargalo passa a ser apenas o Postgres, que escala verticalmente (Small → Medium → Large) sem mudar código.

---

## 4. Alternativas avaliadas

### Banco de dados

| Opção | Prós | Contras | Custo aprox. (50 mil usuários) |
|---|---|---|---|
| **Supabase Pro (recomendado)** | Já integrado (Auth, Storage, RLS), região São Paulo, Postgres puro, fácil de migrar depois | Auth e banco no mesmo fornecedor | US$ 40–85/mês |
| Neon (Postgres serverless) | Escala a zero, branch por pull request | Precisaria de Auth e Storage à parte (Clerk, S3/R2) | US$ 20–70/mês + Auth |
| AWS RDS/Aurora (sa-east-1) | Padrão corporativo, bom para auditoria de fintech | Exige DevOps, custo e complexidade maiores | US$ 150–400/mês |
| Firebase/Firestore | Tempo real nativo | NoSQL atrapalha extrato, conciliação e relatórios financeiros | Varia muito com o número de leituras |

### Hospedagem

| Opção | Prós | Contras | Custo aprox. |
|---|---|---|---|
| **Vercel Pro (recomendado)** | Zero mudança, região São Paulo (gru1), CDN, WAF, preview por branch | Custo cresce com invocações muito acima de 50 mil usuários | US$ 20–60/mês |
| Cloudflare Workers (OpenNext) | Muito barato em alto volume, rede global | Adaptação do Next.js, limites de runtime | US$ 5–30/mês |
| AWS (Amplify ou ECS) | Controle total | Exige DevOps | US$ 80–300/mês |
| VPS (Hetzner/DigitalOcean) + Coolify | Custo fixo baixo | Você mantém o servidor, e cair vira responsabilidade sua | US$ 20–60/mês |

---

## 5. Recomendação

1. **Agora:** Vercel **Pro** e Supabase **Pro**, as duas em **São Paulo**. Configurar backups diários (inclusos no Pro) e o alerta de consumo da Vercel.
2. **Antes de abrir para o público:** itens 2 a 6 da seção 3.
3. **Quando o PRX BANK entrar:** o dinheiro e o extrato oficial ficam no provedor BaaS. O Supabase guarda só o espelho e o log de webhooks, o que não aumenta o custo de forma relevante.
4. **Acima de 500 mil usuários ou por exigência do parceiro regulado:** reavaliar Supabase Team ou Enterprise, ou migrar o Postgres para AWS. Como é Postgres padrão, a migração é um `pg_dump`.

"Não cair" na prática significa: plano pago (sem pausa), Postgres com computação dedicada, limite de requisições, monitoramento com alerta e deploys com preview. Tudo isso cabe no orçamento acima.
