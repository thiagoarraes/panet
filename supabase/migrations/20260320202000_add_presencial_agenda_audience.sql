create table if not exists public.presencial_agenda_convidados (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (agenda_id, colaborador_id)
);

create index if not exists presencial_agenda_convidados_agenda_idx
  on public.presencial_agenda_convidados(agenda_id);

create index if not exists presencial_agenda_convidados_colaborador_idx
  on public.presencial_agenda_convidados(colaborador_id);

alter table public.presencial_agenda_convidados enable row level security;

create or replace function public.can_access_presencial_agenda(p_agenda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.colaboradores c
        where c.id = auth.uid()
          and c.perfil = 'admin'::public.perfil_acesso
      )
      or not exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
      )
      or exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
          and pac.colaborador_id = auth.uid()
      )
    )
  );
$$;

create or replace function public.can_participate_presencial_agenda(p_agenda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    auth.uid() is not null
    and (
      not exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
      )
      or exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
          and pac.colaborador_id = auth.uid()
      )
    )
  );
$$;

grant execute on function public.can_access_presencial_agenda(uuid) to authenticated;
grant execute on function public.can_participate_presencial_agenda(uuid) to authenticated;

drop policy if exists "presencial_agendas: leitura autenticados" on public.presencial_agendas;
drop policy if exists "presencial_agendas: admin gerencia" on public.presencial_agendas;
drop policy if exists presencial_agendas_leitura_autorizados on public.presencial_agendas;
drop policy if exists presencial_agendas_admin_gerencia on public.presencial_agendas;

create policy presencial_agendas_leitura_autorizados
  on public.presencial_agendas for select
  to authenticated
  using (public.can_access_presencial_agenda(id));

create policy presencial_agendas_admin_gerencia
  on public.presencial_agendas for all
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

drop policy if exists "presencial_confirmacoes: leitura autenticados" on public.presencial_confirmacoes;
drop policy if exists "presencial_confirmacoes: colaborador gerencia propria" on public.presencial_confirmacoes;
drop policy if exists presencial_confirmacoes_leitura_autorizados on public.presencial_confirmacoes;
drop policy if exists presencial_confirmacoes_colaborador_gerencia_propria on public.presencial_confirmacoes;
drop policy if exists presencial_confirmacoes_admin_remove on public.presencial_confirmacoes;

create policy presencial_confirmacoes_leitura_autorizados
  on public.presencial_confirmacoes for select
  to authenticated
  using (public.can_access_presencial_agenda(agenda_id));

create policy presencial_confirmacoes_colaborador_gerencia_propria
  on public.presencial_confirmacoes for all
  to authenticated
  using (
    auth.uid() = colaborador_id
    and public.can_participate_presencial_agenda(agenda_id)
  )
  with check (
    auth.uid() = colaborador_id
    and public.can_participate_presencial_agenda(agenda_id)
  );

create policy presencial_confirmacoes_admin_remove
  on public.presencial_confirmacoes for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

drop policy if exists presencial_agenda_convidados_admin_gerencia on public.presencial_agenda_convidados;

create policy presencial_agenda_convidados_admin_gerencia
  on public.presencial_agenda_convidados for all
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

drop policy if exists presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria on public.presencial_amigo_secreto_sugestoes;
drop policy if exists presencial_amigo_secreto_sugestoes_admin_remove on public.presencial_amigo_secreto_sugestoes;

create policy presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria
  on public.presencial_amigo_secreto_sugestoes for all
  to authenticated
  using (
    auth.uid() = colaborador_id
    and public.can_participate_presencial_agenda(agenda_id)
  )
  with check (
    auth.uid() = colaborador_id
    and public.can_participate_presencial_agenda(agenda_id)
  );

create policy presencial_amigo_secreto_sugestoes_admin_remove
  on public.presencial_amigo_secreto_sugestoes for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = auth.uid()
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create or replace function public.run_amigo_secreto_draw(p_agenda_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  participantes uuid[];
  participante_count integer;
  actor_is_admin boolean;
begin
  select exists (
    select 1
    from public.colaboradores
    where id = auth.uid() and perfil = 'admin'
  ) into actor_is_admin;

  if not actor_is_admin then
    raise exception 'Apenas administradores podem iniciar o sorteio.';
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

  select coalesce(array_agg(pc.colaborador_id order by random()), '{}'::uuid[])
  into participantes
  from public.presencial_confirmacoes pc
  where pc.agenda_id = p_agenda_id
    and pc.status = 'talvez'
    and (
      not exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
      )
      or exists (
        select 1
        from public.presencial_agenda_convidados pac
        where pac.agenda_id = p_agenda_id
          and pac.colaborador_id = pc.colaborador_id
      )
    );

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

create or replace function public.get_my_amigo_secreto_results()
returns table (
  agenda_id uuid,
  tirou_colaborador_id uuid,
  nome text,
  cargo text,
  email text,
  telefone text,
  cor_avatar text,
  foto_url text,
  instagram text,
  linkedin text,
  github text,
  sugestao text
)
language sql
security definer
set search_path = public
as $$
  select
    s.agenda_id,
    c.id as tirou_colaborador_id,
    c.nome,
    c.cargo,
    c.email,
    c.telefone,
    c.cor_avatar,
    c.foto_url,
    c.instagram,
    c.linkedin,
    c.github,
    sgs.sugestao
  from public.presencial_amigo_secreto s
  join public.colaboradores c on c.id = s.tirou_colaborador_id
  left join public.presencial_amigo_secreto_sugestoes sgs
    on sgs.agenda_id = s.agenda_id
   and sgs.colaborador_id = s.tirou_colaborador_id
  where s.colaborador_id = auth.uid()
    and public.can_access_presencial_agenda(s.agenda_id);
$$;

grant execute on function public.run_amigo_secreto_draw(uuid) to authenticated;
grant execute on function public.get_my_amigo_secreto_results() to authenticated;
