-- Performance (auth_rls_initplan): envolve chamadas auth.uid()/auth.role() em
-- (select ...) para que o Postgres avalie uma vez por query, não por linha.
-- Semântica das políticas é idêntica; apenas a forma de avaliação muda.
-- Padrão recomendado: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ── humor_checkins (role public) ──────────────────────────────────────────────
drop policy if exists "humor_checkins: leitura autenticados" on public.humor_checkins;
create policy "humor_checkins: leitura autenticados" on public.humor_checkins
  for select to public
  using ((select auth.role()) = 'authenticated');

drop policy if exists "humor_checkins: colaborador insere proprio" on public.humor_checkins;
create policy "humor_checkins: colaborador insere proprio" on public.humor_checkins
  for insert to public
  with check ((select auth.uid()) = colaborador_id);

drop policy if exists "humor_checkins: colaborador atualiza proprio" on public.humor_checkins;
create policy "humor_checkins: colaborador atualiza proprio" on public.humor_checkins
  for update to public
  using ((select auth.uid()) = colaborador_id)
  with check ((select auth.uid()) = colaborador_id);

drop policy if exists "humor_checkins: colaborador remove proprio" on public.humor_checkins;
create policy "humor_checkins: colaborador remove proprio" on public.humor_checkins
  for delete to public
  using ((select auth.uid()) = colaborador_id);

-- ── enquetes / enquete_opcoes / enquete_votos (leitura) ───────────────────────
drop policy if exists "enquetes: leitura autenticados" on public.enquetes;
create policy "enquetes: leitura autenticados" on public.enquetes
  for select to authenticated
  using ((select auth.role()) = 'authenticated');

drop policy if exists "enquete_opcoes: leitura autenticados" on public.enquete_opcoes;
create policy "enquete_opcoes: leitura autenticados" on public.enquete_opcoes
  for select to authenticated
  using ((select auth.role()) = 'authenticated');

drop policy if exists "enquete_votos: leitura autenticados" on public.enquete_votos;
create policy "enquete_votos: leitura autenticados" on public.enquete_votos
  for select to authenticated
  using ((select auth.role()) = 'authenticated');

drop policy if exists "enquete_votos: colaborador vota proprio" on public.enquete_votos;
create policy "enquete_votos: colaborador vota proprio" on public.enquete_votos
  for insert to authenticated
  with check (
    ((select auth.uid()) = colaborador_id)
    and (exists (
      select 1 from public.enquetes e
      where e.id = enquete_votos.enquete_id
        and e.encerrada_em is null
        and (e.encerra_em is null or e.encerra_em > now())
    ))
    and (exists (
      select 1 from public.enquete_opcoes eo
      where eo.id = enquete_votos.enquete_opcao_id
        and eo.enquete_id = eo.enquete_id
    ))
  );

-- ── presencial_agendas (admin gerencia, ALL) ──────────────────────────────────
drop policy if exists presencial_agendas_admin_gerencia on public.presencial_agendas;
create policy presencial_agendas_admin_gerencia on public.presencial_agendas
  for all to authenticated
  using (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ))
  with check (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ));

-- ── presencial_agenda_convidados (admin gerencia, ALL) ────────────────────────
drop policy if exists presencial_agenda_convidados_admin_gerencia on public.presencial_agenda_convidados;
create policy presencial_agenda_convidados_admin_gerencia on public.presencial_agenda_convidados
  for all to authenticated
  using (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ))
  with check (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ));

-- ── presencial_amigo_secreto_sugestoes ────────────────────────────────────────
drop policy if exists presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria on public.presencial_amigo_secreto_sugestoes;
create policy presencial_amigo_secreto_sugestoes_colaborador_gerencia_propria on public.presencial_amigo_secreto_sugestoes
  for all to authenticated
  using (((select auth.uid()) = colaborador_id) and can_participate_presencial_agenda(agenda_id))
  with check (((select auth.uid()) = colaborador_id) and can_participate_presencial_agenda(agenda_id));

drop policy if exists presencial_amigo_secreto_sugestoes_admin_remove on public.presencial_amigo_secreto_sugestoes;
create policy presencial_amigo_secreto_sugestoes_admin_remove on public.presencial_amigo_secreto_sugestoes
  for delete to authenticated
  using (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ));

-- ── presencial_confirmacoes ───────────────────────────────────────────────────
drop policy if exists presencial_confirmacoes_colaborador_gerencia_propria on public.presencial_confirmacoes;
create policy presencial_confirmacoes_colaborador_gerencia_propria on public.presencial_confirmacoes
  for all to authenticated
  using (((select auth.uid()) = colaborador_id) and can_participate_presencial_agenda(agenda_id))
  with check (((select auth.uid()) = colaborador_id) and can_participate_presencial_agenda(agenda_id));

drop policy if exists presencial_confirmacoes_admin_remove on public.presencial_confirmacoes;
create policy presencial_confirmacoes_admin_remove on public.presencial_confirmacoes
  for delete to authenticated
  using (exists (
    select 1 from public.colaboradores c
    where c.id = (select auth.uid()) and c.perfil = 'admin'::perfil_acesso
  ));
