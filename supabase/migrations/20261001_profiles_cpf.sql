-- Hello World
-- ============================================================================
-- PRX — CADASTRO COM CPF E CELULAR OBRIGATÓRIOS
-- (01/10/2026)
--
-- 1. profiles.cpf: CPF único do usuário no perfil principal.
-- ============================================================================

begin;

alter table public.profiles add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');
create unique index if not exists profiles_cpf_key on public.profiles(cpf) where cpf is not null;

commit;
