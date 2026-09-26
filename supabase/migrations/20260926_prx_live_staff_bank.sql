-- ============================================================================
-- PRX — PRX LIVE, EQUIPE PRX E CONTA PRX BANK (26/09/2026)
--
-- 1. PRX LIVE: eventos criados pelo admin, ingressos (reserva aguardando
--    pagamento, gratuito, convite), PRX RUN e submissões do PRX FOUNDERS.
--    Um evento pode ser ligado a um parceiro, que valida os ingressos na porta.
-- 2. Equipe PRX: funcionários (papel "staff") que validam ingressos e
--    benefícios no portal staffprx, com permissões por pessoa.
-- 3. PRX BANK sem o banco parceiro: a conta existe zerada e "em ativação".
--    Nenhum saldo ou extrato é fabricado. Chaves Pix e o cartão físico ficam
--    pré-cadastrados para seguir ao banco na ativação.
--
-- Idempotente. Todo acesso passa pelas rotas /api com a service role:
-- anon e authenticated não leem nem escrevem nestas tabelas.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- 1. PRX LIVE -------------------------------------------------------------------
create table if not exists public.live_events (
  id uuid primary key default gen_random_uuid(),
  series text not null check (series in ('founders', 'session', 'ctrl', 'talks', 'run', 'outro')),
  title text not null,
  summary text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null,
  city text not null,
  address text,
  cover_url text,
  capacity integer check (capacity is null or capacity > 0),
  per_user_limit integer not null default 1 check (per_user_limit between 1 and 20),
  min_prx_level integer not null default 1 check (min_prx_level between 1 and 7),
  partner_id uuid references public.partners(id) on delete set null,
  partner_name text,
  staff_checkin boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  batches jsonb not null default '[]'::jsonb,
  run jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

create index if not exists live_events_status_starts_idx on public.live_events(status, starts_at);
create index if not exists live_events_partner_idx on public.live_events(partner_id) where partner_id is not null;

create table if not exists public.live_tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  event_id uuid not null references public.live_events(id) on delete restrict,
  batch_id text not null,
  batch_name text not null,
  user_id uuid not null,
  user_email text not null,
  holder_name text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'valid', 'used', 'cancelled')),
  source text not null default 'purchase' check (source in ('purchase', 'free', 'invite')),
  run_details jsonb,
  issued_by text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by text,
  checked_in_by_role text check (checked_in_by_role is null or checked_in_by_role in ('admin', 'partner', 'staff')),
  checked_in_by_name text,
  -- Entrada registrada sempre com quem validou e quando.
  constraint live_tickets_used_has_checkin check (status <> 'used' or (checked_in_at is not null and checked_in_by is not null))
);

create index if not exists live_tickets_event_status_idx on public.live_tickets(event_id, status, created_at, id);
create index if not exists live_tickets_user_idx on public.live_tickets(user_id, created_at desc);
create index if not exists live_tickets_checked_in_by_idx on public.live_tickets(checked_in_by, checked_in_at desc) where checked_in_by is not null;

create table if not exists public.live_founders_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text not null,
  user_name text not null,
  startup_name text not null,
  one_liner text not null,
  stage text not null check (stage in ('ideia', 'mvp', 'tracao')),
  video_url text,
  deck_file_name text,
  deck_path text,
  status text not null default 'sent' check (status in ('sent', 'review', 'selected', 'not_selected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_founders_user_idx on public.live_founders_submissions(user_id, created_at desc);
create index if not exists live_founders_status_idx on public.live_founders_submissions(status, created_at desc);

-- Pitch decks em bucket privado: só o admin abre, por link assinado de 5 minutos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('founders', 'founders', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- 2. EQUIPE PRX -----------------------------------------------------------------
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null unique,
  name text not null,
  can_validate_tickets boolean not null default true,
  can_validate_benefits boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. PRX BANK (pré-ativação) -------------------------------------------------------
create table if not exists public.bank_accounts (
  user_id uuid primary key,
  status text not null default 'pending_activation' check (status in ('pending_activation', 'active', 'blocked')),
  balance numeric(14, 2) not null default 0,
  agency text,
  account_number text,
  provider text,
  provider_account_id text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_expiry text,
  card_locked boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sem banco parceiro não existe saldo: conta em ativação é sempre zero.
  constraint bank_accounts_pending_is_zero check (status <> 'pending_activation' or balance = 0)
);

-- Extrato: só o banco parceiro (webhook do BaaS) grava aqui.
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.bank_accounts(user_id) on delete restrict,
  kind text not null check (kind in ('pix_in', 'pix_out', 'card', 'cashback', 'ticket')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  counterparty text,
  description text,
  status text not null default 'settled' check (status in ('pending', 'settled', 'reversed')),
  provider_ref text unique,
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_user_idx on public.bank_transactions(user_id, created_at desc);

create table if not exists public.bank_pix_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  value text not null unique,
  status text not null default 'pending_activation' check (status in ('pending_activation', 'active')),
  provider_ref text,
  created_at timestamptz not null default now()
);

create index if not exists bank_pix_keys_user_idx on public.bank_pix_keys(user_id);

create table if not exists public.bank_pix_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(14, 2) check (amount is null or amount > 0),
  description text,
  payload text not null,
  provider_ref text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bank_pix_charges_user_idx on public.bank_pix_charges(user_id, created_at desc);

create table if not exists public.bank_card_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  address text not null,
  status text not null default 'waiting_activation'
    check (status in ('waiting_activation', 'requested', 'production', 'shipped', 'delivered', 'cancelled')),
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um pedido aberto por membro.
create unique index if not exists bank_card_requests_open_key on public.bank_card_requests(user_id) where status <> 'cancelled';

-- 4. SALDO LEGADO ZERADO ------------------------------------------------------------
-- profiles.wallet_balance era um saldo de demonstração editável. O saldo real
-- agora vive em bank_accounts; a coluna antiga fica sempre zero.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'wallet_balance') then
    update public.profiles set wallet_balance = 0 where wallet_balance is distinct from 0;
  end if;
end $$;

create or replace function public.prx_zero_legacy_wallet() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.wallet_balance := 0;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'wallet_balance') then
    drop trigger if exists profiles_zero_legacy_wallet on public.profiles;
    create trigger profiles_zero_legacy_wallet
      before insert or update of wallet_balance on public.profiles
      for each row execute function public.prx_zero_legacy_wallet();
  end if;
end $$;

-- 5. ACESSO: só a service role --------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'live_events', 'live_tickets', 'live_founders_submissions', 'staff_members',
    'bank_accounts', 'bank_transactions', 'bank_pix_keys', 'bank_pix_charges', 'bank_card_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on function public.prx_zero_legacy_wallet() from public, anon, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- Depois de aplicar:
--   1. Admin → Equipe: cadastre os funcionários (login com senha temporária ou
--      conta existente) e envie o link do portal staffprx.<domínio>.
--   2. Admin → Eventos: crie e publique os eventos; ligue um parceiro quando
--      ele fizer a portaria e deixe "Equipe PRX valida ingressos" conforme o caso.
--   3. DNS / Vercel: adicione o domínio staffprx.<domínio> ao projeto.
--
-- Conferência (somente leitura):
--   select status, count(*) from public.bank_accounts group by status;
--   select count(*) filter (where wallet_balance <> 0) as saldos_legados from public.profiles;
-- ----------------------------------------------------------------------------
