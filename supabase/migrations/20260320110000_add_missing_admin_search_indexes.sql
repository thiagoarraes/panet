-- Complementary indexes for admin search and presencial confirmations ordering.
create extension if not exists pg_trgm;

create index if not exists idx_presencial_agendas_titulo_trgm
  on public.presencial_agendas using gin (titulo gin_trgm_ops);

create index if not exists idx_presencial_agendas_local_trgm
  on public.presencial_agendas using gin ("local" gin_trgm_ops);

create index if not exists idx_presencial_agendas_observacao_trgm
  on public.presencial_agendas using gin (observacao gin_trgm_ops);

create index if not exists idx_ausencias_motivo_trgm
  on public.ausencias using gin (motivo gin_trgm_ops);

create index if not exists idx_presencial_confirmacoes_agenda_created
  on public.presencial_confirmacoes (agenda_id, created_at asc);

