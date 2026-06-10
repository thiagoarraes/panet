-- Jogos: adedonha (StopotS-like) multiplayer em tempo real.
-- Host-autoritativo: o criador da sala controla o avanco de fase/rodada.
-- Salas internas (sem senha/codigo): qualquer colaborador autenticado le e entra.

-- ─── Tabelas ──────────────────────────────────────────────────────────────────

create table if not exists public.jogo_salas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  jogo text not null default 'adedonha',
  host_id uuid not null references public.colaboradores(id) on delete cascade,
  status text not null default 'aguardando',
  config jsonb not null default '{}'::jsonb,
  rodada_atual smallint not null default 0,
  letra_atual text null,
  fase text not null default 'lobby',
  fase_iniciada_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jogo_salas_nome_not_blank check (length(btrim(nome)) > 0),
  constraint jogo_salas_status_valido check (status in ('aguardando', 'jogando', 'encerrada')),
  constraint jogo_salas_fase_valida check (fase in ('lobby', 'preenchimento', 'validacao', 'ranking', 'fim'))
);

create table if not exists public.jogo_jogadores (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.jogo_salas(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  apelido text not null,
  anonimo boolean not null default false,
  pontos_total int not null default 0,
  is_host boolean not null default false,
  conectado boolean not null default true,
  entrou_em timestamptz not null default now(),
  constraint jogo_jogadores_apelido_not_blank check (length(btrim(apelido)) > 0),
  constraint jogo_jogadores_unique_sala_colaborador unique (sala_id, colaborador_id)
);

create table if not exists public.jogo_rodadas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.jogo_salas(id) on delete cascade,
  numero smallint not null,
  letra text not null,
  fase text not null default 'preenchimento',
  iniciada_em timestamptz not null default now(),
  stop_em timestamptz null,
  stop_por uuid null references public.jogo_jogadores(id) on delete set null,
  constraint jogo_rodadas_fase_valida check (fase in ('preenchimento', 'validacao', 'ranking', 'fim')),
  constraint jogo_rodadas_unique_sala_numero unique (sala_id, numero)
);

create table if not exists public.jogo_respostas (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.jogo_rodadas(id) on delete cascade,
  jogador_id uuid not null references public.jogo_jogadores(id) on delete cascade,
  categoria text not null,
  resposta text not null default '',
  created_at timestamptz not null default now(),
  constraint jogo_respostas_unique_rodada_jogador_categoria unique (rodada_id, jogador_id, categoria)
);

create table if not exists public.jogo_validacoes (
  id uuid primary key default gen_random_uuid(),
  resposta_id uuid not null references public.jogo_respostas(id) on delete cascade,
  votante_id uuid not null references public.jogo_jogadores(id) on delete cascade,
  valido boolean not null,
  created_at timestamptz not null default now(),
  constraint jogo_validacoes_unique_resposta_votante unique (resposta_id, votante_id)
);

create table if not exists public.jogo_pontuacoes (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.jogo_rodadas(id) on delete cascade,
  jogador_id uuid not null references public.jogo_jogadores(id) on delete cascade,
  pontos int not null default 0,
  constraint jogo_pontuacoes_unique_rodada_jogador unique (rodada_id, jogador_id)
);

-- ─── Indices ──────────────────────────────────────────────────────────────────

create index if not exists jogo_salas_status_idx on public.jogo_salas(status, created_at desc);
create index if not exists jogo_salas_host_idx on public.jogo_salas(host_id);
create index if not exists jogo_jogadores_sala_idx on public.jogo_jogadores(sala_id);
create index if not exists jogo_jogadores_colaborador_idx on public.jogo_jogadores(colaborador_id);
create index if not exists jogo_rodadas_sala_idx on public.jogo_rodadas(sala_id, numero);
create index if not exists jogo_respostas_rodada_idx on public.jogo_respostas(rodada_id);
create index if not exists jogo_respostas_jogador_idx on public.jogo_respostas(jogador_id);
create index if not exists jogo_validacoes_resposta_idx on public.jogo_validacoes(resposta_id);
create index if not exists jogo_validacoes_votante_idx on public.jogo_validacoes(votante_id);
create index if not exists jogo_pontuacoes_rodada_idx on public.jogo_pontuacoes(rodada_id);
create index if not exists jogo_pontuacoes_jogador_idx on public.jogo_pontuacoes(jogador_id);

-- ─── Trigger updated_at ─────────────────────────────────────────────────────────

create or replace function public.set_jogo_salas_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_jogo_salas_updated_at on public.jogo_salas;
create trigger trg_jogo_salas_updated_at
before update on public.jogo_salas
for each row
execute function public.set_jogo_salas_updated_at();

-- ─── Helpers de autorizacao ─────────────────────────────────────────────────────

-- Verifica se o usuario autenticado e o host da sala informada.
create or replace function public.jogo_is_host(p_sala_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jogo_salas s
    where s.id = p_sala_id and s.host_id = auth.uid()
  );
$$;

-- Verifica se o jogador (linha de jogo_jogadores) pertence ao usuario autenticado.
create or replace function public.jogo_jogador_e_meu(p_jogador_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jogo_jogadores j
    where j.id = p_jogador_id and j.colaborador_id = auth.uid()
  );
$$;

grant execute on function public.jogo_is_host(uuid) to authenticated;
grant execute on function public.jogo_jogador_e_meu(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.jogo_salas enable row level security;
alter table public.jogo_jogadores enable row level security;
alter table public.jogo_rodadas enable row level security;
alter table public.jogo_respostas enable row level security;
alter table public.jogo_validacoes enable row level security;
alter table public.jogo_pontuacoes enable row level security;

-- jogo_salas
drop policy if exists "jogo_salas: leitura autenticados" on public.jogo_salas;
drop policy if exists "jogo_salas: host cria" on public.jogo_salas;
drop policy if exists "jogo_salas: host atualiza" on public.jogo_salas;
drop policy if exists "jogo_salas: host deleta" on public.jogo_salas;

create policy "jogo_salas: leitura autenticados"
  on public.jogo_salas for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_salas: host cria"
  on public.jogo_salas for insert
  to authenticated
  with check ((select auth.uid()) = host_id);

create policy "jogo_salas: host atualiza"
  on public.jogo_salas for update
  to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "jogo_salas: host deleta"
  on public.jogo_salas for delete
  to authenticated
  using ((select auth.uid()) = host_id);

-- jogo_jogadores
drop policy if exists "jogo_jogadores: leitura autenticados" on public.jogo_jogadores;
drop policy if exists "jogo_jogadores: entra proprio" on public.jogo_jogadores;
drop policy if exists "jogo_jogadores: atualiza proprio ou host" on public.jogo_jogadores;
drop policy if exists "jogo_jogadores: remove proprio ou host" on public.jogo_jogadores;

create policy "jogo_jogadores: leitura autenticados"
  on public.jogo_jogadores for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_jogadores: entra proprio"
  on public.jogo_jogadores for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "jogo_jogadores: atualiza proprio ou host"
  on public.jogo_jogadores for update
  to authenticated
  using ((select auth.uid()) = colaborador_id or public.jogo_is_host(sala_id))
  with check ((select auth.uid()) = colaborador_id or public.jogo_is_host(sala_id));

create policy "jogo_jogadores: remove proprio ou host"
  on public.jogo_jogadores for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id or public.jogo_is_host(sala_id));

-- jogo_rodadas (host cria/avanca; jogador da sala so pode gravar STOP via update)
drop policy if exists "jogo_rodadas: leitura autenticados" on public.jogo_rodadas;
drop policy if exists "jogo_rodadas: host insere" on public.jogo_rodadas;
drop policy if exists "jogo_rodadas: host ou stop atualiza" on public.jogo_rodadas;

create policy "jogo_rodadas: leitura autenticados"
  on public.jogo_rodadas for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_rodadas: host insere"
  on public.jogo_rodadas for insert
  to authenticated
  with check (public.jogo_is_host(sala_id));

-- Host pode tudo; qualquer jogador da sala pode atualizar (usado para gravar STOP).
create policy "jogo_rodadas: host ou stop atualiza"
  on public.jogo_rodadas for update
  to authenticated
  using (
    public.jogo_is_host(sala_id)
    or exists (
      select 1 from public.jogo_jogadores j
      where j.sala_id = jogo_rodadas.sala_id and j.colaborador_id = auth.uid()
    )
  )
  with check (
    public.jogo_is_host(sala_id)
    or exists (
      select 1 from public.jogo_jogadores j
      where j.sala_id = jogo_rodadas.sala_id and j.colaborador_id = auth.uid()
    )
  );

-- jogo_respostas (jogador grava so as proprias)
drop policy if exists "jogo_respostas: leitura autenticados" on public.jogo_respostas;
drop policy if exists "jogo_respostas: jogador insere proprio" on public.jogo_respostas;
drop policy if exists "jogo_respostas: jogador atualiza proprio" on public.jogo_respostas;

create policy "jogo_respostas: leitura autenticados"
  on public.jogo_respostas for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_respostas: jogador insere proprio"
  on public.jogo_respostas for insert
  to authenticated
  with check (public.jogo_jogador_e_meu(jogador_id));

create policy "jogo_respostas: jogador atualiza proprio"
  on public.jogo_respostas for update
  to authenticated
  using (public.jogo_jogador_e_meu(jogador_id))
  with check (public.jogo_jogador_e_meu(jogador_id));

-- jogo_validacoes (votante grava so os proprios votos)
drop policy if exists "jogo_validacoes: leitura autenticados" on public.jogo_validacoes;
drop policy if exists "jogo_validacoes: votante insere proprio" on public.jogo_validacoes;
drop policy if exists "jogo_validacoes: votante atualiza proprio" on public.jogo_validacoes;

create policy "jogo_validacoes: leitura autenticados"
  on public.jogo_validacoes for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_validacoes: votante insere proprio"
  on public.jogo_validacoes for insert
  to authenticated
  with check (public.jogo_jogador_e_meu(votante_id));

create policy "jogo_validacoes: votante atualiza proprio"
  on public.jogo_validacoes for update
  to authenticated
  using (public.jogo_jogador_e_meu(votante_id))
  with check (public.jogo_jogador_e_meu(votante_id));

-- jogo_pontuacoes (so host escreve; resultado por rodada)
drop policy if exists "jogo_pontuacoes: leitura autenticados" on public.jogo_pontuacoes;
drop policy if exists "jogo_pontuacoes: host escreve" on public.jogo_pontuacoes;
drop policy if exists "jogo_pontuacoes: host atualiza" on public.jogo_pontuacoes;

create policy "jogo_pontuacoes: leitura autenticados"
  on public.jogo_pontuacoes for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "jogo_pontuacoes: host escreve"
  on public.jogo_pontuacoes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.jogo_rodadas r
      where r.id = rodada_id and public.jogo_is_host(r.sala_id)
    )
  );

create policy "jogo_pontuacoes: host atualiza"
  on public.jogo_pontuacoes for update
  to authenticated
  using (
    exists (
      select 1 from public.jogo_rodadas r
      where r.id = rodada_id and public.jogo_is_host(r.sala_id)
    )
  )
  with check (
    exists (
      select 1 from public.jogo_rodadas r
      where r.id = rodada_id and public.jogo_is_host(r.sala_id)
    )
  );

-- ─── Grants ──────────────────────────────────────────────────────────────────

grant select, insert, update, delete on table public.jogo_salas to authenticated;
grant select, insert, update, delete on table public.jogo_jogadores to authenticated;
grant select, insert, update on table public.jogo_rodadas to authenticated;
grant select, insert, update on table public.jogo_respostas to authenticated;
grant select, insert, update on table public.jogo_validacoes to authenticated;
grant select, insert, update on table public.jogo_pontuacoes to authenticated;

-- ─── Realtime ──────────────────────────────────────────────────────────────────

do $$
begin
  begin
    alter publication supabase_realtime add table public.jogo_salas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jogo_jogadores;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jogo_rodadas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jogo_respostas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jogo_validacoes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.jogo_pontuacoes;
  exception when duplicate_object then null;
  end;
end;
$$;
