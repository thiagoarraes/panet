with expanded_policies as (
  select
    tablename,
    policyname,
    roles,
    unnest(
      case
        when cmd = 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        else array[cmd]
      end
    ) as action
  from pg_policies
  where schemaname = 'public'
    and permissive = 'PERMISSIVE'
)
select
  tablename,
  action as cmd,
  roles,
  count(*) as policy_count,
  array_agg(policyname order by policyname) as policies
from expanded_policies
group by tablename, action, roles
having count(*) > 1
order by policy_count desc, tablename, action;
