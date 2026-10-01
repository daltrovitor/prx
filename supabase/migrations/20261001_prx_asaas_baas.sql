-- Hello World
-- ============================================================================
-- PRX BANK × ASAAS (BaaS, Instituição de Pagamento — Código Bacen 461)
-- (01/10/2026)
--
-- 1. bank_subaccounts: subconta Asaas de cada correntista. A apiKey da subconta
--    é gravada só cifrada (AES-256-GCM, formato v1:kid:iv:tag:dados) e nunca
--    sai do servidor.
-- 2. bank_webhooks_log: eventos recebidos do Asaas, únicos por event_id
--    (idempotência: evento repetido responde 200 sem reprocessar).
-- 3. bank_notifications: avisos do sino do app (Pix recebido, enviado, boleto…).
-- 4. bank_outgoing_requests: pedidos de saída (Pix por chave, Pix QR Code,
--    boleto). O webhook de validação de saque só aprova o que está aqui.
-- 5. bank_transactions passa a aceitar lançamentos de boleto ("bill").
--
-- Idempotente. Aplique depois de 20261001_prx_admin_legal_checklist.sql.
-- ============================================================================

begin;

-- 1. SUBCONTAS ------------------------------------------------------------------------
create table if not exists public.bank_subaccounts (
  id uuid primary key references auth.users(id) on delete restrict,
  asaas_account_id text unique,
  wallet_id text unique,
  api_key text check (api_key is null or api_key ~ '^v1:[a-z]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  asaas_customer_id text,
  account_number text,
  agency text,
  status text not null default 'pending_activation' check (status in ('pending_activation', 'active', 'blocked', 'rejected')),
  kyc_status text not null default 'PENDING' check (kyc_status in ('PENDING', 'APPROVED', 'REJECTED')),
  reject_reason text,
  environment text not null check (environment in ('sandbox', 'production')),
  -- Trava da criação: impede duas aberturas simultâneas da mesma subconta.
  provisioning_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Subconta criada no Asaas sempre tem id e chave.
  constraint bank_subaccounts_created_has_key check (asaas_account_id is null or api_key is not null)
);

-- 2. LOG DE WEBHOOKS --------------------------------------------------------------------
create table if not exists public.bank_webhooks_log (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  asaas_account_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index if not exists bank_webhooks_log_received_idx on public.bank_webhooks_log(received_at desc);
create index if not exists bank_webhooks_log_pending_idx on public.bank_webhooks_log(received_at) where processed_at is null;

-- 3. NOTIFICAÇÕES DO BANCO -------------------------------------------------------------------
create table if not exists public.bank_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'bank' check (kind = 'bank'),
  event_type text not null,
  title text not null check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 300),
  amount numeric(14, 2),
  -- Um aviso por evento do Asaas.
  event_id text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bank_notifications_user_idx on public.bank_notifications(user_id, created_at desc);

-- 4. PEDIDOS DE SAÍDA (VALIDAÇÃO DE SAQUE) -------------------------------------------------------
create table if not exists public.bank_outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('pix_key', 'pix_qr', 'bill')),
  amount numeric(14, 2) not null check (amount > 0),
  counterparty text not null default '',
  -- Chave Pix, Copia e Cola ou linha digitável (o que foi enviado ao Asaas).
  target text not null,
  description text not null default '',
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'requested', 'approved', 'refused', 'done', 'failed', 'cancelled', 'expired')),
  provider_ref text unique,
  fail_reason text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_outgoing_requests_user_idx on public.bank_outgoing_requests(user_id, created_at desc);

-- 5. EXTRATO: BOLETOS ------------------------------------------------------------------------------
alter table public.bank_transactions drop constraint if exists bank_transactions_kind_check;
alter table public.bank_transactions add constraint bank_transactions_kind_check
  check (kind in ('pix_in', 'pix_out', 'card', 'cashback', 'ticket', 'bill'));

-- 6. ACESSO: SÓ A SERVICE ROLE ----------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['bank_subaccounts', 'bank_webhooks_log', 'bank_notifications', 'bank_outgoing_requests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;

-- ----------------------------------------------------------------------------
-- Depois de aplicar:
--   1. Vercel → Environment Variables: BANK_PROVIDER=asaas, ASAAS_API_KEY,
--      ASAAS_ENVIRONMENT, ASAAS_API_URL, ASAAS_WEBHOOK_AUTH_TOKEN e
--      BANK_ENCRYPTION_KEY (32+ caracteres; não troque depois de criar subcontas).
--   2. Asaas → Mecanismos de segurança: webhook de validação de saque apontando
--      para /api/bank/webhooks/validate-withdraw com o mesmo token.
--
-- Conferência (somente leitura):
--   select status, kyc_status, count(*) from public.bank_subaccounts group by 1, 2;
--   select event_type, count(*), count(*) filter (where processed_at is null) as pendentes
--     from public.bank_webhooks_log group by 1;
--   select status, count(*) from public.bank_outgoing_requests group by 1;
-- ----------------------------------------------------------------------------
