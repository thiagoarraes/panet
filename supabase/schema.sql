-- ─────────────────────────────────────────────────────────────────────────────
-- supabase/schema.sql
-- Schema completo da Panet.
-- Execute no SQL Editor do Supabase (painel → SQL Editor → New Query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensões ─────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enum: perfil de acesso ────────────────────────────────────────────────────
create type perfil_acesso as enum ('colaborador', 'admin');

-- ── Enum: categoria de postagem ───────────────────────────────────────────────
create type categoria_post as enum ('Notícia', 'Comunicado', 'Evento');

-- ── Enum: status de férias ────────────────────────────────────────────────────
create type status_ferias as enum ('marcado', 'em_andamento');

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
  created_at      timestamptz not null default now()
);

alter table public.comentarios enable row level security;

create policy "comentarios: leitura autenticados"
  on public.comentarios for select using (auth.role() = 'authenticated');

create policy "comentarios: colaborador insere"
  on public.comentarios for insert
  with check (auth.uid() = colaborador_id);

create policy "comentarios: dono deleta"
  on public.comentarios for delete
  using (auth.uid() = colaborador_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: aniversarios
-- ─────────────────────────────────────────────────────────────────────────────
create table public.aniversarios (
  id              uuid primary key default uuid_generate_v4(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  data_aniversario date not null,          -- dia e mês usados; ano ignorado
  created_at      timestamptz not null default now()
);

alter table public.aniversarios enable row level security;

create policy "aniversarios: leitura autenticados"
  on public.aniversarios for select using (auth.role() = 'authenticated');

create policy "aniversarios: admin gerencia"
  on public.aniversarios for all
  using (
    exists (
      select 1 from public.colaboradores
      where id = auth.uid() and perfil = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: reacoes_aniversario
-- ─────────────────────────────────────────────────────────────────────────────
create table public.reacoes_aniversario (
  id              uuid primary key default uuid_generate_v4(),
  aniversario_id  uuid not null references public.aniversarios(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(aniversario_id, colaborador_id)
);

alter table public.reacoes_aniversario enable row level security;

create policy "reacoes_aniv: leitura autenticados"
  on public.reacoes_aniversario for select using (auth.role() = 'authenticated');

create policy "reacoes_aniv: colaborador gerencia"
  on public.reacoes_aniversario for all
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
