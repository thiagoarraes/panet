-- Performance indexes for high-frequency Panet reads.
-- Based on access patterns from Layout data loaders.

create index if not exists idx_colaboradores_nome
  on public.colaboradores (nome);

create index if not exists idx_colaboradores_aniversario
  on public.colaboradores (aniversario)
  where aniversario is not null;

create index if not exists idx_postagens_data_created
  on public.postagens (data_post desc, created_at desc);

create index if not exists idx_curtidas_postagem
  on public.curtidas (postagem_id);

create index if not exists idx_comentarios_postagem_created
  on public.comentarios (postagem_id, created_at asc);

create index if not exists idx_ferias_inicio
  on public.ferias (inicio asc);

create index if not exists idx_aniversario_parabenizacoes_ano
  on public.aniversario_parabenizacoes (ano_ref);

create index if not exists idx_mural_created_at
  on public.mural (created_at desc);

create index if not exists idx_galeria_eventos_created_at
  on public.galeria_eventos (created_at desc);

create index if not exists idx_galeria_fotos_evento_ordem
  on public.galeria_fotos (evento_id, ordem asc);
