create table if not exists public.aniversario_parabenizacoes (
  id uuid primary key default gen_random_uuid(),
  aniversariante_id uuid not null references public.colaboradores(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  ano_ref int not null default extract(year from now())::int,
  created_at timestamptz not null default now(),
  unique(aniversariante_id, colaborador_id, ano_ref)
);

alter table public.aniversario_parabenizacoes enable row level security;

drop policy if exists "aniv_parab: leitura autenticados" on public.aniversario_parabenizacoes;
create policy "aniv_parab: leitura autenticados"
  on public.aniversario_parabenizacoes for select
  using (auth.role() = 'authenticated');

drop policy if exists "aniv_parab: colaborador insere" on public.aniversario_parabenizacoes;
create policy "aniv_parab: colaborador insere"
  on public.aniversario_parabenizacoes for insert
  with check (auth.uid() = colaborador_id);

drop policy if exists "aniv_parab: colaborador deleta" on public.aniversario_parabenizacoes;
create policy "aniv_parab: colaborador deleta"
  on public.aniversario_parabenizacoes for delete
  using (auth.uid() = colaborador_id);
