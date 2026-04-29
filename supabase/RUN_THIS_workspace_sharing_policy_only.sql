-- RUN THIS FILE ONLY for workspace sharing.
-- Clear the Supabase SQL Editor first, then paste this whole file.
-- This uses public.profiles through current_workspace_role().

create or replace function public.current_workspace_role() returns text language sql stable security definer set search_path = public as $$ select coalesce((select role::text from public.profiles where user_id = auth.uid() and active = true), 'crew'); $$;
create or replace function public.current_workspace_profile_active() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select active from public.profiles where user_id = auth.uid()), false); $$;

drop policy if exists "Active users read owner profiles" on public.profiles;
create policy "Active users read owner profiles" on public.profiles for select to authenticated using (active = true and role = 'owner' and public.current_workspace_profile_active() = true);

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

drop policy if exists "Owners manage all financial rows" on public.expenses;
create policy "Owners manage all financial rows" on public.expenses for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoices;
create policy "Owners manage all financial rows" on public.invoices for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.invoice_items;
create policy "Owners manage all financial rows" on public.invoice_items for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');
drop policy if exists "Owners manage all financial rows" on public.payments;
create policy "Owners manage all financial rows" on public.payments for all using (public.current_workspace_role() = 'owner') with check (public.current_workspace_role() = 'owner');

select tablename, policyname from pg_policies where schemaname = 'public' and policyname in ('Owners and admins manage all rows', 'Owners manage all financial rows') order by tablename;
