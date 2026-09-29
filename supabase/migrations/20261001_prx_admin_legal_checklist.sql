-- Hello World
-- ============================================================================
-- PRX — ANDAMENTO DO CHECKLIST JURÍDICO E REGULATÓRIO (01/10/2026)
--
-- O texto dos itens mora no código (lib/legal/checklist-data.ts). Esta tabela
-- guarda só o andamento que o time registra na aba "Jurídico" do painel admin:
-- status, responsável, parecer e quem alterou por último.
-- Sem esta tabela, o painel funciona com o andamento na memória do servidor.
--
-- Idempotente. Aplique depois de 20260930_prx_notifications.sql.
-- ============================================================================

begin;

create table if not exists public.legal_checklist (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'done', 'blocker')),
  responsible text not null default '' check (char_length(responsible) <= 120),
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Só a service role (rotas do admin) lê e grava.
alter table public.legal_checklist enable row level security;
revoke all on public.legal_checklist from anon, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (somente leitura):
--   select status, count(*) from public.legal_checklist group by 1;
