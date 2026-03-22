create table if not exists public.enquetes (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  mostrar_resultado_parcial boolean not null default true,
  encerra_em timestamptz null,
  encerrada_em timestamptz null,
  created_by uuid null references public.colaboradores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enquetes_pergunta_not_blank check (length(btrim(pergunta)) > 0)
);

create table if not exists public.enquete_opcoes (
  id uuid primary key default gen_random_uuid(),
  enquete_id uuid not null references public.enquetes(id) on delete cascade,
  texto text not null,
  ordem smallint not null,
  created_at timestamptz not null default now(),
  constraint enquete_opcoes_texto_not_blank check (length(btrim(texto)) > 0),
  constraint enquete_opcoes_ordem_range check (ordem between 1 and 6),
  constraint enquete_opcoes_enquete_ordem_unique unique (enquete_id, ordem),
  constraint enquete_opcoes_enquete_id_unique unique (enquete_id, id)
);

create table if not exists public.enquete_votos (
  id uuid primary key default gen_random_uuid(),
  enquete_id uuid not null references public.enquetes(id) on delete cascade,
  enquete_opcao_id uuid not null,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint enquete_votos_unique_enquete_colaborador unique (enquete_id, colaborador_id),
  constraint enquete_votos_opcao_fk
    foreign key (enquete_id, enquete_opcao_id)
    references public.enquete_opcoes(enquete_id, id)
    on delete cascade
);

create index if not exists enquetes_created_at_idx on public.enquetes(created_at desc);
create index if not exists enquetes_encerra_em_idx on public.enquetes(encerra_em);
create index if not exists enquete_opcoes_enquete_idx on public.enquete_opcoes(enquete_id, ordem asc);
create index if not exists enquete_votos_enquete_idx on public.enquete_votos(enquete_id);
create index if not exists enquete_votos_opcao_idx on public.enquete_votos(enquete_opcao_id);
create index if not exists enquete_votos_colaborador_idx on public.enquete_votos(colaborador_id);

create or replace function public.set_enquetes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enquetes_updated_at on public.enquetes;
create trigger trg_enquetes_updated_at
before update on public.enquetes
for each row
execute function public.set_enquetes_updated_at();

alter table public.enquetes enable row level security;
alter table public.enquete_opcoes enable row level security;
alter table public.enquete_votos enable row level security;

drop policy if exists "enquetes: leitura autenticados" on public.enquetes;
drop policy if exists "enquetes: admin insere" on public.enquetes;
drop policy if exists "enquetes: admin atualiza" on public.enquetes;
drop policy if exists "enquetes: admin deleta" on public.enquetes;

create policy "enquetes: leitura autenticados"
  on public.enquetes for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "enquetes: admin insere"
  on public.enquetes for insert
  to authenticated
  with check (public.current_user_has_admin_module('enquetes'));

create policy "enquetes: admin atualiza"
  on public.enquetes for update
  to authenticated
  using (public.current_user_has_admin_module('enquetes'))
  with check (public.current_user_has_admin_module('enquetes'));

create policy "enquetes: admin deleta"
  on public.enquetes for delete
  to authenticated
  using (public.current_user_has_admin_module('enquetes'));

drop policy if exists "enquete_opcoes: leitura autenticados" on public.enquete_opcoes;
drop policy if exists "enquete_opcoes: admin insere" on public.enquete_opcoes;
drop policy if exists "enquete_opcoes: admin atualiza" on public.enquete_opcoes;
drop policy if exists "enquete_opcoes: admin deleta" on public.enquete_opcoes;

create policy "enquete_opcoes: leitura autenticados"
  on public.enquete_opcoes for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "enquete_opcoes: admin insere"
  on public.enquete_opcoes for insert
  to authenticated
  with check (public.current_user_has_admin_module('enquetes'));

create policy "enquete_opcoes: admin atualiza"
  on public.enquete_opcoes for update
  to authenticated
  using (public.current_user_has_admin_module('enquetes'))
  with check (public.current_user_has_admin_module('enquetes'));

create policy "enquete_opcoes: admin deleta"
  on public.enquete_opcoes for delete
  to authenticated
  using (public.current_user_has_admin_module('enquetes'));

drop policy if exists "enquete_votos: leitura autenticados" on public.enquete_votos;
drop policy if exists "enquete_votos: colaborador vota proprio" on public.enquete_votos;

create policy "enquete_votos: leitura autenticados"
  on public.enquete_votos for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "enquete_votos: colaborador vota proprio"
  on public.enquete_votos for insert
  to authenticated
  with check (
    auth.uid() = colaborador_id
    and exists (
      select 1
      from public.enquetes e
      where e.id = enquete_id
        and e.encerrada_em is null
        and (e.encerra_em is null or e.encerra_em > now())
    )
    and exists (
      select 1
      from public.enquete_opcoes eo
      where eo.id = enquete_opcao_id
        and eo.enquete_id = enquete_id
    )
  );

grant select, insert, update, delete on table public.enquetes to authenticated;
grant select, insert, update, delete on table public.enquete_opcoes to authenticated;
grant select, insert on table public.enquete_votos to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.enquetes;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.enquete_opcoes;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.enquete_votos;
  exception
    when duplicate_object then null;
  end;
end;
$$;
