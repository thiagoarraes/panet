-- Reações emoji nas vibes (humor_checkins) do team wall.
-- Toggle estilo Slack: cada linha é uma reação de um colaborador com um emoji;
-- remover = delete da própria linha. Sem UPDATE.

create table public.humor_reacoes (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.humor_checkins(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint humor_reacoes_unique unique (checkin_id, colaborador_id, emoji),
  constraint humor_reacoes_emoji_check check (
    emoji in ('clap', 'heart', 'muscle', 'laugh', 'hug')
  )
);

create index humor_reacoes_checkin_idx on public.humor_reacoes(checkin_id);

alter table public.humor_reacoes enable row level security;

create policy "humor_reacoes: leitura autenticados"
  on public.humor_reacoes for select to public
  using ((select auth.role()) = 'authenticated');

create policy "humor_reacoes: colaborador insere propria"
  on public.humor_reacoes for insert to public
  with check ((select auth.uid()) = colaborador_id);

create policy "humor_reacoes: colaborador remove propria"
  on public.humor_reacoes for delete to public
  using ((select auth.uid()) = colaborador_id);

-- Realtime: adiciona humor_reacoes (e garante humor_checkins, que o hook já
-- subscreve mas nunca entrou na publication em migration nenhuma).
do $$
begin
  begin
    alter publication supabase_realtime add table public.humor_reacoes;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.humor_checkins;
  exception
    when duplicate_object then null;
  end;
end;
$$;
