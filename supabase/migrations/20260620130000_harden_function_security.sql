-- Hardening de segurança (advisors Supabase, todos WARN — nenhum crítico).

-- 1) Fixa search_path nas funções que estavam mutáveis (advisor 0011
--    function_search_path_mutable). Evita sequestro de search_path.
alter function public.set_humor_checkins_updated_at() set search_path = public;
alter function public.set_enquetes_updated_at() set search_path = public;
alter function public.get_aniversariantes_with_reacoes(integer) set search_path = public;

-- 2) get_public_ausencias é SECURITY DEFINER (ignora RLS) e estava executável por
--    `anon` via /rest/v1/rpc — um não-autenticado conseguia listar nome/cargo/foto
--    e período de ausência dos colaboradores. O dashboard (que exige login) a chama
--    internamente como SECURITY DEFINER, então revogar de `anon` NÃO quebra o fluxo.
--    Mantém `authenticated`.
revoke execute on function public.get_public_ausencias() from anon;
