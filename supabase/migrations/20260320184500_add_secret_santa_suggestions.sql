create table if not exists public.presencial_amigo_secreto_sugestoes (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  sugestao        text not null,
  created_at      timestamptz not null default now(),
  unique (agenda_id, colaborador_id),
  check (char_length(btrim(sugestao)) between 1 and 280)
);

create index if not exists presencial_amigo_secreto_sugestoes_colaborador_agenda_idx
  on public.presencial_amigo_secreto_sugestoes(colaborador_id, agenda_id);

alter table public.presencial_amigo_secreto_sugestoes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'presencial_amigo_secreto_sugestoes'
      and policyname = 'presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria'
  ) then
    create policy presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria
      on public.presencial_amigo_secreto_sugestoes for all
      using (auth.uid() = colaborador_id)
      with check (auth.uid() = colaborador_id);
  end if;
end
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
  where s.colaborador_id = auth.uid();
$$;

grant execute on function public.get_my_amigo_secreto_results() to authenticated;
