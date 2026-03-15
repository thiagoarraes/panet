-- Speed up admin collaborators search (ILIKE on nome/email).
create extension if not exists pg_trgm;

create index if not exists idx_colaboradores_nome_trgm
  on public.colaboradores using gin (nome gin_trgm_ops);

create index if not exists idx_colaboradores_email_trgm
  on public.colaboradores using gin (email gin_trgm_ops);
