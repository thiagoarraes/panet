-- Security hardening:
-- 1) prevent self privilege escalation in public.colaboradores
-- 2) enforce admin_modulos in backend policies
-- 3) expose ausencias to regular users only through a sanitized RPC
-- 4) restrict avatar uploads to the caller namespace

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
  );
$$;

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
      and (
        c.admin_modulos is null
        or p_module = any(c.admin_modulos)
      )
  );
$$;

create or replace function public.get_public_ausencias()
returns table (
  id uuid,
  inicio timestamptz,
  fim timestamptz,
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
    c.id as colaborador_id,
    c.nome,
    c.cargo,
    c.cor_avatar,
    c.foto_url
  from public.ausencias a
  join public.colaboradores c on c.id = a.colaborador_id
  where auth.uid() is not null
  order by a.inicio desc;
$$;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_has_admin_module(text) to authenticated;
grant execute on function public.get_public_ausencias() to authenticated;

-- colaboradores
drop policy if exists "colaboradores: update próprio ou admin" on public.colaboradores;
drop policy if exists "colaboradores: update proprio ou admin" on public.colaboradores;
drop policy if exists "colaboradores: editar próprio" on public.colaboradores;
drop policy if exists "colaboradores: admin insert" on public.colaboradores;
drop policy if exists "colaboradores: admin delete" on public.colaboradores;
drop policy if exists "colaboradores: admin update" on public.colaboradores;
drop policy if exists "colaboradores: editar proprio" on public.colaboradores;

create policy "colaboradores: update proprio seguro"
  on public.colaboradores for update
  to authenticated
  using ((select auth.uid()) = id)
  with check (
    id = (select auth.uid())
    and email is not distinct from (
      select c.email
      from public.colaboradores c
      where c.id = (select auth.uid())
    )
    and perfil is not distinct from (
      select c.perfil
      from public.colaboradores c
      where c.id = (select auth.uid())
    )
    and admin_modulos is not distinct from (
      select c.admin_modulos
      from public.colaboradores c
      where c.id = (select auth.uid())
    )
    and created_at is not distinct from (
      select c.created_at
      from public.colaboradores c
      where c.id = (select auth.uid())
    )
    and (
      primeiro_acesso is not distinct from (
        select c.primeiro_acesso
        from public.colaboradores c
        where c.id = (select auth.uid())
      )
      or (
        (
          select c.primeiro_acesso
          from public.colaboradores c
          where c.id = (select auth.uid())
        ) = true
        and primeiro_acesso = false
      )
    )
  );

create policy "colaboradores: admin update"
  on public.colaboradores for update
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'))
  with check (public.current_user_has_admin_module('colaboradores'));

create policy "colaboradores: admin insert"
  on public.colaboradores for insert
  to authenticated
  with check (public.current_user_has_admin_module('colaboradores'));

create policy "colaboradores: admin delete"
  on public.colaboradores for delete
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'));

-- aniversarios
drop policy if exists "aniversarios: admin insere" on public.aniversarios;
drop policy if exists "aniversarios: admin atualiza" on public.aniversarios;
drop policy if exists "aniversarios: admin deleta" on public.aniversarios;
drop policy if exists "aniversarios: admin gerencia" on public.aniversarios;

create policy "aniversarios: admin insere"
  on public.aniversarios for insert
  to authenticated
  with check (public.current_user_has_admin_module('colaboradores'));

create policy "aniversarios: admin atualiza"
  on public.aniversarios for update
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'))
  with check (public.current_user_has_admin_module('colaboradores'));

create policy "aniversarios: admin deleta"
  on public.aniversarios for delete
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'));

-- ausencias
drop policy if exists "ausencias: leitura autenticados" on public.ausencias;
drop policy if exists "ausencias: admin insere" on public.ausencias;
drop policy if exists "ausencias: admin atualiza" on public.ausencias;
drop policy if exists "ausencias: admin deleta" on public.ausencias;
drop policy if exists "ausencias: admin gerencia" on public.ausencias;

create policy "ausencias: leitura admin ferias"
  on public.ausencias for select
  to authenticated
  using (public.current_user_has_admin_module('ferias'));

create policy "ausencias: admin insere"
  on public.ausencias for insert
  to authenticated
  with check (public.current_user_has_admin_module('ferias'));

create policy "ausencias: admin atualiza"
  on public.ausencias for update
  to authenticated
  using (public.current_user_has_admin_module('ferias'))
  with check (public.current_user_has_admin_module('ferias'));

create policy "ausencias: admin deleta"
  on public.ausencias for delete
  to authenticated
  using (public.current_user_has_admin_module('ferias'));

-- ferias
drop policy if exists "ferias: admin insere" on public.ferias;
drop policy if exists "ferias: admin atualiza" on public.ferias;
drop policy if exists "ferias: admin deleta" on public.ferias;
drop policy if exists "ferias: admin gerencia" on public.ferias;

create policy "ferias: admin insere"
  on public.ferias for insert
  to authenticated
  with check (public.current_user_has_admin_module('ferias'));

create policy "ferias: admin atualiza"
  on public.ferias for update
  to authenticated
  using (public.current_user_has_admin_module('ferias'))
  with check (public.current_user_has_admin_module('ferias'));

create policy "ferias: admin deleta"
  on public.ferias for delete
  to authenticated
  using (public.current_user_has_admin_module('ferias'));

-- postagens
drop policy if exists "postagens: admin insere" on public.postagens;
drop policy if exists "postagens: admin atualiza" on public.postagens;
drop policy if exists "postagens: admin deleta" on public.postagens;
drop policy if exists "postagens: admin escreve" on public.postagens;

create policy "postagens: admin insere"
  on public.postagens for insert
  to authenticated
  with check (public.current_user_has_admin_module('postagens'));

create policy "postagens: admin atualiza"
  on public.postagens for update
  to authenticated
  using (public.current_user_has_admin_module('postagens'))
  with check (public.current_user_has_admin_module('postagens'));

create policy "postagens: admin deleta"
  on public.postagens for delete
  to authenticated
  using (public.current_user_has_admin_module('postagens'));

-- presencial_agendas
drop policy if exists "presencial_agendas: admin insere" on public.presencial_agendas;
drop policy if exists "presencial_agendas: admin atualiza" on public.presencial_agendas;
drop policy if exists "presencial_agendas: admin deleta" on public.presencial_agendas;
drop policy if exists "presencial_agendas: admin gerencia" on public.presencial_agendas;

create policy "presencial_agendas: admin insere"
  on public.presencial_agendas for insert
  to authenticated
  with check (public.current_user_has_admin_module('presencial'));

create policy "presencial_agendas: admin atualiza"
  on public.presencial_agendas for update
  to authenticated
  using (public.current_user_has_admin_module('presencial'))
  with check (public.current_user_has_admin_module('presencial'));

create policy "presencial_agendas: admin deleta"
  on public.presencial_agendas for delete
  to authenticated
  using (public.current_user_has_admin_module('presencial'));

-- galeria_eventos
drop policy if exists "galeria_eventos: admin insere" on public.galeria_eventos;
drop policy if exists "galeria_eventos: admin atualiza" on public.galeria_eventos;
drop policy if exists "galeria_eventos: admin deleta" on public.galeria_eventos;
drop policy if exists "galeria: admin gerencia eventos" on public.galeria_eventos;

create policy "galeria_eventos: admin insere"
  on public.galeria_eventos for insert
  to authenticated
  with check (public.current_user_has_admin_module('galeria'));

create policy "galeria_eventos: admin atualiza"
  on public.galeria_eventos for update
  to authenticated
  using (public.current_user_has_admin_module('galeria'))
  with check (public.current_user_has_admin_module('galeria'));

create policy "galeria_eventos: admin deleta"
  on public.galeria_eventos for delete
  to authenticated
  using (public.current_user_has_admin_module('galeria'));

-- galeria_fotos
drop policy if exists "galeria_fotos: admin insere" on public.galeria_fotos;
drop policy if exists "galeria_fotos: admin atualiza" on public.galeria_fotos;
drop policy if exists "galeria_fotos: admin deleta" on public.galeria_fotos;
drop policy if exists "galeria: admin gerencia fotos" on public.galeria_fotos;

create policy "galeria_fotos: admin insere"
  on public.galeria_fotos for insert
  to authenticated
  with check (public.current_user_has_admin_module('galeria'));

create policy "galeria_fotos: admin atualiza"
  on public.galeria_fotos for update
  to authenticated
  using (public.current_user_has_admin_module('galeria'))
  with check (public.current_user_has_admin_module('galeria'));

create policy "galeria_fotos: admin deleta"
  on public.galeria_fotos for delete
  to authenticated
  using (public.current_user_has_admin_module('galeria'));

-- storage
drop policy if exists "storage avatares: upload autenticado" on storage.objects;
drop policy if exists "storage postagens: upload admin" on storage.objects;
drop policy if exists "storage galeria: upload admin" on storage.objects;
drop policy if exists "storage avatares: delete proprio ou admin" on storage.objects;
drop policy if exists "storage postagens: delete admin" on storage.objects;
drop policy if exists "storage galeria: delete admin" on storage.objects;

create policy "storage avatares: upload proprio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "storage avatares: delete proprio ou admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatares'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.current_user_has_admin_module('colaboradores')
    )
  );

create policy "storage postagens: upload admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'postagens'
    and public.current_user_has_admin_module('postagens')
  );

create policy "storage postagens: delete admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'postagens'
    and public.current_user_has_admin_module('postagens')
  );

create policy "storage galeria: upload admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'galeria'
    and public.current_user_has_admin_module('galeria')
  );

create policy "storage galeria: delete admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'galeria'
    and public.current_user_has_admin_module('galeria')
  );

-- presencial RPC hardening
create or replace function public.run_amigo_secreto_draw(p_agenda_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  participantes uuid[];
  participante_count integer;
begin
  if not public.current_user_has_admin_module('presencial') then
    raise exception 'Apenas administradores com acesso ao módulo presencial podem iniciar o sorteio.';
  end if;

  if not exists (
    select 1
    from public.presencial_agendas
    where id = p_agenda_id and amigo_secreto_ativo = true
  ) then
    raise exception 'O amigo secreto não está ativo neste evento.';
  end if;

  if exists (
    select 1
    from public.presencial_agendas
    where id = p_agenda_id and amigo_secreto_sorteado_at is not null
  ) then
    raise exception 'O sorteio já foi iniciado neste evento.';
  end if;

  select coalesce(array_agg(colaborador_id order by random()), '{}'::uuid[])
  into participantes
  from public.presencial_confirmacoes
  where agenda_id = p_agenda_id
    and status = 'talvez';

  participante_count := coalesce(array_length(participantes, 1), 0);

  if participante_count < 2 then
    raise exception 'São necessários ao menos 2 participantes para o sorteio.';
  end if;

  delete from public.presencial_amigo_secreto
  where agenda_id = p_agenda_id;

  insert into public.presencial_amigo_secreto (agenda_id, colaborador_id, tirou_colaborador_id)
  select
    p_agenda_id,
    participantes[idx],
    participantes[((idx % participante_count) + 1)]
  from generate_subscripts(participantes, 1) as idx;

  update public.presencial_agendas
  set amigo_secreto_sorteado_at = now()
  where id = p_agenda_id;

  return participante_count;
end;
$$;

create or replace function public.get_dashboard_snapshot(
  p_posts_limit int default 20,
  p_mural_limit int default 60
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
  v_current_year int := extract(year from now())::int;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
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
      from public.ferias f
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
      from public.get_public_ausencias() a
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
      from public.colaboradores c
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
