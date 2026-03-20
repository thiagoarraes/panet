select
  calls,
  round(mean_exec_time::numeric, 2) as mean_ms,
  round(total_exec_time::numeric, 2) as total_ms,
  left(query, 240) as query_excerpt
from pg_stat_statements
where query ilike '%postagens%'
   or query ilike '%colaboradores%'
   or query ilike '%mural%'
   or query ilike '%ferias%'
   or query ilike '%ausencias%'
   or query ilike '%get_aniversariantes_with_reacoes%'
   or query ilike '%get_my_amigo_secreto_results%'
order by total_exec_time desc
limit 25;

