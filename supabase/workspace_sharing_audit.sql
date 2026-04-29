-- Workspace sharing audit.
-- Run this in Supabase SQL Editor to verify profiles, shared row ownership,
-- and the RLS policies that should allow owners/admins to see workspace data.

select
  'profiles' as section,
  user_id::text,
  email,
  role::text,
  active::text
from public.profiles
order by email;

with table_names(name) as (
  values
    ('customers'),
    ('estimates'),
    ('jobs'),
    ('tasks'),
    ('time_entries'),
    ('shopping_lists'),
    ('material_orders'),
    ('suppliers'),
    ('workers'),
    ('receipts'),
    ('allowances'),
    ('expenses'),
    ('invoices'),
    ('payments')
)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (select name from table_names)
order by tablename, policyname;

select 'customers' as table_name, user_id::text, count(*) from public.customers group by user_id
union all select 'estimates', user_id::text, count(*) from public.estimates group by user_id
union all select 'jobs', user_id::text, count(*) from public.jobs group by user_id
union all select 'tasks', user_id::text, count(*) from public.tasks group by user_id
union all select 'time_entries', user_id::text, count(*) from public.time_entries group by user_id
union all select 'shopping_lists', user_id::text, count(*) from public.shopping_lists group by user_id
union all select 'material_orders', user_id::text, count(*) from public.material_orders group by user_id
union all select 'suppliers', user_id::text, count(*) from public.suppliers group by user_id
union all select 'workers', user_id::text, count(*) from public.workers group by user_id
union all select 'receipts', user_id::text, count(*) from public.receipts group by user_id
union all select 'allowances', user_id::text, count(*) from public.allowances group by user_id
union all select 'expenses', user_id::text, count(*) from public.expenses group by user_id
union all select 'invoices', user_id::text, count(*) from public.invoices group by user_id
union all select 'payments', user_id::text, count(*) from public.payments group by user_id
order by table_name, user_id;
