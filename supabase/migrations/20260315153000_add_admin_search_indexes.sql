-- Improve admin server-side search performance (ILIKE with pagination).
create extension if not exists pg_trgm;

create index if not exists idx_postagens_titulo_trgm
  on public.postagens using gin (titulo gin_trgm_ops);

create index if not exists idx_postagens_descricao_trgm
  on public.postagens using gin (descricao gin_trgm_ops);

create index if not exists idx_postagens_categoria
  on public.postagens (categoria);

create index if not exists idx_galeria_eventos_titulo_trgm
  on public.galeria_eventos using gin (titulo gin_trgm_ops);

create index if not exists idx_galeria_eventos_mes_ano_trgm
  on public.galeria_eventos using gin (mes_ano gin_trgm_ops);

create index if not exists idx_mural_texto_trgm
  on public.mural using gin (texto gin_trgm_ops);

create index if not exists idx_ferias_status
  on public.ferias (status);

create index if not exists idx_ferias_tipo_inicio
  on public.ferias (tipo, inicio asc);

create index if not exists idx_mural_colaborador_created
  on public.mural (colaborador_id, created_at desc);
