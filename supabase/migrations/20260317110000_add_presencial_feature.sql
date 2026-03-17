create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create type public.status_presencial as enum ('aberto', 'encerrado', 'cancelado');
create type public.resposta_presencial as enum ('confirmado', 'talvez');

create table public.presencial_agendas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data_presencial date not null,
  local text,
  observacao text,
  vagas int not null default 0,
  status public.status_presencial not null default 'aberto',
  created_at timestamptz not null default now()
);

create table public.presencial_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  status public.resposta_presencial not null default 'confirmado',
  observacao text,
  created_at timestamptz not null default now(),
  unique (agenda_id, colaborador_id)
);

create index presencial_agendas_data_idx on public.presencial_agendas(data_presencial desc);
create index presencial_confirmacoes_agenda_idx on public.presencial_confirmacoes(agenda_id, status);
create index presencial_confirmacoes_colaborador_idx on public.presencial_confirmacoes(colaborador_id);

alter table public.presencial_agendas enable row level security;
alter table public.presencial_confirmacoes enable row level security;

create policy "presencial_agendas: leitura autenticados"
  on public.presencial_agendas for select
  using (auth.role() = 'authenticated');

create policy "presencial_agendas: admin gerencia"
  on public.presencial_agendas for all
  using (
    exists (
      select 1
      from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

create policy "presencial_confirmacoes: leitura autenticados"
  on public.presencial_confirmacoes for select
  using (auth.role() = 'authenticated');

create policy "presencial_confirmacoes: colaborador gerencia propria"
  on public.presencial_confirmacoes for all
  using (auth.uid() = colaborador_id)
  with check (auth.uid() = colaborador_id);
