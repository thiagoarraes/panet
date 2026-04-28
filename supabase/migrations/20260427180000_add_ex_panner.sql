-- Migration: add_ex_panner
-- Soft-delete system for ex-collaborators ("Ex Panners").
-- Sets ativo = false + bans auth user; data is preserved for internal use.

-- ── 1. Add ativo column ───────────────────────────────────────────────────────
alter table public.colaboradores
  add column if not exists ativo boolean not null default true;

-- ── 2. Partial index for faster active-only queries ───────────────────────────
create index if not exists idx_colaboradores_ativo_true
  on public.colaboradores (id)
  where ativo = true;

-- ── 3. Update current_user_is_admin() – ex-panners lose admin rights ──────────
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.colaboradores c
    where c.id = auth.uid()
      and c.perfil = 'admin'::public.perfil_acesso
      and c.ativo = true
  );
$$;

-- ── 4. Update current_user_has_admin_module() – ex-panners lose module access ─
create or replace function public.current_user_has_admin_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.colaboradores c
    where c.id = auth.uid()
      and c.perfil = 'admin'::public.perfil_acesso
      and c.ativo = true
      and (
        c.admin_modulos is null
        or p_module = any(c.admin_modulos)
      )
  );
$$;

-- ── 5. SELECT policy: regular users see only active; admins see all ────────────
drop policy if exists "colaboradores: leitura autenticados" on public.colaboradores;
create policy "colaboradores: leitura autenticados"
  on public.colaboradores for select
  to authenticated
  using (ativo = true or public.current_user_has_admin_module('colaboradores'));

-- ── 6. Prevent users from self-toggling ativo ─────────────────────────────────
drop policy if exists "colaboradores: update proprio seguro" on public.colaboradores;
create policy "colaboradores: update proprio seguro"
  on public.colaboradores for update
  to authenticated
  using ((select auth.uid()) = id)
  with check (
    id = (select auth.uid())
    and ativo is not distinct from (
      select c.ativo from public.colaboradores c where c.id = (select auth.uid())
    )
    and email is not distinct from (
      select c.email from public.colaboradores c where c.id = (select auth.uid())
    )
    and perfil is not distinct from (
      select c.perfil from public.colaboradores c where c.id = (select auth.uid())
    )
    and admin_modulos is not distinct from (
      select c.admin_modulos from public.colaboradores c where c.id = (select auth.uid())
    )
    and created_at is not distinct from (
      select c.created_at from public.colaboradores c where c.id = (select auth.uid())
    )
    and (
      primeiro_acesso is not distinct from (
        select c.primeiro_acesso from public.colaboradores c where c.id = (select auth.uid())
      )
      or (
        (
          select c.primeiro_acesso from public.colaboradores c where c.id = (select auth.uid())
        ) = true
        and primeiro_acesso = false
      )
    )
  );

-- ── 7. get_public_ausencias() – exclude ex-panners ───────────────────────────
drop function if exists public.get_public_ausencias();
create function public.get_public_ausencias()
returns table (
  id uuid,
  inicio timestamptz,
  fim timestamptz,
  estimativa text,
  dia_todo boolean,
  colaborador_id uuid,
  nome text,
  cargo text,
  cor_avatar text,
  foto_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.inicio,
    a.fim,
    a.estimativa,
    a.dia_todo,
    c.id as colaborador_id,
    c.nome,
    c.cargo,
    c.cor_avatar,
    c.foto_url
  from public.ausencias a
  join public.colaboradores c on c.id = a.colaborador_id and c.ativo = true
  where auth.uid() is not null
  order by a.inicio desc;
$$;

grant execute on function public.get_public_ausencias() to authenticated;

-- ── 8. get_dashboard_snapshot (5-param) – exclude ex-panners ─────────────────
create or replace function public.get_dashboard_snapshot(
  p_posts_limit int default 20,
  p_mural_limit int default 60,
  p_ferias_limit int default 120,
  p_ausencias_limit int default 120,
  p_colaboradores_limit int default 500
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_posts_limit int := greatest(1, least(coalesce(p_posts_limit, 20), 100));
  v_mural_limit int := greatest(1, least(coalesce(p_mural_limit, 60), 200));
  v_ferias_limit int := greatest(1, least(coalesce(p_ferias_limit, 120), 500));
  v_ausencias_limit int := greatest(1, least(coalesce(p_ausencias_limit, 120), 500));
  v_colaboradores_limit int := greatest(1, least(coalesce(p_colaboradores_limit, 500), 1000));
  v_current_year int := extract(year from now())::int;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  with
    post_base as (
      select
        p.id,
        p.titulo,
        p.descricao,
        p.imagem_url,
        p.categoria,
        p.data_post,
        p.created_at
      from public.postagens p
      order by p.data_post desc, p.created_at desc
      limit v_posts_limit
    ),
    post_ids as (
      select pb.id from post_base pb
    ),
    post_likes as (
      select
        c.postagem_id,
        array_agg(c.colaborador_id order by c.colaborador_id asc) as curtidas
      from public.curtidas c
      join post_ids ids on ids.id = c.postagem_id
      group by c.postagem_id
    ),
    post_comments as (
      select
        cm.postagem_id,
        count(*)::int as comentarios_count
      from public.comentarios cm
      join post_ids ids on ids.id = cm.postagem_id
      group by cm.postagem_id
    ),
    postagens_json as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', pb.id,
              'titulo', pb.titulo,
              'descricao', pb.descricao,
              'imagem_url', pb.imagem_url,
              'categoria', pb.categoria,
              'data_post', pb.data_post,
              'created_at', pb.created_at,
              'curtidas', coalesce(to_jsonb(pl.curtidas), '[]'::jsonb),
              'comentarios_count', coalesce(pc.comentarios_count, 0),
              'user_curtiu', coalesce(v_user_id = any(pl.curtidas), false)
            )
            order by pb.data_post desc, pb.created_at desc
          ),
          '[]'::jsonb
        ) as value
      from post_base pb
      left join post_likes pl on pl.postagem_id = pb.id
      left join post_comments pc on pc.postagem_id = pb.id
    ),
    mural_json as (
      -- historical messages from ex-panners are intentionally preserved
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'texto', m.texto,
              'created_at', m.created_at,
              'colaborador_id', m.colaborador_id,
              'colaborador', jsonb_build_object(
                'id', c.id,
                'nome', c.nome,
                'cargo', c.cargo,
                'cor_avatar', c.cor_avatar,
                'foto_url', c.foto_url
              )
            )
            order by m.created_at desc
          ),
          '[]'::jsonb
        ) as value
      from (
        select mm.id, mm.texto, mm.created_at, mm.colaborador_id
        from public.mural mm
        order by mm.created_at desc
        limit v_mural_limit
      ) m
      join public.colaboradores c on c.id = m.colaborador_id
    ),
    ferias_json as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', f.id,
              'inicio', f.inicio,
              'fim', f.fim,
              'status', f.status,
              'tipo', f.tipo,
              'colaborador', jsonb_build_object(
                'id', c.id,
                'nome', c.nome,
                'cargo', c.cargo,
                'cor_avatar', c.cor_avatar,
                'foto_url', c.foto_url
              )
            )
            order by f.inicio asc
          ),
          '[]'::jsonb
        ) as value
      from (
        select ff.id, ff.inicio, ff.fim, ff.status, ff.tipo, ff.colaborador_id
        from public.ferias ff
        order by ff.inicio asc
        limit v_ferias_limit
      ) f
      join public.colaboradores c on c.id = f.colaborador_id and c.ativo = true
    ),
    ausencias_json as (
      -- get_public_ausencias() already filters c.ativo = true
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'inicio', a.inicio,
              'fim', a.fim,
              'estimativa', a.estimativa,
              'dia_todo', a.dia_todo,
              'colaborador', jsonb_build_object(
                'id', a.colaborador_id,
                'nome', a.nome,
                'cargo', a.cargo,
                'cor_avatar', a.cor_avatar,
                'foto_url', a.foto_url
              )
            )
            order by a.inicio desc
          ),
          '[]'::jsonb
        ) as value
      from (
        select *
        from public.get_public_ausencias()
        order by inicio desc
        limit v_ausencias_limit
      ) a
    ),
    aniversarios_json as (
      select
        coalesce(
          jsonb_agg(to_jsonb(aniv) order by aniv.nome asc),
          '[]'::jsonb
        ) as value
      from public.get_aniversariantes_with_reacoes(v_current_year) aniv
    ),
    colaboradores_json as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'nome', c.nome,
              'cargo', c.cargo,
              'cor_avatar', c.cor_avatar,
              'foto_url', c.foto_url,
              'aniversario', c.aniversario
            )
            order by c.nome asc
          ),
          '[]'::jsonb
        ) as value
      from (
        select cc.id, cc.nome, cc.cargo, cc.cor_avatar, cc.foto_url, cc.aniversario
        from public.colaboradores cc
        where cc.ativo = true
        order by cc.nome asc
        limit v_colaboradores_limit
      ) c
    )
  select jsonb_build_object(
    'postagens', p.value,
    'mural',     m.value,
    'ferias',    f.value,
    'ausencias', a.value,
    'aniversarios', an.value,
    'colaboradores', c.value
  )
  into v_snapshot
  from postagens_json p
  cross join mural_json m
  cross join ferias_json f
  cross join ausencias_json a
  cross join aniversarios_json an
  cross join colaboradores_json c;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

grant execute on function public.get_dashboard_snapshot(int, int, int, int, int) to authenticated;
