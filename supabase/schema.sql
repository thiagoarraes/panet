-- ─────────────────────────────────────────────────────────────────────────────
-- supabase/schema.sql
-- Schema completo da Panet.
-- Execute no SQL Editor do Supabase (painel → SQL Editor → New Query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensões ─────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ── Enum: perfil de acesso ────────────────────────────────────────────────────
create type perfil_acesso as enum ('colaborador', 'admin');

-- ── Enum: categoria de postagem ───────────────────────────────────────────────
create type categoria_post as enum ('Notícia', 'Comunicado', 'Evento');

-- ── Enum: status de férias ────────────────────────────────────────────────────
create type status_ferias as enum ('marcado', 'em_andamento');

-- Enum: status de agenda presencial
create type status_presencial as enum ('aberto', 'encerrado', 'cancelado');

-- Enum: resposta do colaborador para presencial
create type resposta_presencial as enum ('confirmado', 'talvez');

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: colaboradores
-- Perfil público dos usuários. Ligada ao auth.users via id.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.colaboradores (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text        not null,
  cargo         text        not null,
  email         text        not null unique,
  telefone      text,
  cor_avatar    text        default '#11E7E7',
  foto_url      text,                        -- URL no Supabase Storage
  instagram     text,
  linkedin      text,
  github        text,
  perfil        perfil_acesso not null default 'colaborador',
  primeiro_acesso boolean   not null default true,
  aniversario   date,
  created_at    timestamptz not null default now()
);

-- RLS
alter table public.colaboradores enable row level security;

-- Qualquer colaborador autenticado pode ler todos os perfis
create policy "colaboradores: leitura autenticados"
  on public.colaboradores for select
  using (auth.role() = 'authenticated');

-- Cada usuário pode editar apenas o próprio perfil
create policy "colaboradores: editar próprio"
  on public.colaboradores for update
  using (auth.uid() = id);

create policy "colaboradores: admin update"
  on public.colaboradores for update
  using (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

-- Admins podem inserir e deletar
create policy "colaboradores: admin insert"
  on public.colaboradores for insert
  with check (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

create policy "colaboradores: admin delete"
  on public.colaboradores for delete
  using (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: postagens
-- ─────────────────────────────────────────────────────────────────────────────
create table public.postagens (
  id          uuid primary key default uuid_generate_v4(),
  titulo      text              not null,
  descricao   text              not null,
  imagem_url  text,
  categoria   categoria_post    not null default 'Notícia',
  autor_id    uuid              references public.colaboradores(id),
  created_at  timestamptz       not null default now(),
  data_post   date              not null default current_date
);

alter table public.postagens enable row level security;

create policy "postagens: leitura autenticados"
  on public.postagens for select
  using (auth.role() = 'authenticated');

create policy "postagens: admin escreve"
  on public.postagens for all
  using (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: curtidas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.curtidas (
  id            uuid primary key default uuid_generate_v4(),
  postagem_id   uuid not null references public.postagens(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(postagem_id, colaborador_id)
);

alter table public.curtidas enable row level security;

create policy "curtidas: leitura autenticados"
  on public.curtidas for select using (auth.role() = 'authenticated');

create policy "curtidas: colaborador gerencia própria"
  on public.curtidas for all
  using (auth.uid() = colaborador_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: comentarios
-- ─────────────────────────────────────────────────────────────────────────────
create table public.comentarios (
  id              uuid primary key default uuid_generate_v4(),
  postagem_id     uuid not null references public.postagens(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  texto           text not null,
  editado         boolean not null default false,
  updated_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.comentarios enable row level security;

create policy "comentarios: leitura autenticados"
  on public.comentarios for select using (auth.role() = 'authenticated');

create policy "comentarios: colaborador insere"
  on public.comentarios for insert
  with check (auth.uid() = colaborador_id);

create policy "comentarios: dono edita"
  on public.comentarios for update
  using (auth.uid() = colaborador_id)
  with check (auth.uid() = colaborador_id);

create policy "comentarios: dono deleta"
  on public.comentarios for delete
  using (auth.uid() = colaborador_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: aniversario_parabenizacoes
-- ─────────────────────────────────────────────────────────────────────────────
create table public.aniversario_parabenizacoes (
  id                uuid primary key default gen_random_uuid(),
  aniversariante_id uuid not null references public.colaboradores(id) on delete cascade,
  colaborador_id    uuid not null references public.colaboradores(id) on delete cascade,
  ano_ref           int not null default extract(year from now())::int,
  created_at        timestamptz not null default now(),
  unique(aniversariante_id, colaborador_id, ano_ref)
);

alter table public.aniversario_parabenizacoes enable row level security;

create policy "aniv_parab: leitura autenticados"
  on public.aniversario_parabenizacoes for select
  using (auth.role() = 'authenticated');

create policy "aniv_parab: colaborador insere"
  on public.aniversario_parabenizacoes for insert
  with check (auth.uid() = colaborador_id);

create policy "aniv_parab: colaborador deleta"
  on public.aniversario_parabenizacoes for delete
  using (auth.uid() = colaborador_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: ferias
-- ─────────────────────────────────────────────────────────────────────────────
create table public.ferias (
  id              uuid primary key default uuid_generate_v4(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  inicio          date not null,
  fim             date not null,
  status          status_ferias not null default 'marcado',
  tipo            text not null default 'ferias',   -- 'ferias' | 'dayoff'
  motivo_real     text,
  created_at      timestamptz not null default now()
);

alter table public.ferias enable row level security;

create policy "ferias: leitura autenticados"
  on public.ferias for select using (auth.role() = 'authenticated');

create policy "ferias: admin gerencia"
  on public.ferias for all
  using (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- TABELAS: presencial_agendas e presencial_confirmacoes
-- -----------------------------------------------------------------------------
create table public.presencial_agendas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  data_presencial date not null,
  hora_presencial time,
  amigo_secreto_ativo boolean not null default false,
  amigo_secreto_regras text,
  amigo_secreto_sorteado_at timestamptz,
  local           text,
  maps_url        text,
  observacao      text,
  vagas           int not null default 0,
  status          status_presencial not null default 'aberto',
  created_at      timestamptz not null default now()
);

create table public.presencial_confirmacoes (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  status          resposta_presencial not null default 'confirmado',
  observacao      text,
  created_at      timestamptz not null default now(),
  unique(agenda_id, colaborador_id)
);

create table public.presencial_amigo_secreto (
  id                   uuid primary key default gen_random_uuid(),
  agenda_id            uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id       uuid not null references public.colaboradores(id) on delete cascade,
  tirou_colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  created_at           timestamptz not null default now(),
  unique(agenda_id, colaborador_id),
  unique(agenda_id, tirou_colaborador_id),
  check (colaborador_id <> tirou_colaborador_id)
);

create table public.presencial_amigo_secreto_sugestoes (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  sugestao        text not null,
  created_at      timestamptz not null default now(),
  unique(agenda_id, colaborador_id),
  check (char_length(btrim(sugestao)) between 1 and 280)
);

create table public.presencial_agenda_convidados (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.presencial_agendas(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(agenda_id, colaborador_id)
);

create index presencial_agendas_data_idx on public.presencial_agendas(data_presencial desc);
create index presencial_confirmacoes_agenda_idx on public.presencial_confirmacoes(agenda_id, status);
create index presencial_confirmacoes_colaborador_idx on public.presencial_confirmacoes(colaborador_id);
create index presencial_amigo_secreto_agenda_idx on public.presencial_amigo_secreto(agenda_id);
create index presencial_amigo_secreto_colaborador_idx on public.presencial_amigo_secreto(colaborador_id);
create index presencial_amigo_secreto_sugestoes_colaborador_agenda_idx
  on public.presencial_amigo_secreto_sugestoes(colaborador_id, agenda_id);
create index presencial_agenda_convidados_agenda_idx on public.presencial_agenda_convidados(agenda_id);
create index presencial_agenda_convidados_colaborador_idx on public.presencial_agenda_convidados(colaborador_id);

alter table public.presencial_agendas enable row level security;
alter table public.presencial_confirmacoes enable row level security;
alter table public.presencial_amigo_secreto enable row level security;
alter table public.presencial_amigo_secreto_sugestoes enable row level security;
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

grant execute on function public.can_access_presencial_agenda(uuid) to authenticated;
grant execute on function public.can_participate_presencial_agenda(uuid) to authenticated;
grant execute on function public.run_amigo_secreto_draw(uuid) to authenticated;
grant execute on function public.get_my_amigo_secreto_results() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: galeria_eventos
-- ─────────────────────────────────────────────────────────────────────────────
create table public.galeria_eventos (
  id          uuid primary key default uuid_generate_v4(),
  titulo      text not null,
  mes_ano     text,                        -- Ex: "Dez 2025"
  capa_url    text,
  created_at  timestamptz not null default now()
);

create table public.galeria_fotos (
  id          uuid primary key default uuid_generate_v4(),
  evento_id   uuid not null references public.galeria_eventos(id) on delete cascade,
  foto_url    text not null,
  legenda     text,
  ordem       int default 0,
  created_at  timestamptz not null default now()
);

alter table public.galeria_eventos enable row level security;
alter table public.galeria_fotos   enable row level security;

create policy "galeria_eventos: leitura autenticados"
  on public.galeria_eventos for select using (auth.role() = 'authenticated');

create policy "galeria_fotos: leitura autenticados"
  on public.galeria_fotos for select using (auth.role() = 'authenticated');

create policy "galeria: admin gerencia eventos"
  on public.galeria_eventos for all
  using (exists (select 1 from public.colaboradores where id = auth.uid() and perfil = 'admin'));

create policy "galeria: admin gerencia fotos"
  on public.galeria_fotos for all
  using (exists (select 1 from public.colaboradores where id = auth.uid() and perfil = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: mural
-- ─────────────────────────────────────────────────────────────────────────────
create table public.mural (
  id              uuid primary key default uuid_generate_v4(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  texto           text not null,
  created_at      timestamptz not null default now()
);

alter table public.mural enable row level security;

create policy "mural: leitura autenticados"
  on public.mural for select using (auth.role() = 'authenticated');

create policy "mural: colaborador insere"
  on public.mural for insert
  with check (auth.uid() = colaborador_id);

create policy "mural: dono deleta"
  on public.mural for delete
  using (auth.uid() = colaborador_id);

create table public.humor_checkins (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  data_ref        date not null default current_date,
  humor_id        text not null,
  energia         smallint not null,
  tags            text[] not null default '{}'::text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(colaborador_id, data_ref),
  check (humor_id in ('rocket', 'flow', 'zen', 'focus', 'steady', 'storm', 'low', 'fire')),
  check (energia between 1 and 10),
  check (coalesce(array_length(tags, 1), 0) <= 4)
);

create index humor_checkins_data_ref_idx
  on public.humor_checkins(data_ref desc, updated_at desc);

create index humor_checkins_colaborador_idx
  on public.humor_checkins(colaborador_id, data_ref desc);

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

create or replace function public.cleanup_humor_checkins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.humor_checkins
  where data_ref < timezone('America/Sao_Paulo', now())::date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

select cron.schedule(
  'humor-checkins-daily-prune',
  '59 10 * * *',
  $$select public.cleanup_humor_checkins();$$
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE: buckets públicos
-- Execute separadamente no SQL Editor ou crie via painel Storage.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatares',  'avatares',  true),
  ('postagens', 'postagens', true),
  ('galeria',   'galeria',   true)
on conflict do nothing;

-- Política de upload: apenas autenticados
create policy "storage avatares: upload autenticado"
  on storage.objects for insert
  with check (bucket_id = 'avatares' and auth.role() = 'authenticated');

create policy "storage postagens: upload admin"
  on storage.objects for insert
  with check (
    bucket_id = 'postagens'
    and exists (select 1 from public.colaboradores where id = auth.uid() and perfil = 'admin')
  );

create policy "storage galeria: upload admin"
  on storage.objects for insert
  with check (
    bucket_id = 'galeria'
    and exists (select 1 from public.colaboradores where id = auth.uid() and perfil = 'admin')
  );

-- Leitura pública dos buckets
create policy "storage: leitura publica avatares"
  on storage.objects for select using (bucket_id = 'avatares');

create policy "storage: leitura publica postagens"
  on storage.objects for select using (bucket_id = 'postagens');

create policy "storage: leitura publica galeria"
  on storage.objects for select using (bucket_id = 'galeria');
