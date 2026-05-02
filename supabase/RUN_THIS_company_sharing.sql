-- Company-owned sharing model for Allen's Contractor's.
-- Run this after schema.sql, phase4_auth_patch.sql, and rbac_profiles.sql.
-- It is safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'crew',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint company_members_role_check check (role in ('owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer')),
  constraint company_members_company_user_unique unique (company_id, user_id)
);

alter table public.profiles add column if not exists company_id uuid null references public.companies(id);

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.company_member_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.company_members
      where company_id = target_company_id
        and user_id = auth.uid()
        and active = true
      limit 1
    ),
    'viewer'
  );
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists "Members read their companies" on public.companies;
create policy "Members read their companies"
  on public.companies
  for select
  to authenticated
  using (public.is_company_member(id));

drop policy if exists "Members read company memberships" on public.company_members;
create policy "Members read company memberships"
  on public.company_members
  for select
  to authenticated
  using (public.is_company_member(company_id));

drop policy if exists "Owners and admins manage company memberships" on public.company_members;
create policy "Owners and admins manage company memberships"
  on public.company_members
  for all
  to authenticated
  using (public.company_member_role(company_id) in ('owner', 'admin'))
  with check (public.company_member_role(company_id) in ('owner', 'admin'));

insert into public.companies (name, active)
select 'Allen''s Contractor''s', true
where not exists (select 1 from public.companies where name = 'Allen''s Contractor''s');

do $$
declare
  default_company_id uuid;
begin
  select id into default_company_id
  from public.companies
  where name = 'Allen''s Contractor''s'
  order by created_at
  limit 1;

  insert into public.company_members (company_id, user_id, role, active)
  select
    default_company_id,
    profiles.user_id,
    case
      when profiles.role in ('owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer') then profiles.role
      else 'crew'
    end,
    coalesce(profiles.active, true)
  from public.profiles
  where profiles.user_id is not null
  on conflict (company_id, user_id) do update
  set
    role = excluded.role,
    active = excluded.active;

  update public.profiles
  set company_id = default_company_id
  where company_id is null;
end $$;

do $$
declare
  table_name text;
  default_company_id uuid;
  fallback_creator uuid;
  shared_tables text[] := array[
    'customers',
    'estimates',
    'estimate_items',
    'jobs',
    'job_items',
    'tasks',
    'expenses',
    'time_entries',
    'invoices',
    'invoice_items',
    'payments',
    'shopping_lists',
    'shopping_list_items',
    'material_orders',
    'material_order_items',
    'suppliers',
    'allowances',
    'allowance_selections',
    'labor_rates',
    'materials',
    'assemblies',
    'templates',
    'project_type_templates',
    'workers',
    'receipts',
    'job_photos',
    'notes',
    'activity_log'
  ];
begin
  select id into default_company_id
  from public.companies
  where name = 'Allen''s Contractor''s'
  order by created_at
  limit 1;

  select user_id into fallback_creator
  from public.company_members
  where company_id = default_company_id
    and role = 'owner'
  order by created_at
  limit 1;

  if fallback_creator is null then
    select user_id into fallback_creator
    from public.company_members
    where company_id = default_company_id
    order by created_at
    limit 1;
  end if;

  foreach table_name in array shared_tables loop
    execute format('alter table public.%I add column if not exists company_id uuid null references public.companies(id)', table_name);
    execute format('alter table public.%I add column if not exists created_by uuid null references auth.users(id)', table_name);
    execute format('create index if not exists %I on public.%I (company_id)', table_name || '_company_id_idx', table_name);
    execute format('update public.%I set company_id = coalesce(company_id, $1), created_by = coalesce(created_by, user_id, $2)', table_name)
      using default_company_id, fallback_creator;
  end loop;
end $$;

drop policy if exists "Users manage own rows" on public.customers;
drop policy if exists "Owners and admins manage all rows" on public.customers;
drop policy if exists "Company members read rows" on public.customers;
create policy "Company members read rows" on public.customers for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.customers;
create policy "Company members insert rows" on public.customers for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.customers;
create policy "Company members update rows" on public.customers for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.customers;
create policy "Company members delete rows" on public.customers for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.estimates;
drop policy if exists "Owners and admins manage all rows" on public.estimates;
drop policy if exists "Company members read rows" on public.estimates;
create policy "Company members read rows" on public.estimates for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.estimates;
create policy "Company members insert rows" on public.estimates for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.estimates;
create policy "Company members update rows" on public.estimates for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.estimates;
create policy "Company members delete rows" on public.estimates for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.estimate_items;
drop policy if exists "Owners and admins manage all rows" on public.estimate_items;
drop policy if exists "Company members read rows" on public.estimate_items;
create policy "Company members read rows" on public.estimate_items for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.estimate_items;
create policy "Company members insert rows" on public.estimate_items for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.estimate_items;
create policy "Company members update rows" on public.estimate_items for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.estimate_items;
create policy "Company members delete rows" on public.estimate_items for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.jobs;
drop policy if exists "Owners and admins manage all rows" on public.jobs;
drop policy if exists "Company members read rows" on public.jobs;
create policy "Company members read rows" on public.jobs for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.jobs;
create policy "Company members insert rows" on public.jobs for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.jobs;
create policy "Company members update rows" on public.jobs for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.jobs;
create policy "Company members delete rows" on public.jobs for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.tasks;
drop policy if exists "Owners and admins manage all rows" on public.tasks;
drop policy if exists "Company members read rows" on public.tasks;
create policy "Company members read rows" on public.tasks for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.tasks;
create policy "Company members insert rows" on public.tasks for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.tasks;
create policy "Company members update rows" on public.tasks for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.tasks;
create policy "Company members delete rows" on public.tasks for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.expenses;
drop policy if exists "Only owners manage expenses" on public.expenses;
drop policy if exists "Owners manage all financial rows" on public.expenses;
drop policy if exists "Company members read rows" on public.expenses;
create policy "Company members read rows" on public.expenses for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.expenses;
create policy "Company members insert rows" on public.expenses for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.expenses;
create policy "Company members update rows" on public.expenses for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.expenses;
create policy "Company members delete rows" on public.expenses for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.time_entries;
drop policy if exists "Owners and admins manage all rows" on public.time_entries;
drop policy if exists "Company members read rows" on public.time_entries;
create policy "Company members read rows" on public.time_entries for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.time_entries;
create policy "Company members insert rows" on public.time_entries for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.time_entries;
create policy "Company members update rows" on public.time_entries for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.time_entries;
create policy "Company members delete rows" on public.time_entries for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.invoices;
drop policy if exists "Only owners manage invoices" on public.invoices;
drop policy if exists "Owners manage all financial rows" on public.invoices;
drop policy if exists "Company members read rows" on public.invoices;
create policy "Company members read rows" on public.invoices for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.invoices;
create policy "Company members insert rows" on public.invoices for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.invoices;
create policy "Company members update rows" on public.invoices for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.invoices;
create policy "Company members delete rows" on public.invoices for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.payments;
drop policy if exists "Only owners manage payments" on public.payments;
drop policy if exists "Owners manage all financial rows" on public.payments;
drop policy if exists "Company members read rows" on public.payments;
create policy "Company members read rows" on public.payments for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.payments;
create policy "Company members insert rows" on public.payments for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.payments;
create policy "Company members update rows" on public.payments for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.payments;
create policy "Company members delete rows" on public.payments for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.shopping_lists;
drop policy if exists "Owners and admins manage all rows" on public.shopping_lists;
drop policy if exists "Company members read rows" on public.shopping_lists;
create policy "Company members read rows" on public.shopping_lists for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.shopping_lists;
create policy "Company members insert rows" on public.shopping_lists for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.shopping_lists;
create policy "Company members update rows" on public.shopping_lists for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.shopping_lists;
create policy "Company members delete rows" on public.shopping_lists for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.material_orders;
drop policy if exists "Owners and admins manage all rows" on public.material_orders;
drop policy if exists "Company members read rows" on public.material_orders;
create policy "Company members read rows" on public.material_orders for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.material_orders;
create policy "Company members insert rows" on public.material_orders for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.material_orders;
create policy "Company members update rows" on public.material_orders for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.material_orders;
create policy "Company members delete rows" on public.material_orders for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.suppliers;
drop policy if exists "Owners and admins manage all rows" on public.suppliers;
drop policy if exists "Company members read rows" on public.suppliers;
create policy "Company members read rows" on public.suppliers for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.suppliers;
create policy "Company members insert rows" on public.suppliers for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.suppliers;
create policy "Company members update rows" on public.suppliers for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.suppliers;
create policy "Company members delete rows" on public.suppliers for delete to authenticated using (public.is_company_member(company_id));

drop policy if exists "Users manage own rows" on public.allowances;
drop policy if exists "Owners and admins manage all rows" on public.allowances;
drop policy if exists "Company members read rows" on public.allowances;
create policy "Company members read rows" on public.allowances for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.allowances;
create policy "Company members insert rows" on public.allowances for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.allowances;
create policy "Company members update rows" on public.allowances for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company members delete rows" on public.allowances;
create policy "Company members delete rows" on public.allowances for delete to authenticated using (public.is_company_member(company_id));

do $$
declare
  table_name text;
  extra_tables text[] := array[
    'job_items',
    'invoice_items',
    'shopping_list_items',
    'material_order_items',
    'allowance_selections',
    'labor_rates',
    'materials',
    'assemblies',
    'templates',
    'project_type_templates',
    'workers',
    'receipts',
    'job_photos',
    'notes',
    'activity_log'
  ];
begin
  foreach table_name in array extra_tables loop
    execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
    execute format('drop policy if exists "Owners and admins manage all rows" on public.%I', table_name);
    execute format('drop policy if exists "Only owners manage invoice items" on public.%I', table_name);
    execute format('drop policy if exists "Owners manage all financial rows" on public.%I', table_name);
    execute format('drop policy if exists "Company members read rows" on public.%I', table_name);
    execute format('create policy "Company members read rows" on public.%I for select to authenticated using (public.is_company_member(company_id))', table_name);
    execute format('drop policy if exists "Company members insert rows" on public.%I', table_name);
    execute format('create policy "Company members insert rows" on public.%I for insert to authenticated with check (public.is_company_member(company_id))', table_name);
    execute format('drop policy if exists "Company members update rows" on public.%I', table_name);
    execute format('create policy "Company members update rows" on public.%I for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', table_name);
    execute format('drop policy if exists "Company members delete rows" on public.%I', table_name);
    execute format('create policy "Company members delete rows" on public.%I for delete to authenticated using (public.is_company_member(company_id))', table_name);
  end loop;
end $$;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owners and admins read profiles" on public.profiles;
drop policy if exists "Owners and admins manage profiles" on public.profiles;
drop policy if exists "Active users read owner profiles" on public.profiles;

drop policy if exists "Company members read company profiles" on public.profiles;
create policy "Company members read company profiles"
  on public.profiles
  for select
  to authenticated
  using (company_id is not null and public.is_company_member(company_id));

drop policy if exists "Owners and admins manage company profiles" on public.profiles;
create policy "Owners and admins manage company profiles"
  on public.profiles
  for all
  to authenticated
  using (company_id is not null and public.company_member_role(company_id) in ('owner', 'admin'))
  with check (company_id is not null and public.company_member_role(company_id) in ('owner', 'admin'));

select
  companies.id as company_id,
  companies.name,
  count(company_members.id) as active_members
from public.companies
left join public.company_members on company_members.company_id = companies.id and company_members.active = true
where companies.name = 'Allen''s Contractor''s'
group by companies.id, companies.name;

