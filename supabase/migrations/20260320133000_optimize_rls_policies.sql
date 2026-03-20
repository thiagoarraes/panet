-- RLS performance optimization:
-- 1) Replace auth.* direct calls with initPlan-friendly pattern.
-- 2) Remove SELECT overlap from ALL policies by splitting into I/U/D.

-- aniversario_parabenizacoes
drop policy if exists "aniv_parab: leitura autenticados" on public.aniversario_parabenizacoes;
drop policy if exists "aniv_parab: colaborador insere" on public.aniversario_parabenizacoes;
drop policy if exists "aniv_parab: colaborador deleta" on public.aniversario_parabenizacoes;

create policy "aniv_parab: leitura autenticados"
  on public.aniversario_parabenizacoes for select
  to authenticated
  using (true);

create policy "aniv_parab: colaborador insere"
  on public.aniversario_parabenizacoes for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "aniv_parab: colaborador deleta"
  on public.aniversario_parabenizacoes for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);

-- aniversarios
drop policy if exists "aniversarios: leitura autenticados" on public.aniversarios;
drop policy if exists "aniversarios: admin gerencia" on public.aniversarios;

create policy "aniversarios: leitura autenticados"
  on public.aniversarios for select
  to authenticated
  using (true);

create policy "aniversarios: admin insere"
  on public.aniversarios for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "aniversarios: admin atualiza"
  on public.aniversarios for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "aniversarios: admin deleta"
  on public.aniversarios for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- ausencias
drop policy if exists "ausencias: leitura autenticados" on public.ausencias;
drop policy if exists "ausencias: admin gerencia" on public.ausencias;

create policy "ausencias: leitura autenticados"
  on public.ausencias for select
  to authenticated
  using (true);

create policy "ausencias: admin insere"
  on public.ausencias for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "ausencias: admin atualiza"
  on public.ausencias for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "ausencias: admin deleta"
  on public.ausencias for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- colaboradores
drop policy if exists "colaboradores: leitura autenticados" on public.colaboradores;
drop policy if exists "colaboradores: editar próprio" on public.colaboradores;
drop policy if exists "colaboradores: admin update" on public.colaboradores;
drop policy if exists "colaboradores: admin insert" on public.colaboradores;
drop policy if exists "colaboradores: admin delete" on public.colaboradores;

create policy "colaboradores: leitura autenticados"
  on public.colaboradores for select
  to authenticated
  using (true);

create policy "colaboradores: update próprio ou admin"
  on public.colaboradores for update
  to authenticated
  using (
    ((select auth.uid()) = id)
    or exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    ((select auth.uid()) = id)
    or exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "colaboradores: admin insert"
  on public.colaboradores for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "colaboradores: admin delete"
  on public.colaboradores for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- comentarios
drop policy if exists "comentarios: leitura autenticados" on public.comentarios;
drop policy if exists "comentarios: colaborador insere" on public.comentarios;
drop policy if exists "comentarios: dono edita" on public.comentarios;
drop policy if exists "comentarios: dono deleta" on public.comentarios;

create policy "comentarios: leitura autenticados"
  on public.comentarios for select
  to authenticated
  using (true);

create policy "comentarios: colaborador insere"
  on public.comentarios for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "comentarios: dono edita"
  on public.comentarios for update
  to authenticated
  using ((select auth.uid()) = colaborador_id)
  with check ((select auth.uid()) = colaborador_id);

create policy "comentarios: dono deleta"
  on public.comentarios for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);

-- curtidas
drop policy if exists "curtidas: leitura autenticados" on public.curtidas;
drop policy if exists "curtidas: colaborador gerencia própria" on public.curtidas;

create policy "curtidas: leitura autenticados"
  on public.curtidas for select
  to authenticated
  using (true);

create policy "curtidas: colaborador insere"
  on public.curtidas for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "curtidas: colaborador atualiza"
  on public.curtidas for update
  to authenticated
  using ((select auth.uid()) = colaborador_id)
  with check ((select auth.uid()) = colaborador_id);

create policy "curtidas: colaborador deleta"
  on public.curtidas for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);

-- ferias
drop policy if exists "ferias: leitura autenticados" on public.ferias;
drop policy if exists "ferias: admin gerencia" on public.ferias;

create policy "ferias: leitura autenticados"
  on public.ferias for select
  to authenticated
  using (true);

create policy "ferias: admin insere"
  on public.ferias for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "ferias: admin atualiza"
  on public.ferias for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "ferias: admin deleta"
  on public.ferias for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- galeria_eventos
drop policy if exists "galeria_eventos: leitura autenticados" on public.galeria_eventos;
drop policy if exists "galeria: admin gerencia eventos" on public.galeria_eventos;

create policy "galeria_eventos: leitura autenticados"
  on public.galeria_eventos for select
  to authenticated
  using (true);

create policy "galeria_eventos: admin insere"
  on public.galeria_eventos for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "galeria_eventos: admin atualiza"
  on public.galeria_eventos for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "galeria_eventos: admin deleta"
  on public.galeria_eventos for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- galeria_fotos
drop policy if exists "galeria_fotos: leitura autenticados" on public.galeria_fotos;
drop policy if exists "galeria: admin gerencia fotos" on public.galeria_fotos;

create policy "galeria_fotos: leitura autenticados"
  on public.galeria_fotos for select
  to authenticated
  using (true);

create policy "galeria_fotos: admin insere"
  on public.galeria_fotos for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "galeria_fotos: admin atualiza"
  on public.galeria_fotos for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "galeria_fotos: admin deleta"
  on public.galeria_fotos for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- mural
drop policy if exists "mural: leitura autenticados" on public.mural;
drop policy if exists "mural: colaborador insere" on public.mural;
drop policy if exists "mural: dono deleta" on public.mural;

create policy "mural: leitura autenticados"
  on public.mural for select
  to authenticated
  using (true);

create policy "mural: colaborador insere"
  on public.mural for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "mural: dono deleta"
  on public.mural for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);

-- postagens
drop policy if exists "postagens: leitura autenticados" on public.postagens;
drop policy if exists "postagens: admin escreve" on public.postagens;

create policy "postagens: leitura autenticados"
  on public.postagens for select
  to authenticated
  using (true);

create policy "postagens: admin insere"
  on public.postagens for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "postagens: admin atualiza"
  on public.postagens for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "postagens: admin deleta"
  on public.postagens for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- presencial_agendas
drop policy if exists "presencial_agendas: leitura autenticados" on public.presencial_agendas;
drop policy if exists "presencial_agendas: admin gerencia" on public.presencial_agendas;

create policy "presencial_agendas: leitura autenticados"
  on public.presencial_agendas for select
  to authenticated
  using (true);

create policy "presencial_agendas: admin insere"
  on public.presencial_agendas for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "presencial_agendas: admin atualiza"
  on public.presencial_agendas for update
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  )
  with check (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

create policy "presencial_agendas: admin deleta"
  on public.presencial_agendas for delete
  to authenticated
  using (
    exists (
      select 1
      from public.colaboradores c
      where c.id = (select auth.uid())
        and c.perfil = 'admin'::public.perfil_acesso
    )
  );

-- presencial_confirmacoes
drop policy if exists "presencial_confirmacoes: leitura autenticados" on public.presencial_confirmacoes;
drop policy if exists "presencial_confirmacoes: colaborador gerencia propria" on public.presencial_confirmacoes;

create policy "presencial_confirmacoes: leitura autenticados"
  on public.presencial_confirmacoes for select
  to authenticated
  using (true);

create policy "presencial_confirmacoes: colaborador insere"
  on public.presencial_confirmacoes for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "presencial_confirmacoes: colaborador atualiza"
  on public.presencial_confirmacoes for update
  to authenticated
  using ((select auth.uid()) = colaborador_id)
  with check ((select auth.uid()) = colaborador_id);

create policy "presencial_confirmacoes: colaborador deleta"
  on public.presencial_confirmacoes for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);

-- reacoes_aniversario
drop policy if exists "reacoes_aniv: leitura autenticados" on public.reacoes_aniversario;
drop policy if exists "reacoes_aniv: colaborador gerencia" on public.reacoes_aniversario;

create policy "reacoes_aniv: leitura autenticados"
  on public.reacoes_aniversario for select
  to authenticated
  using (true);

create policy "reacoes_aniv: colaborador insere"
  on public.reacoes_aniversario for insert
  to authenticated
  with check ((select auth.uid()) = colaborador_id);

create policy "reacoes_aniv: colaborador atualiza"
  on public.reacoes_aniversario for update
  to authenticated
  using ((select auth.uid()) = colaborador_id)
  with check ((select auth.uid()) = colaborador_id);

create policy "reacoes_aniv: colaborador deleta"
  on public.reacoes_aniversario for delete
  to authenticated
  using ((select auth.uid()) = colaborador_id);
