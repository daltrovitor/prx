-- Hello World
-- ============================================================================
-- PRX — ONBOARDING CONDICIONAL: KYC BANCÁRIO E CONSENTIMENTO PARENTAL
-- (29/09/2026)
--
-- O cadastro do ecossistema não pede documentos. Identidade só em dois casos:
-- 1. Abertura do PRX BANK (bank_kyc_applications): CPF, documento com foto,
--    endereço do cartão e declarações do cliente (renda, ocupação, PEP), com
--    trilha antifraude (IP e navegador).
-- 2. Tutela de menores: parentesco, declaração de tutela e consentimento
--    parental explícito e versionado (LGPD, Art. 14) em cada vínculo.
--
-- Idempotente. Aplique depois de 20260928_prx_family_passkeys.sql.
-- ============================================================================

begin;

-- 1. ABERTURA DO PRX BANK --------------------------------------------------------
create table if not exists public.bank_kyc_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(full_name) between 5 and 120),
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  birth_date date not null,
  mother_name text not null check (char_length(mother_name) between 5 and 120),
  phone text not null check (phone ~ '^[1-9][0-9]9[0-9]{8}$'),
  occupation text not null,
  income_range text not null check (income_range in ('ate_3k', '3k_6k', '6k_10k', '10k_20k', 'acima_20k')),
  pep boolean not null default false,
  address jsonb not null,
  documents jsonb not null default '[]'::jsonb,
  minor_path text check (minor_path in ('linked', 'emancipated')),
  risk_flags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  ip text,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists bank_kyc_user_idx on public.bank_kyc_applications(user_id, created_at desc);
create index if not exists bank_kyc_status_idx on public.bank_kyc_applications(status, created_at);
-- Uma abertura em análise por pessoa; um CPF aprovado por conta.
create unique index if not exists bank_kyc_one_pending on public.bank_kyc_applications(user_id) where status = 'pending';
create unique index if not exists bank_kyc_cpf_approved on public.bank_kyc_applications(cpf) where status = 'approved';

-- 2. CONSENTIMENTO PARENTAL NOS VÍNCULOS -------------------------------------------
alter table public.family_links add column if not exists relationship text check (relationship in ('mae', 'pai', 'tutor', 'guardiao'));
alter table public.family_links add column if not exists consent_version text;
alter table public.family_links add column if not exists consent_at timestamptz;
alter table public.family_links add column if not exists consent_ip text;

-- Vínculo ativo sempre tem consentimento registrado (vínculos antigos sem consentimento continuam válidos).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'family_links_active_needs_consent') then
    alter table public.family_links add constraint family_links_active_needs_consent
      check (status <> 'active' or consent_at is not null or approved_at < '2026-09-29'::timestamptz) not valid;
  end if;
end $$;

alter table public.family_parent_applications add column if not exists relationship text check (relationship in ('mae', 'pai', 'tutor', 'guardiao'));

-- 3. RLS: SÓ A SERVICE ROLE LÊ E ESCREVE O KYC ----------------------------------------
alter table public.bank_kyc_applications enable row level security;
revoke all on public.bank_kyc_applications from anon, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (somente leitura):
--   select status, count(*) from public.bank_kyc_applications group by 1;
--   select count(*) from public.family_links where status = 'active' and consent_at is null;
