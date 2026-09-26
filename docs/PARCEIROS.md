# Programa de parceiros PRX PASS

Contrato individual por campanha, aceite eletrônico com evidências, benefício vinculado ao parceiro (só ele valida o QR Code) e métricas agregadas.

## Fluxo

1. **Admin → Parceiros → Novo parceiro**: empresa (CNPJ/CPF validado), representante legal, contato operacional e login do portal (vincular conta existente ou criar acesso com senha temporária, exibida uma única vez).
2. **Novo contrato**: o formulário é a cláusula 3 (Resumo Comercial). Ao salvar, o contrato individual é gerado com o Termo v1.0 + os dados do parceiro. Dá para salvar rascunho ou enviar direto para aceite. Cada edição cria uma nova versão (trilha em `partner_campaign_revisions`).
3. **Portal do parceiro → Contratos**: o representante revisa o Resumo, abre o Termo integral, marca a declaração de poderes e confirma a senha. O servidor só aceita se a versão e o hash SHA-256 forem exatamente os exibidos.
4. **No aceite**: registro imutável (versão do Termo, versão do Resumo, hash, data/hora, usuário, método de autenticação, IP, navegador, cópia dos dados do parceiro e da oferta), certificado `PRX-CERT-AAAA-XXXX-XXXX` e publicação automática do benefício no catálogo.
5. **Resgate**: o voucher herda o parceiro dono. O validador recusa voucher de outro parceiro sem revelar dados dele. Vigência, limite por membro, quantidade garantida e prazo de uso vêm do contrato.

Documentos imprimíveis (Ctrl+P → PDF): `GET /api/partners/document?campaignId=…&kind=contract|certificate`, para o admin ou para o parceiro dono.

## Implantação (ordem importa)

1. Aplicar `supabase/migrations/20260925_prx_partner_program.sql` no Supabase. É idempotente e funciona sobre os schemas 00001 e 00002.
2. Publicar o código.
3. No admin, cadastrar cada parceiro existente e vincular o login dele (contas com papel "partner" sem empresa aparecem num aviso na aba Parceiros).
4. Em **Benefícios**, atribuir um parceiro a cada benefício antigo.

**Atenção:** benefício sem parceiro sai do catálogo e ninguém consegue validar o QR Code dele. Isso é intencional (cada benefício pertence a um parceiro), mas significa que, entre os passos 2 e 4, os benefícios antigos ficam fora do ar. Sem o passo 1, o catálogo fica vazio e as rotas de parceiros respondem 503 com a instrução da migração.

## Variáveis de ambiente

| Nome | Uso |
|---|---|
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | Link da Política de Privacidade na tela de aceite (cláusula 1.2). Sem ela, o link não aparece. |

## Dados e LGPD

- O balcão vê só o primeiro nome do membro (antes via e-mail mascarado).
- `benefit_events` guarda exibições e cliques **sem identidade**: benefício, parceiro, faixa etária e data.
- Métricas de idade usam `profiles.birth_date` e são agregadas. Grupos com menos de 5 pessoas são ocultados, com supressão secundária para impedir dedução por subtração.
- `partner_contract_acceptances` e `partner_campaign_revisions` têm trigger que bloqueia UPDATE e DELETE, inclusive pela service role.
- IP e navegador do aceite aparecem só para o admin.

## Pendências conhecidas

- **Envio da cópia por e-mail**: a cópia fica disponível na Área do Parceiro (cláusula 1.3). Envio por e-mail precisa de um provedor (Resend, SES…).
- **Troca de senha no primeiro acesso**: o login criado pelo admin usa senha temporária; ainda não há fluxo de troca.
- **Um login por parceiro**: vários usuários por parceiro (cláusula 10.3) exigem uma tabela de membros do parceiro.
- **Compra no app (modalidade c)**: depende do checkout/PSP com split, ainda não implementado. "Vendas estimadas" usa preço PRX × validações.
- **Nova versão do Termo**: ao mudar o texto, suba `TERMS_VERSION` e mantenha o template antigo para que contratos já aceitos continuem verificando o hash.
- **Escala das métricas**: hoje a agregação é em memória sobre até 50 mil eventos por consulta. Com volume maior, mover para uma view/RPC agregada no Postgres.

## Testes

```bash
npm test                                             # domínio: CPF/CNPJ, contrato, hash, métricas
BASE=http://localhost:3000 node scripts/e2e-partners.mjs   # fluxo completo, sem Supabase
```

## Notas jurídicas para a revisão (Anexo Jurídico da proposta)

- **Oferta**: o CDC vincula o fornecedor à oferta; por isso a quantidade é garantida e travada no sistema, e a cláusula 5.4 prevê multa por descumprimento reiterado.
- **Mídia**: planos Básico, Spotlight, Prime e Takeover são proposta comercial própria da PRX (valores em `lib/partners/plans.ts`), inspirados na lógica pública de marketplaces, sem reproduzir contrato de terceiros. Mídia paga aparece como "Patrocinado" (cláusula 8.6).
- **Público adolescente**: o ECA Digital veda perfilamento para publicidade a crianças e adolescentes; o parceiro recebe só métricas agregadas.
- **Aceite**: clickwrap com reautenticação por senha, registro de versão, hash, data/hora e autoria.
- **Revisão recomendada** antes de produção: advogado de contratos digitais/LGPD e contador (comissão, split, emissão fiscal e repasses).
