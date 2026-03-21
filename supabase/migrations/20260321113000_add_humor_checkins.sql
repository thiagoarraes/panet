create table public.humor_checkins (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  data_ref date not null default current_date,
  humor_id text not null,
  energia smallint not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint humor_checkins_unique unique (colaborador_id, data_ref),
  constraint humor_checkins_humor_id_check check (
    humor_id in ('rocket', 'flow', 'zen', 'focus', 'steady', 'storm', 'low', 'fire')
  ),
  constraint humor_checkins_energia_check check (energia between 1 and 10),
  constraint humor_checkins_tags_limit check (coalesce(array_length(tags, 1), 0) <= 4)
);

create index humor_checkins_data_ref_idx on public.humor_checkins(data_ref desc, updated_at desc);
create index humor_checkins_colaborador_idx on public.humor_checkins(colaborador_id, data_ref desc);

create or replace function public.set_humor_checkins_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_humor_checkins_updated_at
before update on public.humor_checkins
for each row
execute function public.set_humor_checkins_updated_at();

alter table public.humor_checkins enable row level security;

create policy "humor_checkins: leitura autenticados"
  on public.humor_checkins for select
  using (auth.role() = 'authenticated');

create policy "humor_checkins: colaborador insere proprio"
  on public.humor_checkins for insert
  with check (auth.uid() = colaborador_id);

create policy "humor_checkins: colaborador atualiza proprio"
  on public.humor_checkins for update
  using (auth.uid() = colaborador_id)
  with check (auth.uid() = colaborador_id);

create policy "humor_checkins: colaborador remove proprio"
  on public.humor_checkins for delete
  using (auth.uid() = colaborador_id);
