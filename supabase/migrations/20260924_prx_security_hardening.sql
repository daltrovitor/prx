-- ============================================================================
-- PRX — ENDURECIMENTO DE SEGURANÇA (24/09/2026)
--
-- Contexto: todas as escritas do app acontecem nas rotas /api com a service
-- role. Os papéis anon/authenticated do PostgREST não precisam gravar nada nas
-- tabelas de negócio. Hoje a política "Users can update only their own profile"
-- permite que um usuário logado direto no Supabase (a anon key é pública)
-- altere o próprio nxt_score, nxt_level, wallet_balance e, dependendo da
-- migração aplicada, até o role.
--
-- Esta migração:
--   1. Remove escrita direta de anon/authenticated nas tabelas de negócio.
--   2. Mantém leitura conforme as políticas RLS já existentes.
--   3. Copia o papel (role) de profiles para auth.users.raw_app_meta_data,
--      que só a service role consegue escrever. O código agora confia apenas
--      em profiles.role e app_metadata.role (nunca em user_metadata).
--
-- É idempotente: pode ser executada mais de uma vez.
-- ============================================================================

begin;

-- 1. Sem escrita direta pelo cliente nas tabelas de negócio -------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'benefits', 'missions', 'vouchers', 'referrals',
    'user_missions', 'categories', 'partners', 'orders', 'auth_logs'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Perfil: o próprio usuário pode, no máximo, trocar nome e foto.
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- 2. Papel confiável em app_metadata ------------------------------------------
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id
  and p.role in ('admin', 'partner', 'staff')
  and coalesce(u.raw_app_meta_data ->> 'role', '') is distinct from p.role;

commit;

-- ----------------------------------------------------------------------------
-- Conferência (rodar depois, somente leitura):
--   select p.email, p.role, u.raw_app_meta_data ->> 'role' as app_role,
--          u.raw_user_meta_data ->> 'role' as user_meta_role
--   from public.profiles p join auth.users u on u.id = p.id
--   where p.role <> 'user' or (u.raw_user_meta_data ->> 'role') is not null;
--
-- Contas que só tinham o papel em user_metadata (ex.: parceiros criados antes
-- da coluna profiles.role aceitar 'partner') precisam ser revisadas à mão e
-- promovidas pelo painel admin, que agora grava em app_metadata.
-- ----------------------------------------------------------------------------
