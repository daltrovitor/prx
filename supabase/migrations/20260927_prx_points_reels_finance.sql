-- Hello World
-- ============================================================================
-- PRX 2.0 — PONTOS (PRX COINS), NÍVEIS INFINITOS, REELS, FINANCEIRO E LGPD
-- (27/09/2026)
--
-- 1. PRX Coins no perfil (começam em 0) e régua de níveis infinita
--    (xp_for_level(n) = floor(250 · (n − 1)^1.65)).
-- 2. Regras de bom comportamento (behavior_point_rules) e extrato imutável
--    de coins e XP (point_transactions), creditados só por função atômica.
-- 3. Reels de parceiros (partner_reels) e reações por membro.
-- 4. Economia dos benefícios: preço em coins, custo, receita por resgate e
--    comissão sobre compras no parceiro.
-- 5. Compras em parceiros via Pix/BACEN (partner_bacen_transactions).
-- 6. Lista de espera VIP do prx.app.br e aceite dos Termos/LGPD no perfil.
-- 7. Funções de segurança e RLS: nada disso é gravável pelo cliente.
--
-- Idempotente. As rotas /api continuam escrevendo com a service role; as
-- políticas abaixo só liberam leitura do que é do próprio membro.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- 1. PERFIL: PRX COINS E ACEITE DOS TERMOS ------------------------------------
alter table public.profiles add column if not exists prx_coins integer not null default 0;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_prx_coins_non_negative') then
    alter table public.profiles add constraint profiles_prx_coins_non_negative check (prx_coins >= 0);
  end if;
end $$;

-- Régua infinita, espelho de lib/pass-data.ts.
create or replace function public.prx_xp_for_level(p_level integer)
returns bigint
language sql
immutable
set search_path = public
as $$
  select floor(250 * power(greatest(coalesce(p_level, 1), 1) - 1, 1.65))::bigint;
$$;

create or replace function public.prx_level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_level integer;
begin
  if p_xp is null or p_xp < 250 then
    return 1;
  end if;
  v_level := floor(power(p_xp / 250.0, 1 / 1.65))::integer + 1;
  while public.prx_xp_for_level(v_level + 1) <= p_xp loop
    v_level := v_level + 1;
  end loop;
  while v_level > 1 and public.prx_xp_for_level(v_level) > p_xp loop
    v_level := v_level - 1;
  end loop;
  return v_level;
end;
$$;

-- Cadastro direto no Supabase Auth (anon key pública) não escolhe XP, nível
-- nem coins: o gatilho handle_new_user copiava nxt_score do user_metadata,
-- que o próprio usuário escreve. Perfis criados pelo GoTrue nascem no padrão.
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

drop trigger if exists profiles_guard_signup on public.profiles;
create trigger profiles_guard_signup
  before insert on public.profiles
  for each row execute function public.prx_guard_signup_profile();

-- Metas de nível de eventos e benefícios deixam de parar no 7.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.live_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%min_prx_level%'
  loop
    execute format('alter table public.live_events drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'live_events_min_prx_level_positive') then
    alter table public.live_events add constraint live_events_min_prx_level_positive check (min_prx_level >= 1);
  end if;
exception when undefined_table then null;
end $$;

-- 2. REGRAS DE BOM COMPORTAMENTO -----------------------------------------------
create table if not exists public.behavior_point_rules (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '',
  trigger text not null check (trigger in ('checkin', 'partner_purchase', 'benefit_redeem', 'voucher_use')),
  coins_reward integer not null default 0 check (coins_reward between 0 and 100000),
  xp_reward integer not null default 0 check (xp_reward between 0 and 1000000),
  periodicity text not null default 'weekly' check (periodicity in ('once', 'daily', 'weekly', 'monthly', 'per_event')),
  category text not null default 'geral' check (category in ('financas', 'bem-estar', 'comunidade', 'compras', 'fidelidade', 'geral')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint behavior_rules_reward check (coins_reward > 0 or xp_reward > 0),
  constraint behavior_rules_periodicity check (
    (trigger = 'checkin' and periodicity <> 'per_event') or (trigger <> 'checkin' and periodicity = 'per_event')
  )
);

-- Mesmas regras padrão de lib/points/rules.ts. A de compra define a taxa de
-- emissão: 10 coins a cada R$ 10 (1 coin por real gasto em parceiro).
-- Check-ins pagam sobretudo XP: seus coins não têm comissão por trás.
insert into public.behavior_point_rules (slug, title, description, trigger, coins_reward, xp_reward, periodicity, category, sort_order) values
  ('semana-sem-apostas', 'Semana sem apostas', 'Build. Don''t Bet: confirme mais uma semana construindo em vez de apostar.', 'checkin', 10, 150, 'weekly', 'financas', 1),
  ('checkin-saudavel', 'Check-in de atividade saudável', 'Treino, corrida, meditação ou terapia: registre o seu dia.', 'checkin', 1, 25, 'daily', 'bem-estar', 2),
  ('habito-financeiro-mes', 'Revisão do mês no PRX Map', 'Olhe para onde foi o seu dinheiro e defina a meta do próximo mês.', 'checkin', 5, 60, 'monthly', 'financas', 3),
  ('compra-parceiro', 'Compra em parceiro PRX', 'Pague um parceiro com Pix pela sua conta PRX e ganhe na hora.', 'partner_purchase', 10, 20, 'per_event', 'compras', 4),
  ('resgate-beneficio', 'Resgate de benefício', 'Cada benefício ativado no PASS conta para o seu nível.', 'benefit_redeem', 0, 50, 'per_event', 'fidelidade', 5),
  ('voucher-usado', 'Voucher usado no parceiro', 'Usou o voucher no balcão? XP de fidelidade liberado.', 'voucher_use', 0, 80, 'per_event', 'fidelidade', 6)
on conflict (slug) do nothing;

-- 3. EXTRATO DE COINS E XP -------------------------------------------------------
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coins_delta integer not null default 0,
  xp_delta integer not null default 0 check (xp_delta >= 0),
  balance_after integer not null check (balance_after >= 0),
  source text not null check (source in ('welcome', 'behavior', 'partner_purchase', 'benefit_redeem', 'voucher_use', 'mission', 'admin_adjustment', 'refund')),
  rule_id uuid references public.behavior_point_rules(id) on delete set null,
  reference_id text,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint point_transactions_nonzero check (coins_delta <> 0 or xp_delta <> 0)
);

create index if not exists point_transactions_user_idx on public.point_transactions(user_id, created_at desc);
create index if not exists point_transactions_claims_idx on public.point_transactions(user_id, rule_id, created_at desc) where source = 'behavior';
-- Idempotência: o mesmo resgate, voucher ou Pix nunca pontua duas vezes.
create unique index if not exists point_transactions_reference_key on public.point_transactions(user_id, source, reference_id) where reference_id is not null;

-- Extrato é evidência: nada se altera. Exclusão só em cascata (LGPD: apagar a conta).
create or replace function public.prx_block_ledger_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Extrato de pontos é imutável (% em %).', tg_op, tg_table_name;
end;
$$;

drop trigger if exists point_transactions_immutable on public.point_transactions;
create trigger point_transactions_immutable
  before update or delete on public.point_transactions
  for each row execute function public.prx_block_ledger_changes();

-- Boas-vindas no extrato para perfis novos e para os que já existiam.
create or replace function public.prx_welcome_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.prx_coins, 0) > 0 then
    insert into public.point_transactions (user_id, coins_delta, xp_delta, balance_after, source, reference_id, description)
    values (new.id, new.prx_coins, 0, new.prx_coins, 'welcome', 'welcome', 'Boas-vindas ao PRX')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_welcome_ledger on public.profiles;
create trigger profiles_welcome_ledger
  after insert on public.profiles
  for each row execute function public.prx_welcome_ledger();

insert into public.point_transactions (user_id, coins_delta, xp_delta, balance_after, source, reference_id, description)
select p.id, p.prx_coins, 0, p.prx_coins, 'welcome', 'welcome', 'Boas-vindas ao PRX'
from public.profiles p
where p.prx_coins > 0
  and not exists (select 1 from public.point_transactions t where t.user_id = p.id and t.source = 'welcome')
on conflict do nothing;

-- Crédito/débito atômico: trava o perfil, respeita a idempotência, impede
-- saldo negativo e recalcula o nível pela régua infinita.
create or replace function public.prx_apply_point_transaction(
  p_user_id uuid,
  p_coins_delta integer,
  p_xp_delta integer,
  p_source text,
  p_rule_id uuid default null,
  p_reference_id text default null,
  p_description text default ''
)
returns table (transaction_id uuid, coins integer, xp integer, level integer, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins integer;
  v_xp integer;
  v_level integer;
  v_id uuid;
begin
  if coalesce(p_xp_delta, 0) < 0 then
    raise exception 'PRX_INVALID_XP';
  end if;

  select pr.prx_coins, pr.nxt_score into v_coins, v_xp from public.profiles pr where pr.id = p_user_id for update;
  if not found then
    raise exception 'PRX_PROFILE_NOT_FOUND';
  end if;
  v_xp := coalesce(v_xp, 0);

  if p_reference_id is not null then
    select t.id into v_id from public.point_transactions t
    where t.user_id = p_user_id and t.source = p_source and t.reference_id = p_reference_id;
    if found then
      return query select v_id, v_coins, v_xp, public.prx_level_for_xp(v_xp), true;
      return;
    end if;
  end if;

  if v_coins + coalesce(p_coins_delta, 0) < 0 then
    raise exception 'PRX_INSUFFICIENT_COINS';
  end if;

  v_coins := v_coins + coalesce(p_coins_delta, 0);
  v_xp := v_xp + coalesce(p_xp_delta, 0);
  v_level := public.prx_level_for_xp(v_xp);

  update public.profiles pr
  set prx_coins = v_coins, nxt_score = v_xp, nxt_level = v_level, updated_at = now()
  where pr.id = p_user_id;

  insert into public.point_transactions (user_id, coins_delta, xp_delta, balance_after, source, rule_id, reference_id, description)
  values (p_user_id, coalesce(p_coins_delta, 0), coalesce(p_xp_delta, 0), v_coins, p_source, p_rule_id, p_reference_id, coalesce(p_description, ''))
  returning id into v_id;

  return query select v_id, v_coins, v_xp, v_level, false;
end;
$$;

create or replace function public.prx_coins_outstanding()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(prx_coins), 0)::bigint from public.profiles;
$$;

-- 4. REELS DE PARCEIROS ----------------------------------------------------------
create table if not exists public.partner_reels (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  partner_name text not null,
  partner_logo text,
  collection text not null default 'descubra' check (collection in ('drops', 'vibe', 'descubra')),
  title text not null check (char_length(title) between 2 and 80),
  caption text not null default '',
  video_url text not null check (video_url ~* '^(https://|/)'),
  poster_url text check (poster_url is null or poster_url ~* '^(https://|/)'),
  cta_kind text not null default 'catalog' check (cta_kind in ('benefit', 'catalog', 'external')),
  cta_label text,
  cta_target text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  saves_count bigint not null default 0 check (saves_count >= 0),
  cta_clicks_count bigint not null default 0 check (cta_clicks_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_reels_cta_target check (
    cta_kind = 'catalog' or (cta_kind = 'benefit' and cta_target is not null) or (cta_kind = 'external' and cta_target ~* '^https://')
  )
);

create index if not exists partner_reels_feed_idx on public.partner_reels(is_active, sort_order, created_at desc);

create table if not exists public.partner_reel_reactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reel_id uuid not null references public.partner_reels(id) on delete cascade,
  kind text not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id, kind)
);

create or replace function public.prx_reel_bump(p_reel_id uuid, p_counter text, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta not between -1 and 1 then
    raise exception 'PRX_INVALID_DELTA';
  end if;
  update public.partner_reels set
    views_count = case when p_counter = 'views' then greatest(0, views_count + p_delta) else views_count end,
    likes_count = case when p_counter = 'likes' then greatest(0, likes_count + p_delta) else likes_count end,
    saves_count = case when p_counter = 'saves' then greatest(0, saves_count + p_delta) else saves_count end,
    cta_clicks_count = case when p_counter = 'cta_clicks' then greatest(0, cta_clicks_count + p_delta) else cta_clicks_count end
  where id = p_reel_id and p_counter in ('views', 'likes', 'saves', 'cta_clicks');
end;
$$;

-- 5. ECONOMIA DOS BENEFÍCIOS --------------------------------------------------------
alter table public.benefits add column if not exists points_cost integer not null default 0;
alter table public.benefits add column if not exists cost_price numeric(10, 2) not null default 0;
alter table public.benefits add column if not exists prx_revenue_per_redemption numeric(10, 2) not null default 0;
alter table public.benefits add column if not exists partner_fee_pct numeric(5, 2) not null default 8.00;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'benefits_economics_valid') then
    alter table public.benefits add constraint benefits_economics_valid check (
      points_cost >= 0 and cost_price >= 0 and prx_revenue_per_redemption >= 0 and partner_fee_pct between 0 and 100
    );
  end if;
end $$;

-- 6. COMPRAS EM PARCEIROS VIA PIX (BACEN) ------------------------------------------
create table if not exists public.partner_bacen_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  partner_name text not null,
  category_id text not null,
  -- Identificador fim a fim do Pix no SPI: o mesmo Pix nunca pontua duas vezes.
  end_to_end_id text not null unique,
  pix_key text,
  amount numeric(14, 2) not null check (amount > 0),
  fee_pct numeric(5, 2) not null check (fee_pct between 0 and 100),
  commission_amount numeric(14, 2) not null check (commission_amount >= 0),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  match_method text not null check (match_method in ('document', 'pix_key', 'name')),
  status text not null default 'settled' check (status in ('settled', 'reversed')),
  source text not null default 'baas_webhook' check (source in ('sandbox', 'baas_webhook')),
  created_at timestamptz not null default now()
);

create index if not exists partner_bacen_user_idx on public.partner_bacen_transactions(user_id, created_at desc);
create index if not exists partner_bacen_partner_idx on public.partner_bacen_transactions(partner_id, created_at desc);
create index if not exists partner_bacen_created_idx on public.partner_bacen_transactions(created_at desc);

-- Extrato do banco ganha o nicho do gasto (PRX Map) e o parceiro reconhecido.
do $$
begin
  if to_regclass('public.bank_transactions') is not null then
    alter table public.bank_transactions add column if not exists category_id text;
    alter table public.bank_transactions add column if not exists partner_id uuid references public.partners(id) on delete set null;
  end if;
end $$;

-- 7. LISTA DE ESPERA VIP (prx.app.br) ----------------------------------------------
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text,
  source text not null default 'prx.app.br',
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 8. ACESSO ------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'behavior_point_rules', 'point_transactions', 'partner_reels', 'partner_reel_reactions',
    'partner_bacen_transactions', 'waitlist_signups'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on public.waitlist_signups from anon, authenticated;

drop policy if exists "Public can view active reels" on public.partner_reels;
create policy "Public can view active reels" on public.partner_reels
  for select using (is_active = true);

drop policy if exists "Admins manage reels" on public.partner_reels;
create policy "Admins manage reels" on public.partner_reels
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Members view active point rules" on public.behavior_point_rules;
create policy "Members view active point rules" on public.behavior_point_rules
  for select using (is_active = true);

drop policy if exists "Admins manage point rules" on public.behavior_point_rules;
create policy "Admins manage point rules" on public.behavior_point_rules
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Members view own point transactions" on public.point_transactions;
create policy "Members view own point transactions" on public.point_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Members view own partner purchases" on public.partner_bacen_transactions;
create policy "Members view own partner purchases" on public.partner_bacen_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Members view own reel reactions" on public.partner_reel_reactions;
create policy "Members view own reel reactions" on public.partner_reel_reactions
  for select using (auth.uid() = user_id);

-- Funções de escrita: só a service role (rotas /api) executa.
revoke all on function public.prx_apply_point_transaction(uuid, integer, integer, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.prx_coins_outstanding() from public, anon, authenticated;
revoke all on function public.prx_reel_bump(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.prx_welcome_ledger() from public, anon, authenticated;
revoke all on function public.prx_guard_signup_profile() from public, anon, authenticated;
revoke all on function public.prx_block_ledger_changes() from public, anon, authenticated;
grant execute on function public.prx_apply_point_transaction(uuid, integer, integer, text, uuid, text, text) to service_role;
grant execute on function public.prx_coins_outstanding() to service_role;
grant execute on function public.prx_reel_bump(uuid, text, integer) to service_role;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (somente leitura):
--   select public.prx_level_for_xp(0), public.prx_level_for_xp(250), public.prx_level_for_xp(8000);  -- 1, 2, 9
--   select id, prx_coins, nxt_score, nxt_level from public.profiles order by nxt_score desc limit 10;
--   select source, count(*), sum(coins_delta) from public.point_transactions group by source;
-- ----------------------------------------------------------------------------
