-- RUN THIS FILE ONLY for crew assignment-specific RLS.
-- Clear the Supabase SQL Editor first, then paste this whole file.
-- Crew assignment is matched by public.workers payload email == auth.email().

create or replace function public.current_workspace_role() returns text language sql stable security definer set search_path = public as $$ select coalesce((select role::text from public.profiles where user_id = auth.uid() and active = true), 'crew'); $$;

create or replace function public.current_workspace_worker_ids() returns text[] language sql stable security definer set search_path = public as $$ select coalesce(array_agg(id::text), array[]::text[]) from public.workers where lower(coalesce(payload->>'email', '')) = lower(coalesce(auth.email(), '')); $$;

create or replace function public.row_assigned_to_current_worker(row_payload jsonb, row_worker_id text) returns boolean language sql stable security definer set search_path = public as $$ select coalesce(row_worker_id, row_payload->>'workerId', row_payload->>'worker_id', row_payload->>'assignedTo') = any(public.current_workspace_worker_ids()); $$;

create or replace function public.job_assigned_to_current_worker(target_job_id text) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.tasks where job_id = target_job_id and public.row_assigned_to_current_worker(payload, worker_id)); $$;

drop policy if exists "Crew read own worker row" on public.workers;
create policy "Crew read own worker row" on public.workers for select using (public.current_workspace_role() = 'crew' and id = any(public.current_workspace_worker_ids()));

drop policy if exists "Crew read assigned tasks" on public.tasks;
create policy "Crew read assigned tasks" on public.tasks for select using (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id));
drop policy if exists "Crew update assigned tasks" on public.tasks;
create policy "Crew update assigned tasks" on public.tasks for update using (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id)) with check (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id));

drop policy if exists "Crew read assigned jobs" on public.jobs;
create policy "Crew read assigned jobs" on public.jobs for select using (public.current_workspace_role() = 'crew' and public.job_assigned_to_current_worker(id));

drop policy if exists "Crew read assigned time entries" on public.time_entries;
create policy "Crew read assigned time entries" on public.time_entries for select using (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id));
drop policy if exists "Crew update assigned time entries" on public.time_entries;
create policy "Crew update assigned time entries" on public.time_entries for update using (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id)) with check (public.current_workspace_role() = 'crew' and public.row_assigned_to_current_worker(payload, worker_id));

drop policy if exists "Crew read assigned shopping lists" on public.shopping_lists;
create policy "Crew read assigned shopping lists" on public.shopping_lists for select using (public.current_workspace_role() = 'crew' and public.job_assigned_to_current_worker(job_id));

drop policy if exists "Crew read assigned notes" on public.notes;
create policy "Crew read assigned notes" on public.notes for select using (public.current_workspace_role() = 'crew' and public.job_assigned_to_current_worker(job_id));

drop policy if exists "Crew read assigned photos" on public.job_photos;
create policy "Crew read assigned photos" on public.job_photos for select using (public.current_workspace_role() = 'crew' and public.job_assigned_to_current_worker(job_id));

select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'Crew %' order by tablename, policyname;
