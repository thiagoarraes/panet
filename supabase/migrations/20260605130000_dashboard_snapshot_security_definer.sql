-- Performance: torna get_dashboard_snapshot SECURITY DEFINER para pular a
-- re-avaliação de RLS por linha nas tabelas internas (postagens, curtidas,
-- comentarios, mural, colaboradores, ferias). A função continua validando
-- auth.uid() no início e só retorna dados que o usuário já vê no dashboard.
-- Corpo idêntico ao de 20260322143000, apenas adicionando `security definer`.
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
security definer
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
      select pb.id
      from post_base pb
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
        select
          mm.id,
          mm.texto,
          mm.created_at,
          mm.colaborador_id
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
        select
          ff.id,
          ff.inicio,
          ff.fim,
          ff.status,
          ff.tipo,
          ff.colaborador_id
        from public.ferias ff
        order by ff.inicio asc
        limit v_ferias_limit
      ) f
      join public.colaboradores c on c.id = f.colaborador_id
    ),
    ausencias_json as (
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
        select
          cc.id,
          cc.nome,
          cc.cargo,
          cc.cor_avatar,
          cc.foto_url,
          cc.aniversario
        from public.colaboradores cc
        order by cc.nome asc
        limit v_colaboradores_limit
      ) c
    )
  select jsonb_build_object(
    'postagens', p.value,
    'mural', m.value,
    'ferias', f.value,
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
