with public_fks as (
  select
    c.conrelid as table_oid,
    c.conrelid::regclass::text as table_name,
    c.conname,
    c.conkey
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f'
    and n.nspname = 'public'
)
select
  f.table_name,
  f.conname as fk_name
from public_fks f
where not exists (
  select 1
  from pg_index i
  where i.indrelid = f.table_oid
    and i.indisvalid
    and i.indpred is null
    and (i.indkey::int2[])[
      0:(array_length(f.conkey, 1) - 1)
    ] = f.conkey
)
order by f.table_name, f.conname;
