-- Workspace RLS patch.
-- If this script errors with "cannot change return type of existing function",
-- the Supabase SQL Editor is still running an older pasted script. Clear the
-- editor completely and paste this current file. This file intentionally does
-- not create or replace any functions.
--
-- Run this after supabase/schema.sql, phase4_auth_patch.sql, and rbac_profiles.sql.
-- It lets owners/admins see and manage shared operational rows created by team
-- members while keeping normal users limited by role and app scoping.
--
-- This patch creates current_workspace_role() helpers so it does not depend on
-- any older current_app_role() function that may exist in the database.

create or replace function public.current_workspace_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text from public.profiles where user_id = auth.uid() and active = true),
    'crew'
  );
$$;

create or replace function public.current_workspace_profile_active()
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

-- Non-owner users need to discover the active owner user_id so the app can ask
-- for owner-owned workspace rows where their role allows it.
drop policy if exists "Active users read owner profiles" on public.profiles;
create policy "Active users read owner profiles"
  on public.profiles
  for select
  using (active = true and role::text = 'owner' and public.current_workspace_profile_active());

-- Shared workspace tables: team members can continue managing their own rows,
-- while owners/admins can read, update, and delete rows entered by anyone.
drop policy if exists "Owners and admins manage all rows" on public.customers;
create policy "Owners and admins manage all rows" on public.customers for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.estimates;
create policy "Owners and admins manage all rows" on public.estimates for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.estimate_items;
create policy "Owners and admins manage all rows" on public.estimate_items for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.jobs;
create policy "Owners and admins manage all rows" on public.jobs for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.job_items;
create policy "Owners and admins manage all rows" on public.job_items for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.tasks;
create policy "Owners and admins manage all rows" on public.tasks for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.time_entries;
create policy "Owners and admins manage all rows" on public.time_entries for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.shopping_lists;
create policy "Owners and admins manage all rows" on public.shopping_lists for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.shopping_list_items;
create policy "Owners and admins manage all rows" on public.shopping_list_items for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.material_orders;
create policy "Owners and admins manage all rows" on public.material_orders for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.material_order_items;
create policy "Owners and admins manage all rows" on public.material_order_items for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.suppliers;
create policy "Owners and admins manage all rows" on public.suppliers for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.allowances;
create policy "Owners and admins manage all rows" on public.allowances for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.allowance_selections;
create policy "Owners and admins manage all rows" on public.allowance_selections for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.workers;
create policy "Owners and admins manage all rows" on public.workers for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.receipts;
create policy "Owners and admins manage all rows" on public.receipts for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.job_photos;
create policy "Owners and admins manage all rows" on public.job_photos for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.notes;
create policy "Owners and admins manage all rows" on public.notes for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.activity_log;
create policy "Owners and admins manage all rows" on public.activity_log for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));

-- Owner-only financial tables: owners can see/manage rows regardless of who
-- created them, but non-owners still cannot read these tables through RLS.
drop policy if exists "Owners manage all financial rows" on public.expenses;
create policy "Owners manage all financial rows" on public.expenses for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoices;
create policy "Owners manage all financial rows" on public.invoices for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoice_items;
create policy "Owners manage all financial rows" on public.invoice_items for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.payments;
create policy "Owners manage all financial rows" on public.payments for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
