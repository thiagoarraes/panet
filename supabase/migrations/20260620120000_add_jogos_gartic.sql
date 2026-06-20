-- Jogos: gartic (Skribbl-like) multiplayer em tempo real.
-- Um jogador desenha uma palavra secreta sorteada; os demais adivinham por chat.
-- Host-autoritativo: o criador da sala controla o avanco de fase/rodada.
-- Reutiliza jogo_salas/jogo_jogadores (genericas). Os tracos do desenho NAO sao
-- persistidos: trafegam via Realtime broadcast (canal efemero), nunca no banco.

-- ─── Fases do gartic em jogo_salas ──────────────────────────────────────────────
-- jogo_salas.fase tinha CHECK so com as fases da adedonha. Recria o CHECK incluindo
-- as fases do gartic (escolha/desenho/revelacao), mantendo as antigas.

alter table public.jogo_salas drop constraint if exists jogo_salas_fase_valida;
alter table public.jogo_salas add constraint jogo_salas_fase_valida
  check (fase in (
    'lobby', 'preenchimento', 'validacao', 'ranking', 'fim',
    'escolha', 'desenho', 'revelacao'
  ));

-- ─── Tabelas ──────────────────────────────────────────────────────────────────

-- Rodada do gartic (publica). Nao guarda a palavra (fica em gartic_palavra).
create table if not exists public.gartic_rodadas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.jogo_salas(id) on delete cascade,
  numero smallint not null,
  desenhista_id uuid not null references public.jogo_jogadores(id) on delete cascade,
  fase text not null default 'escolha',
  palavra_tamanho smallint null,
  -- Preenchida pelo host apenas na revelacao: torna a palavra publica so quando a
  -- rodada acaba (a palavra "secreta" durante o jogo fica em gartic_palavra/RLS).
  palavra_revelada text null,
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz null,
  constraint gartic_rodadas_fase_valida check (fase in ('escolha', 'desenho', 'revelacao', 'fim')),
  constraint gartic_rodadas_unique_sala_numero unique (sala_id, numero)
);

-- Palavra secreta da rodada. RLS restringe a leitura ao desenhista e ao host.
create table if not exists public.gartic_palavra (
  rodada_id uuid primary key references public.gartic_rodadas(id) on delete cascade,
  palavra text not null,
  constraint gartic_palavra_not_blank check (length(btrim(palavra)) > 0)
);

-- Palpites dos adivinhadores. O host marca acerto/ordem/pontos.
create table if not exists public.gartic_palpites (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.gartic_rodadas(id) on delete cascade,
  jogador_id uuid not null references public.jogo_jogadores(id) on delete cascade,
  texto text not null,
  acertou boolean not null default false,
  ordem_acerto smallint null,
  pontos int not null default 0,
  criado_em timestamptz not null default now(),
  constraint gartic_palpites_texto_not_blank check (length(btrim(texto)) > 0)
);

-- ─── Indices ──────────────────────────────────────────────────────────────────

create index if not exists gartic_rodadas_sala_idx on public.gartic_rodadas(sala_id, numero);
create index if not exists gartic_rodadas_desenhista_idx on public.gartic_rodadas(desenhista_id);
create index if not exists gartic_palpites_rodada_idx on public.gartic_palpites(rodada_id, criado_em);
create index if not exists gartic_palpites_jogador_idx on public.gartic_palpites(jogador_id);

-- ─── Helpers de autorizacao ─────────────────────────────────────────────────────

-- Pode ver a palavra secreta? Apenas o desenhista da rodada ou o host da sala.
create or replace function public.gartic_pode_ver_palavra(p_rodada_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gartic_rodadas r
    join public.jogo_jogadores j on j.id = r.desenhista_id
    where r.id = p_rodada_id
      and (j.colaborador_id = auth.uid() or public.jogo_is_host(r.sala_id))
  );
$$;

-- O usuario autenticado e host da sala desta rodada?
create or replace function public.gartic_is_host_da_rodada(p_rodada_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gartic_rodadas r
    where r.id = p_rodada_id and public.jogo_is_host(r.sala_id)
  );
$$;

grant execute on function public.gartic_pode_ver_palavra(uuid) to authenticated;
grant execute on function public.gartic_is_host_da_rodada(uuid) to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.gartic_rodadas enable row level security;
alter table public.gartic_palavra enable row level security;
alter table public.gartic_palpites enable row level security;

-- gartic_rodadas (host cria/avanca; desenhista atualiza a propria fase de escolha)
drop policy if exists "gartic_rodadas: leitura autenticados" on public.gartic_rodadas;
drop policy if exists "gartic_rodadas: host insere" on public.gartic_rodadas;
drop policy if exists "gartic_rodadas: host ou desenhista atualiza" on public.gartic_rodadas;

create policy "gartic_rodadas: leitura autenticados"
  on public.gartic_rodadas for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "gartic_rodadas: host insere"
  on public.gartic_rodadas for insert
  to authenticated
  with check (public.jogo_is_host(sala_id));

-- Host pode tudo; o desenhista pode atualizar (usado ao escolher a palavra).
create policy "gartic_rodadas: host ou desenhista atualiza"
  on public.gartic_rodadas for update
  to authenticated
  using (
    public.jogo_is_host(sala_id)
    or exists (
      select 1 from public.jogo_jogadores j
      where j.id = gartic_rodadas.desenhista_id and j.colaborador_id = auth.uid()
    )
  )
  with check (
    public.jogo_is_host(sala_id)
    or exists (
      select 1 from public.jogo_jogadores j
      where j.id = gartic_rodadas.desenhista_id and j.colaborador_id = auth.uid()
    )
  );

-- gartic_palavra (so desenhista/host leem; desenhista/host gravam)
drop policy if exists "gartic_palavra: desenhista ou host le" on public.gartic_palavra;
drop policy if exists "gartic_palavra: desenhista ou host insere" on public.gartic_palavra;
drop policy if exists "gartic_palavra: desenhista ou host atualiza" on public.gartic_palavra;

create policy "gartic_palavra: desenhista ou host le"
  on public.gartic_palavra for select
  to authenticated
  using (public.gartic_pode_ver_palavra(rodada_id));

create policy "gartic_palavra: desenhista ou host insere"
  on public.gartic_palavra for insert
  to authenticated
  with check (public.gartic_pode_ver_palavra(rodada_id));

create policy "gartic_palavra: desenhista ou host atualiza"
  on public.gartic_palavra for update
  to authenticated
  using (public.gartic_pode_ver_palavra(rodada_id))
  with check (public.gartic_pode_ver_palavra(rodada_id));

-- gartic_palpites (jogador insere o proprio; host marca acerto/pontos)
drop policy if exists "gartic_palpites: leitura autenticados" on public.gartic_palpites;
drop policy if exists "gartic_palpites: jogador insere proprio" on public.gartic_palpites;
drop policy if exists "gartic_palpites: host atualiza" on public.gartic_palpites;

create policy "gartic_palpites: leitura autenticados"
  on public.gartic_palpites for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "gartic_palpites: jogador insere proprio"
  on public.gartic_palpites for insert
  to authenticated
  with check (public.jogo_jogador_e_meu(jogador_id));

create policy "gartic_palpites: host atualiza"
  on public.gartic_palpites for update
  to authenticated
  using (public.gartic_is_host_da_rodada(rodada_id))
  with check (public.gartic_is_host_da_rodada(rodada_id));

-- ─── Grants ──────────────────────────────────────────────────────────────────

grant select, insert, update on table public.gartic_rodadas to authenticated;
grant select, insert, update on table public.gartic_palavra to authenticated;
grant select, insert, update on table public.gartic_palpites to authenticated;

-- ─── Realtime ──────────────────────────────────────────────────────────────────

do $$
begin
  begin
    alter publication supabase_realtime add table public.gartic_rodadas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.gartic_palpites;
  exception when duplicate_object then null;
  end;
end;
$$;
