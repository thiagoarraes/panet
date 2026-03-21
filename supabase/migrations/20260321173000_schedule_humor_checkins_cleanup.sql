create extension if not exists pg_cron;

create or replace function public.cleanup_humor_checkins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.humor_checkins
  where data_ref < timezone('America/Sao_Paulo', now())::date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

select public.cleanup_humor_checkins();

select cron.schedule(
  'humor-checkins-daily-prune',
  '59 10 * * *',
  $$select public.cleanup_humor_checkins();$$
);
