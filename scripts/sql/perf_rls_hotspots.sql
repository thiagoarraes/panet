select
  schemaname,
  tablename,
  policyname,
  cmd,
  case
    when coalesce(qual, '') ~* 'auth\.uid\s*\('
      and coalesce(qual, '') !~* 'select\s+auth\.uid\s*\('
      then 'qual_auth_uid_direct'
    when coalesce(with_check, '') ~* 'auth\.uid\s*\('
      and coalesce(with_check, '') !~* 'select\s+auth\.uid\s*\('
      then 'with_check_auth_uid_direct'
    when coalesce(qual, '') ~* 'auth\.role\s*\('
      and coalesce(qual, '') !~* 'select\s+auth\.role\s*\('
      then 'qual_auth_role_direct'
    when coalesce(with_check, '') ~* 'auth\.role\s*\('
      and coalesce(with_check, '') !~* 'select\s+auth\.role\s*\('
      then 'with_check_auth_role_direct'
    else 'other'
  end as issue,
  coalesce(qual, '') as qual,
  coalesce(with_check, '') as with_check
from pg_policies
where schemaname = 'public'
  and (
    (coalesce(qual, '') ~* 'auth\.uid\s*\('
      and coalesce(qual, '') !~* 'select\s+auth\.uid\s*\(')
    or (coalesce(with_check, '') ~* 'auth\.uid\s*\('
      and coalesce(with_check, '') !~* 'select\s+auth\.uid\s*\(')
    or (coalesce(qual, '') ~* 'auth\.role\s*\('
      and coalesce(qual, '') !~* 'select\s+auth\.role\s*\(')
    or (coalesce(with_check, '') ~* 'auth\.role\s*\('
      and coalesce(with_check, '') !~* 'select\s+auth\.role\s*\(')
  )
order by tablename, policyname;
