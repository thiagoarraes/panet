-- RPC para carregar aniversariantes com reações do ano em uma única chamada.
create or replace function public.get_aniversariantes_with_reacoes(p_ano int)
returns table (
  id uuid,
  nome text,
  cargo text,
  email text,
  telefone text,
  cor_avatar text,
  foto_url text,
  instagram text,
  linkedin text,
  github text,
  aniversario date,
  reacoes uuid[]
)
language sql
stable
as $$
  with reacoes as (
    select
      ap.aniversariante_id,
      array_agg(ap.colaborador_id order by ap.created_at asc) as reacoes
    from public.aniversario_parabenizacoes ap
    where ap.ano_ref = p_ano
    group by ap.aniversariante_id
  )
  select
    c.id,
    c.nome,
    c.cargo,
    c.email,
    c.telefone,
    c.cor_avatar,
    c.foto_url,
    c.instagram,
    c.linkedin,
    c.github,
    c.aniversario,
    coalesce(r.reacoes, '{}') as reacoes
  from public.colaboradores c
  left join reacoes r on r.aniversariante_id = c.id
  where c.aniversario is not null;
$$;

grant execute on function public.get_aniversariantes_with_reacoes(int) to authenticated;
