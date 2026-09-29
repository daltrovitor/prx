-- Hello World
-- ============================================================================
-- PRX — NOTIFICAÇÕES: E-MAIL DE BOAS-VINDAS E CONFIRMAÇÃO DO CELULAR NO WHATSAPP
-- (30/09/2026)
--
-- 1. profiles.phone / phone_verified_at: celular confirmado por código no
--    WhatsApp. Um número confirmado pertence a uma única conta.
-- 2. phone_verifications: códigos de 6 dígitos guardados só como HMAC, com
--    validade (10 min), tentativas (5) e uso único.
-- 3. notification_log: registro de envios (e-mail e WhatsApp) com destinatário
--    mascarado e o resultado do provedor. Nunca guarda conteúdo nem código.
--
-- Idempotente. Aplique depois de 20260929_prx_bank_kyc_consent.sql.
-- ============================================================================

begin;

-- 1. CELULAR CONFIRMADO NO PERFIL ---------------------------------------------------
alter table public.profiles add column if not exists phone text check (phone is null or phone ~ '^[1-9][0-9]9[0-9]{8}$');
alter table public.profiles add column if not exists phone_verified_at timestamptz;

create unique index if not exists profiles_phone_verified_unique
  on public.profiles(phone) where phone is not null and phone_verified_at is not null;

-- 2. CÓDIGOS DE CONFIRMAÇÃO ------------------------------------------------------------
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null check (phone ~ '^[1-9][0-9]9[0-9]{8}$'),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts between 0 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists phone_verifications_user_idx on public.phone_verifications(user_id, created_at desc);
create index if not exists phone_verifications_open_idx on public.phone_verifications(user_id) where consumed_at is null;

-- 3. REGISTRO DE ENVIOS -------------------------------------------------------------------
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  template text not null check (template in ('welcome_email', 'phone_code')),
  recipient text not null,
  status text not null check (status in ('sent', 'simulated', 'skipped', 'failed')),
  provider text check (provider in ('resend', 'whatsapp_cloud')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists notification_log_created_idx on public.notification_log(created_at desc);
create index if not exists notification_log_user_idx on public.notification_log(user_id, created_at desc);

-- 4. RLS: SÓ A SERVICE ROLE LÊ E ESCREVE ---------------------------------------------------
alter table public.phone_verifications enable row level security;
alter table public.notification_log enable row level security;
revoke all on public.phone_verifications from anon, authenticated;
revoke all on public.notification_log from anon, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (somente leitura):
--   select channel, template, status, count(*) from public.notification_log group by 1, 2, 3;
--   select count(*) from public.profiles where phone_verified_at is not null;
--   delete from public.phone_verifications where created_at < now() - interval '30 days'; -- limpeza periódica
