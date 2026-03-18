alter table public.presencial_agendas
add column if not exists amigo_secreto_ativo boolean not null default false,
add column if not exists amigo_secreto_regras text,
add column if not exists amigo_secreto_sorteado_at timestamptz;

create table if not exists public.presencial_amigo_secreto (
  id                  uuid primary key default gen_random_uuid(),
  agenda_id           uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id      uuid not null references public.colaboradores(id) on delete cascade,
  tirou_colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (agenda_id, colaborador_id),
  unique (agenda_id, tirou_colaborador_id),
  check (colaborador_id <> tirou_colaborador_id)
);

create index if not exists presencial_amigo_secreto_agenda_idx
  on public.presencial_amigo_secreto(agenda_id);

create index if not exists presencial_amigo_secreto_colaborador_idx
  on public.presencial_amigo_secreto(colaborador_id);

alter table public.presencial_amigo_secreto enable row level security;

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
  github text
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
    c.github
  from public.presencial_amigo_secreto s
  join public.colaboradores c on c.id = s.tirou_colaborador_id
  where s.colaborador_id = auth.uid();
$$;

grant execute on function public.run_amigo_secreto_draw(uuid) to authenticated;
grant execute on function public.get_my_amigo_secreto_results() to authenticated;
