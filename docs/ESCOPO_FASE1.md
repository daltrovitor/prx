# PRX × ViraWeb: escopo da Fase 1 (lançamento)

A partir da proposta apresentada e do alinhamento sobre a estratégia de lançamento da PRX, a relação de fornecedor de tecnologia passa a ser uma parceria de longo prazo, combinando investimento financeiro e participação societária.

A prioridade do lançamento é colocar no mercado, ao mesmo tempo, os três pilares iniciais:

**PRX PASS + PRX BANK + PRX LIVE**

O PRX INVEST e o PRX ME ficam para uma segunda etapa. Como houve diferenças de entendimento sobre o escopo desses dois módulos, funcionalidades e valores serão revistos depois.

Status de cada item: **Pronto** = funcionando no app · **Demonstração** = interface completa com dados locais, aguardando integração · **Pendente** = ainda não iniciado.

---

## PRX PASS: clube de benefícios e fundação

| Item | Status |
|---|---|
| Arquitetura base do app mobile (PWA) e painel web administrativo | Pronto |
| Cadastro e autenticação (e-mail e senha, login social Google) | Pronto |
| Verificação OTP | Pendente |
| Perfil com régua de pontuação e gamificação (PRX SCORE) | Pronto |
| Catálogo de parceiros por categoria (Gastronomia, Moda, Viagens, Tecnologia…) | Pronto |
| Página do benefício com logo, detalhes e percentual | Pronto |
| Voucher com QR Code e código único | Pronto |
| QR dinâmico temporizado anti-fraude (`lib/security.ts` pronto, falta ligar ao voucher) | Pendente |
| Histórico de cupons resgatados e utilizados | Pronto |
| Orquestrador de pagamentos desacoplado (PaymentProvider) e split | Pendente |
| Integração PSP (Pagar.me ou Mercado Pago) para Pix, cartão e boleto | Pendente |
| Portal do parceiro com leitura de QR pela câmera e baixa | Pronto |

## PRX BANK: conta digital via BaaS (ver [PLANO_BAAS.md](PLANO_BAAS.md))

| Item | Status |
|---|---|
| Conexão BaaS (Celcoin, Dock ou similar) | Pendente (plano pronto) |
| Saldo e extrato com filtros de período e tipo | Demonstração |
| Pix por chave (CPF/CNPJ, e-mail, telefone, aleatória) | Demonstração |
| Pix Copia e Cola e QR de cobrança (BR Code EMV com CRC válido) | Demonstração |
| Leitor de QR para pagar | Demonstração |
| Cartão virtual, bloqueio e desbloqueio | Demonstração |
| Pedido e rastreio do cartão físico | Demonstração |
| Carteira Central (saldo + cupons do PASS + pontos) | Pronto (tela Início) |

## PRX LIVE: eventos, ingressos e corridas

| Item | Status |
|---|---|
| Vitrine de eventos (PRX Founders, PRX Session, Ctrl + PRX, PRX Talks) | Pronto (catálogo fixo no código) |
| PRX UP: lote → checkout → ingresso com QR na carteira | Demonstração |
| Controle de portaria (validação do QR do ingresso, sem duplicidade) | Pendente |
| PRX RUN: inscrição, modalidade, categoria, camiseta, termo, QR do kit | Demonstração |
| PRX RUN: resultados pós-evento | Demonstração (dados de exemplo) |
| PRX FOUNDERS: submissão com pitch deck e vídeo | Demonstração |
| PRX FOUNDERS: esteira Enviada → Em análise → Selecionada | Demonstração (falta o painel do avaliador) |
