-- Performance: índices cobrindo foreign keys sem índice (advisor 0001).
-- enquete_votos_opcao_fk é composta (enquete_id, enquete_opcao_id) -> índice composto.
create index if not exists idx_enquete_votos_enquete_opcao
  on public.enquete_votos (enquete_id, enquete_opcao_id);
create index if not exists idx_enquetes_created_by
  on public.enquetes (created_by);
