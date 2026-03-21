-- Centraliza aniversários em public.colaboradores.aniversario
-- e remove o fluxo legado baseado nas tabelas public.aniversarios
-- e public.reacoes_aniversario.

do $$
begin
  if to_regclass('public.aniversarios') is not null then
    with ranked_birthdays as (
      select
        colaborador_id,
        data_aniversario,
        row_number() over (
          partition by colaborador_id
          order by created_at desc, id desc
        ) as rn
      from public.aniversarios
      where data_aniversario is not null
    )
    update public.colaboradores c
    set aniversario = ranked_birthdays.data_aniversario
    from ranked_birthdays
    where ranked_birthdays.rn = 1
      and ranked_birthdays.colaborador_id = c.id
      and c.aniversario is null;
  end if;
end
$$;

drop table if exists public.reacoes_aniversario;
drop table if exists public.aniversarios;
