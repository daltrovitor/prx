-- Hello World
-- ============================================================================
-- PRX — CONTAS DE FAMÍLIA, BIOMETRIA E ANÁLISE DE BOM COMPORTAMENTO
-- (28/09/2026)
--
-- 1. PRX Coins: toda conta nova começa com 0 (sem bônus de boas-vindas).
-- 2. Fila de análise de bom comportamento (behavior_claims): coins só entram
--    depois da aprovação da equipe.
-- 3. Biometria / reconhecimento facial (webauthn_credentials): só a chave
--    pública de cada aparelho, nunca a biometria.
-- 4. Contas de família: identidade com CPF único e nascimento, Conta Pai
--    (análise com documentos), emancipação de 16–17 anos, vínculos
--    responsável–filho, mesada automática e limites de gasto do menor.
-- 5. Bucket privado family-docs para RG, CPF, CNH e certidões.
--
-- Idempotente. Tudo é escrito pelas rotas /api com a service role; o cliente
-- só lê o que é dele. Aplique depois de 20260927_prx_points_reels_finance.sql.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- 1. PRX COINS COMEÇAM EM ZERO -------------------------------------------------
alter table public.profiles alter column prx_coins set default 0;

create or replace function public.prx_guard_signup_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if session_user = 'supabase_auth_admin' then
    new.nxt_score := 250;
    new.nxt_level := 1;
    new.prx_coins := 0;
  end if;
  return new;
end;
$$;

-- 2. ANÁLISE DE BOM COMPORTAMENTO ----------------------------------------------
create table if not exists public.behavior_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null default '',
  user_email text not null default '',
  rule_id uuid references public.behavior_point_rules(id) on delete set null,
  rule_title text not null,
  coins integer not null default 0 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  evidence text not null check (char_length(evidence) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists behavior_claims_user_idx on public.behavior_claims(user_id, created_at desc);
create index if not exists behavior_claims_status_idx on public.behavior_claims(status, created_at);
-- Um envio em análise por regra e membro.
create unique index if not exists behavior_claims_one_pending on public.behavior_claims(user_id, rule_id) where status = 'pending' and rule_id is not null;

-- 3. BIOMETRIA (WEBAUTHN / PASSKEYS) ---------------------------------------------
create table if not exists public.webauthn_credentials (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  device_name text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists webauthn_credentials_user_idx on public.webauthn_credentials(user_id);

-- 4. CONTAS DE FAMÍLIA -------------------------------------------------------------
create table if not exists public.family_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('member', 'minor', 'parent')),
  status text not null check (status in ('active', 'link_pending', 'emancipation_pending', 'parent_review', 'rejected')),
  -- CPF só com dígitos; um CPF, uma conta PRX.
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  birth_date date not null,
  parent_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists family_identities_cpf_key on public.family_identities(cpf);
create index if not exists family_identities_parent_idx on public.family_identities(parent_user_id);

create table if not exists public.family_parent_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null default '',
  profession text not null,
  income_range text not null check (income_range in ('ate_3k', '3k_6k', '6k_10k', '10k_20k', 'acima_20k')),
  child_name text not null,
  child_birth_date date not null,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists family_parent_applications_status_idx on public.family_parent_applications(status, created_at desc);
create index if not exists family_parent_applications_user_idx on public.family_parent_applications(user_id, created_at desc);
create unique index if not exists family_parent_applications_one_pending on public.family_parent_applications(user_id) where status = 'pending';

create table if not exists public.family_emancipation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists family_emancipation_status_idx on public.family_emancipation_requests(status, created_at desc);
create unique index if not exists family_emancipation_one_pending on public.family_emancipation_requests(user_id) where status = 'pending';

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  -- Nulo enquanto o responsável (informado por e-mail) ainda não tem Conta Pai.
  parent_user_id uuid references auth.users(id) on delete cascade,
  parent_email text not null,
  child_user_id uuid not null references auth.users(id) on delete cascade,
  child_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists family_links_parent_idx on public.family_links(parent_user_id, status);
create index if not exists family_links_parent_email_idx on public.family_links(parent_email) where parent_user_id is null;
create index if not exists family_links_child_idx on public.family_links(child_user_id, status);
create unique index if not exists family_links_active_pair on public.family_links(parent_user_id, child_user_id) where status <> 'revoked' and parent_user_id is not null;

create table if not exists public.family_allowances (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  child_user_id uuid not null unique references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 5000),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  weekday smallint not null default 1 check (weekday between 0 and 6),
  month_day smallint not null default 5 check (month_day between 1 and 28),
  active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists family_allowances_due_idx on public.family_allowances(next_run_at) where active;

-- Cada período de mesada é pago uma única vez (idempotência do agendador).
create table if not exists public.family_allowance_runs (
  id uuid primary key default gen_random_uuid(),
  allowance_id uuid not null references public.family_allowances(id) on delete cascade,
  period_key text not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (allowance_id, period_key)
);

create table if not exists public.family_spending_limits (
  child_user_id uuid primary key references auth.users(id) on delete cascade,
  per_transaction numeric(12, 2) not null default 100 check (per_transaction >= 0),
  daily numeric(12, 2) not null default 150 check (daily >= 0),
  monthly numeric(12, 2) not null default 600 check (monthly >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 5. RLS: ESCRITA SÓ PELA SERVICE ROLE; LEITURA DO QUE É DO PRÓPRIO USUÁRIO --------
do $$
declare
  t text;
begin
  foreach t in array array[
    'behavior_claims', 'webauthn_credentials', 'family_identities', 'family_parent_applications',
    'family_emancipation_requests', 'family_links', 'family_allowances', 'family_allowance_runs', 'family_spending_limits'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Chaves de biometria, documentos e execuções de mesada nunca são lidos pelo cliente.
revoke all on public.webauthn_credentials from anon, authenticated;
revoke all on public.family_allowance_runs from anon, authenticated;
revoke all on public.family_parent_applications from anon, authenticated;
revoke all on public.family_emancipation_requests from anon, authenticated;

drop policy if exists "Members view own claims" on public.behavior_claims;
create policy "Members view own claims" on public.behavior_claims
  for select using (auth.uid() = user_id);

drop policy if exists "Users view own family identity" on public.family_identities;
create policy "Users view own family identity" on public.family_identities
  for select using (auth.uid() = user_id or auth.uid() = parent_user_id);

drop policy if exists "Family members view own links" on public.family_links;
create policy "Family members view own links" on public.family_links
  for select using (auth.uid() = parent_user_id or auth.uid() = child_user_id);

drop policy if exists "Family members view allowance" on public.family_allowances;
create policy "Family members view allowance" on public.family_allowances
  for select using (auth.uid() = parent_user_id or auth.uid() = child_user_id);

drop policy if exists "Family members view limits" on public.family_spending_limits;
create policy "Family members view limits" on public.family_spending_limits
  for select using (
    auth.uid() = child_user_id
    or exists (select 1 from public.family_links l where l.child_user_id = family_spending_limits.child_user_id and l.parent_user_id = auth.uid() and l.status = 'active')
  );

-- 6. BUCKET PRIVADO DOS DOCUMENTOS -----------------------------------------------
-- Privado e sem políticas para anon/authenticated: só a service role cria URLs
-- assinadas de envio (pasta do próprio usuário) e de leitura (admin, 60 s).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-docs', 'family-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (somente leitura):
--   select account_type, status, count(*) from public.family_identities group by 1, 2;
--   select status, count(*) from public.family_parent_applications group by 1;
--   select status, count(*) from public.behavior_claims group by 1;
-- Agendador da mesada: Vercel Cron em /api/cron/allowances (vercel.json), com CRON_SECRET.
