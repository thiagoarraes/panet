-- Dados sensiveis de RH dos colaboradores: documentos, banco, saude e contato
-- de emergencia.
--
-- POR QUE TABELA SEPARADA e nao colunas em `colaboradores`:
-- a policy de SELECT de `colaboradores` e
--   using (ativo = true or public.current_user_has_admin_module('colaboradores'))
-- ou seja, QUALQUER autenticado le a linha inteira de qualquer colaborador
-- ativo. Uma coluna nova ali seria legivel por todo mundo via PostgREST, mesmo
-- com a UI escondendo. Blindar exigiria REVOKE/GRANT por coluna E congelar cada
-- coluna nova na policy "colaboradores: update proprio seguro" (que hoje libera
-- por padrao qualquer coluna nao listada). Ha ainda um segundo vazamento:
-- supabase/functions/update-profile faz .select("*") com service role, que
-- ignora RLS e grants.
-- Numa tabela propria basta uma policy por comando, todas com a mesma condicao.
--
-- REGRA DE NEGOCIO: nem o dono dos proprios dados ve. E RH, nao perfil. Por isso
-- nenhuma policy tem clausula `auth.uid() = colaborador_id`.

create table if not exists public.colaboradores_dados (
  -- PK = FK: garante o 1:1 sem indice unique extra e deixa o upsert com
  -- onConflict: "colaborador_id" funcionar direto.
  colaborador_id      uuid        primary key
                                  references public.colaboradores(id) on delete cascade,

  nome_completo       text,
  data_nascimento     date,
  data_admissao       date,

  -- RG nao tem formato nacional (27 emissores, letras, digito 'X', zeros a
  -- esquerda) e nao tem checksum: text cru, sem check.
  rg                  text,
  -- CPF/CNPJ guardados so com digitos; a mascara e responsabilidade da UI.
  cpf                 text        check (cpf  is null or cpf  ~ '^[0-9]{11}$'),
  cnpj                text        check (cnpj is null or cnpj ~ '^[0-9]{14}$'),

  email_pessoal       text,
  email_pan           text,

  banco_agencia       text,
  banco_conta         text,
  banco_pix           text,       -- chave pode ser cpf, email, telefone ou aleatoria

  plano_saude         boolean     not null default false,
  plano_saude_qual    text,

  -- check em vez de enum: mudar a lista depois e uma linha, ALTER TYPE nao e.
  tipo_sanguineo      text        check (tipo_sanguineo is null or tipo_sanguineo in
                                    ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  emergencia_nome     text,
  emergencia_telefone text,       -- so digitos

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- updated_at automatico.
create or replace function public.set_colaboradores_dados_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_colaboradores_dados_updated_at on public.colaboradores_dados;
create trigger trg_colaboradores_dados_updated_at
  before update on public.colaboradores_dados
  for each row execute function public.set_colaboradores_dados_updated_at();

-- ─── RLS: a mesma condicao nos quatro comandos ──────────────────────────────
-- current_user_has_admin_module ja checa perfil='admin', ativo=true e o modulo,
-- entao um ex-panner que era admin perde o acesso automaticamente.
alter table public.colaboradores_dados enable row level security;

drop policy if exists "colaboradores_dados: modulo le" on public.colaboradores_dados;
create policy "colaboradores_dados: modulo le"
  on public.colaboradores_dados for select
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'));

drop policy if exists "colaboradores_dados: modulo insere" on public.colaboradores_dados;
create policy "colaboradores_dados: modulo insere"
  on public.colaboradores_dados for insert
  to authenticated
  with check (public.current_user_has_admin_module('colaboradores'));

drop policy if exists "colaboradores_dados: modulo atualiza" on public.colaboradores_dados;
create policy "colaboradores_dados: modulo atualiza"
  on public.colaboradores_dados for update
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'))
  with check (public.current_user_has_admin_module('colaboradores'));

drop policy if exists "colaboradores_dados: modulo apaga" on public.colaboradores_dados;
create policy "colaboradores_dados: modulo apaga"
  on public.colaboradores_dados for delete
  to authenticated
  using (public.current_user_has_admin_module('colaboradores'));

-- ─── Grants ─────────────────────────────────────────────────────────────────
-- anon nunca; authenticated recebe os comandos, filtrados pela RLS acima.
revoke all on public.colaboradores_dados from anon;
grant select, insert, update, delete on public.colaboradores_dados to authenticated;

-- Deliberadamente FORA da publicacao `supabase_realtime`: o payload do WAL seria
-- enviado a todo cliente inscrito. A atualizacao e por invalidate do TanStack Query.
