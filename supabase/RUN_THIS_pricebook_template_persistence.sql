-- Adds the missing workspace-backed collections used by starter templates and price books.
-- Run after the base schema and company sharing scripts.

create table if not exists public.labor_rates (like public.customers including all);
create table if not exists public.materials (like public.customers including all);
create table if not exists public.assemblies (like public.customers including all);
create table if not exists public.templates (like public.customers including all);
create table if not exists public.project_type_templates (like public.customers including all);

do $$
declare
  table_name text;
  default_company_id uuid;
  fallback_creator uuid;
  tables text[] := array[
    'labor_rates',
    'materials',
    'assemblies',
    'templates',
    'project_type_templates'
  ];
begin
  select id into default_company_id
  from public.companies
  where name = 'Allen''s Contractor''s'
  order by created_at
  limit 1;

  if default_company_id is null then
    select id into default_company_id
    from public.companies
    order by created_at
    limit 1;
  end if;

  select user_id into fallback_creator
  from public.profiles
  where company_id = default_company_id
  order by created_at
  limit 1;

  if fallback_creator is null then
    select id into fallback_creator
    from auth.users
    order by created_at
    limit 1;
  end if;

  foreach table_name in array tables loop
    execute format('alter table public.%I add column if not exists title text', table_name);
    execute format('alter table public.%I add column if not exists company_id uuid null references public.companies(id)', table_name);
    execute format('alter table public.%I add column if not exists created_by uuid null references auth.users(id)', table_name);
    execute format('create index if not exists %I on public.%I (company_id)', table_name || '_company_id_idx', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('update public.%I set company_id = coalesce(company_id, $1), created_by = coalesce(created_by, user_id, $2)', table_name)
      using default_company_id, fallback_creator;

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
    execute format('drop policy if exists "Company owners delete rows" on public.%I', table_name);
    execute format('create policy "Company owners delete rows" on public.%I for delete to authenticated using (public.current_company_role(company_id) = any(array[''owner'', ''admin'']))', table_name);
  end loop;
end $$;
