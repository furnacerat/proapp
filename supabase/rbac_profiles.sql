-- Role-based access and profile management.
-- Run after supabase/schema.sql and phase4_auth_patch.sql.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'crew',
  job_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer'))
);

alter table public.profiles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where user_id = auth.uid() and active = true),
    'crew'
  );
$$;

create or replace function public.current_profile_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active from public.profiles where user_id = auth.uid()),
    false
  );
$$;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.prevent_self_role_or_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.user_id and public.current_app_role() not in ('owner', 'admin') then
    if new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.email is distinct from old.email
      or new.user_id is distinct from old.user_id then
      raise exception 'Users may only update their own display_name and job_title.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_or_status_change on public.profiles;
create trigger profiles_prevent_self_role_or_status_change
before update on public.profiles
for each row execute function public.prevent_self_role_or_status_change();

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name, role, job_title, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'crew'),
    new.raw_user_meta_data->>'job_title',
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

insert into public.profiles (user_id, email, display_name, role, job_title, active)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data->>'display_name', users.email, 'User'),
  case
    when users.raw_user_meta_data->>'role' in ('owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer')
      then users.raw_user_meta_data->>'role'
    else 'owner'
  end,
  users.raw_user_meta_data->>'job_title',
  true
from auth.users as users
on conflict (user_id) do update
set
  email = excluded.email,
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  role = case
    when public.profiles.role in ('owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer')
      then public.profiles.role
    else excluded.role
  end,
  active = true,
  updated_at = now();

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Owners and admins read profiles" on public.profiles;
create policy "Owners and admins read profiles"
  on public.profiles
  for select
  using (public.current_app_role() in ('owner', 'admin'));

drop policy if exists "Users update own display fields" on public.profiles;
create policy "Users update own display fields"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users insert own crew profile" on public.profiles;
create policy "Users insert own crew profile"
  on public.profiles
  for insert
  with check (
    auth.uid() = user_id
    and role in ('crew', 'viewer')
    and active = true
  );

drop policy if exists "Owners and admins manage profiles" on public.profiles;
create policy "Owners and admins manage profiles"
  on public.profiles
  for all
  using (public.current_app_role() in ('owner', 'admin'))
  with check (public.current_app_role() in ('owner', 'admin'));

-- Replace generic per-user policies on owner-only financial tables.
-- RLS policies are additive, so the broad policies must be removed here.
drop policy if exists "Users manage own rows" on public.expenses;
drop policy if exists "Only owners manage expenses" on public.expenses;
create policy "Only owners manage expenses"
  on public.expenses
  for all
  using (auth.uid() = user_id and public.current_app_role() = 'owner')
  with check (auth.uid() = user_id and public.current_app_role() = 'owner');

drop policy if exists "Users manage own rows" on public.invoices;
drop policy if exists "Only owners manage invoices" on public.invoices;
create policy "Only owners manage invoices"
  on public.invoices
  for all
  using (auth.uid() = user_id and public.current_app_role() = 'owner')
  with check (auth.uid() = user_id and public.current_app_role() = 'owner');

drop policy if exists "Users manage own rows" on public.payments;
drop policy if exists "Only owners manage payments" on public.payments;
create policy "Only owners manage payments"
  on public.payments
  for all
  using (auth.uid() = user_id and public.current_app_role() = 'owner')
  with check (auth.uid() = user_id and public.current_app_role() = 'owner');

drop policy if exists "Users manage own rows" on public.invoice_items;
drop policy if exists "Only owners manage invoice items" on public.invoice_items;
create policy "Only owners manage invoice items"
  on public.invoice_items
  for all
  using (auth.uid() = user_id and public.current_app_role() = 'owner')
  with check (auth.uid() = user_id and public.current_app_role() = 'owner');
