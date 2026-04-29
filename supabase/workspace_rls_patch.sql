-- Workspace RLS patch.
-- Run this after supabase/schema.sql, phase4_auth_patch.sql, and rbac_profiles.sql.
-- It lets owners/admins see and manage shared operational rows created by team
-- members while keeping normal users limited by role and app scoping.
--
-- This patch expects public.current_app_role() and
-- public.current_profile_active() to already exist from rbac_profiles.sql.

-- Non-owner users need to discover the active owner user_id so the app can ask
-- for owner-owned workspace rows where their role allows it.
drop policy if exists "Active users read owner profiles" on public.profiles;
create policy "Active users read owner profiles"
  on public.profiles
  for select
  using (active = true and role = 'owner' and public.current_profile_active());

-- Shared workspace tables: team members can continue managing their own rows,
-- while owners/admins can read, update, and delete rows entered by anyone.
drop policy if exists "Owners and admins manage all rows" on public.customers;
create policy "Owners and admins manage all rows" on public.customers for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.estimates;
create policy "Owners and admins manage all rows" on public.estimates for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.estimate_items;
create policy "Owners and admins manage all rows" on public.estimate_items for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.jobs;
create policy "Owners and admins manage all rows" on public.jobs for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.job_items;
create policy "Owners and admins manage all rows" on public.job_items for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.tasks;
create policy "Owners and admins manage all rows" on public.tasks for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.time_entries;
create policy "Owners and admins manage all rows" on public.time_entries for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.shopping_lists;
create policy "Owners and admins manage all rows" on public.shopping_lists for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.shopping_list_items;
create policy "Owners and admins manage all rows" on public.shopping_list_items for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.material_orders;
create policy "Owners and admins manage all rows" on public.material_orders for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.material_order_items;
create policy "Owners and admins manage all rows" on public.material_order_items for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.suppliers;
create policy "Owners and admins manage all rows" on public.suppliers for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.allowances;
create policy "Owners and admins manage all rows" on public.allowances for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.allowance_selections;
create policy "Owners and admins manage all rows" on public.allowance_selections for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.workers;
create policy "Owners and admins manage all rows" on public.workers for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.receipts;
create policy "Owners and admins manage all rows" on public.receipts for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.job_photos;
create policy "Owners and admins manage all rows" on public.job_photos for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.notes;
create policy "Owners and admins manage all rows" on public.notes for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));
drop policy if exists "Owners and admins manage all rows" on public.activity_log;
create policy "Owners and admins manage all rows" on public.activity_log for all using (public.current_app_role() in ('owner', 'admin')) with check (public.current_app_role() in ('owner', 'admin'));

-- Owner-only financial tables: owners can see/manage rows regardless of who
-- created them, but non-owners still cannot read these tables through RLS.
drop policy if exists "Owners manage all financial rows" on public.expenses;
create policy "Owners manage all financial rows" on public.expenses for all using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoices;
create policy "Owners manage all financial rows" on public.invoices for all using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoice_items;
create policy "Owners manage all financial rows" on public.invoice_items for all using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.payments;
create policy "Owners manage all financial rows" on public.payments for all using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');
