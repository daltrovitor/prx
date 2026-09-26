-- ============================================================================
-- PRX — PROGRAMA DE PARCEIROS (25/09/2026)
--
-- Parceiros, campanhas (Resumo Comercial da cláusula 3), revisões, aceites
-- eletrônicos imutáveis e eventos de métricas sem identidade.
-- Vincula benefits e vouchers a um parceiro: só o dono valida o QR Code.
--
-- Idempotente. Funciona tanto sobre o schema 00001 (que já criou partners)
-- quanto sobre o 00002 (benefits com partner_name em texto).
-- Todo acesso passa pelas rotas /api com a service role: anon e authenticated
-- não leem nem escrevem nestas tabelas.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- 1. PARCEIROS -----------------------------------------------------------------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partners add column if not exists company_name text;
alter table public.partners add column if not exists document text;
alter table public.partners add column if not exists document_type text;
alter table public.partners add column if not exists category_id text;
alter table public.partners add column if not exists description text;
alter table public.partners add column if not exists logo_url text;
alter table public.partners add column if not exists banner_url text;
alter table public.partners add column if not exists location text;
alter table public.partners add column if not exists status text not null default 'ATIVO';
alter table public.partners add column if not exists owner_id uuid;
alter table public.partners add column if not exists owner_email text;
alter table public.partners add column if not exists representative jsonb not null default '{}'::jsonb;
alter table public.partners add column if not exists contact jsonb not null default '{}'::jsonb;

-- O schema 00001 exigia categoria e local e referenciava categories; o cadastro
-- novo valida isso na API, então as restrições antigas não podem travar o insert.
alter table public.partners alter column category_id drop not null;
alter table public.partners alter column location drop not null;

-- Um login pertence a um único parceiro.
create unique index if not exists partners_owner_id_key on public.partners(owner_id) where owner_id is not null;
create index if not exists partners_document_idx on public.partners(document);

-- 2. BENEFÍCIOS: dono e condições da campanha ----------------------------------
alter table public.benefits add column if not exists partner_id uuid;
alter table public.benefits add column if not exists campaign_id uuid;
alter table public.benefits add column if not exists visibility_plan text not null default 'basico';
alter table public.benefits add column if not exists campaign_starts_at timestamptz;
alter table public.benefits add column if not exists campaign_ends_at timestamptz;
alter table public.benefits add column if not exists campaign_quantity integer;
alter table public.benefits add column if not exists campaign_per_user_limit integer;
alter table public.benefits add column if not exists campaign_usage_days integer;

do $$ begin
  alter table public.benefits
    add constraint benefits_partner_id_fkey foreign key (partner_id) references public.partners(id) on delete set null not valid;
exception when duplicate_object then null;
end $$;

create index if not exists benefits_partner_id_idx on public.benefits(partner_id);

-- 3. VOUCHERS: dono, prazo de uso e quem validou -------------------------------
alter table public.vouchers add column if not exists partner_id uuid;
alter table public.vouchers add column if not exists expires_at timestamptz;
alter table public.vouchers add column if not exists validated_by text;

create index if not exists vouchers_benefit_id_idx on public.vouchers(benefit_id);
create index if not exists vouchers_partner_id_idx on public.vouchers(partner_id);

-- Vouchers antigos herdam o parceiro do benefício, quando já houver um.
update public.vouchers v
set partner_id = b.partner_id
from public.benefits b
where v.benefit_id = b.id and v.partner_id is null and b.partner_id is not null;

-- 4. CAMPANHAS (Resumo Comercial) ----------------------------------------------
create table if not exists public.partner_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'cancelled')),
  version integer not null default 1 check (version >= 1),
  summary jsonb not null,
  benefit_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);

create index if not exists partner_campaigns_partner_idx on public.partner_campaigns(partner_id, created_at desc);

-- 5. REVISÕES DO RESUMO COMERCIAL (trilha de alterações) -----------------------
create table if not exists public.partner_campaign_revisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.partner_campaigns(id) on delete restrict,
  version integer not null,
  summary jsonb not null,
  changed_by text not null,
  changed_at timestamptz not null default now(),
  unique (campaign_id, version)
);

-- 6. ACEITES ELETRÔNICOS -------------------------------------------------------
create table if not exists public.partner_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.partner_campaigns(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  certificate_id text not null unique,
  terms_version text not null,
  campaign_version integer not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  partner_snapshot jsonb not null,
  summary_snapshot jsonb not null,
  declaration text not null,
  accepted_at timestamptz not null,
  user_id text not null,
  user_email text not null,
  auth_method text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists partner_acceptances_partner_idx on public.partner_contract_acceptances(partner_id, accepted_at desc);

-- Aceites e revisões são evidência: nem a service role altera ou apaga.
create or replace function public.prx_block_evidence_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Registro de evidência imutável (% em %).', tg_op, tg_table_name;
end;
$$;

drop trigger if exists partner_acceptances_immutable on public.partner_contract_acceptances;
create trigger partner_acceptances_immutable
  before update or delete on public.partner_contract_acceptances
  for each row execute function public.prx_block_evidence_changes();

drop trigger if exists partner_revisions_immutable on public.partner_campaign_revisions;
create trigger partner_revisions_immutable
  before update or delete on public.partner_campaign_revisions
  for each row execute function public.prx_block_evidence_changes();

-- 7. EVENTOS DE MÉTRICAS (sem identidade do membro) ----------------------------
create table if not exists public.benefit_events (
  id bigint generated always as identity primary key,
  benefit_id uuid not null,
  partner_id uuid not null,
  kind text not null check (kind in ('impression', 'click')),
  age_band text not null default 'nao_informado'
    check (age_band in ('ate_15', '16_17', '18_24', '25_29', '30_mais', 'nao_informado')),
  created_at timestamptz not null default now()
);

create index if not exists benefit_events_benefit_idx on public.benefit_events(benefit_id, created_at desc);

-- 8. PERFIL: data de nascimento para faixas etárias agregadas ------------------
alter table public.profiles add column if not exists birth_date date;

-- 9. ACESSO: só a service role -------------------------------------------------
alter table public.partners enable row level security;
alter table public.partner_campaigns enable row level security;
alter table public.partner_campaign_revisions enable row level security;
alter table public.partner_contract_acceptances enable row level security;
alter table public.benefit_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['partners', 'partner_campaigns', 'partner_campaign_revisions', 'partner_contract_acceptances', 'benefit_events']
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- A política antiga de 00001 expunha parceiros ativos (com CNPJ e contatos) ao público.
drop policy if exists "Public can view active partners" on public.partners;
drop policy if exists "Partners can update own info" on public.partners;

commit;

-- ----------------------------------------------------------------------------
-- Depois de aplicar:
--   1. No painel admin → Parceiros, cadastre cada parceiro e vincule o login.
--   2. Em Benefícios, atribua um parceiro a cada benefício antigo. Benefício sem
--      parceiro sai do catálogo e ninguém consegue validar o QR Code dele.
--
-- Conferência (somente leitura):
--   select count(*) filter (where partner_id is null) as sem_parceiro, count(*) as total from public.benefits;
-- ----------------------------------------------------------------------------
