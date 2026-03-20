-- Fill missing FK indexes reported by Supabase performance advisors.

create index if not exists idx_aniversario_parabenizacoes_colaborador_id
  on public.aniversario_parabenizacoes (colaborador_id);

create index if not exists idx_aniversarios_colaborador_id
  on public.aniversarios (colaborador_id);

create index if not exists idx_comentarios_colaborador_id
  on public.comentarios (colaborador_id);

create index if not exists idx_curtidas_colaborador_id
  on public.curtidas (colaborador_id);

create index if not exists idx_ferias_colaborador_id
  on public.ferias (colaborador_id);

create index if not exists idx_postagens_autor_id
  on public.postagens (autor_id);

create index if not exists idx_presencial_amigo_secreto_tirou_colaborador_id
  on public.presencial_amigo_secreto (tirou_colaborador_id);

create index if not exists idx_reacoes_aniversario_colaborador_id
  on public.reacoes_aniversario (colaborador_id);

