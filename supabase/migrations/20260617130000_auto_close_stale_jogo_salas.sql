-- Auto-close de salas de adedonha abandonadas.
-- Se o host sai/fecha a aba no meio da partida, ninguém dispara as transições
-- de fase e a sala fica "jogando" para sempre — clientes abertos seguem em loop
-- martelando o banco. Este job encerra salas sem atividade há 15+ min.
-- (updated_at é atualizado pelo trigger trg_jogo_salas_updated_at a cada
-- mudança de fase/rodada; durante o jogo normal a maior folga entre updates é
-- ~150s, então 15 min só pega sala realmente abandonada.)

create extension if not exists pg_cron;

create or replace function public.auto_close_stale_jogo_salas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer;
begin
  update public.jogo_salas
  set status = 'encerrada', fase = 'fim'
  where (status <> 'encerrada' or fase <> 'fim')
    and updated_at < now() - interval '15 minutes';

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

-- A cada 5 minutos.
select cron.schedule(
  'jogo-salas-auto-close-stale',
  '*/5 * * * *',
  $$select public.auto_close_stale_jogo_salas();$$
);
