-- Profile policy repair patch.
-- Run this after public.profiles has been backfilled.
--
-- Some databases may already have an older current_app_role() helper tied to
-- public.user_profiles. The app uses public.profiles, so these helpers use new
-- names and do not modify existing functions.

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

drop policy if exists "Owners and admins read profiles" on public.profiles;
create policy "Owners and admins read profiles"
  on public.profiles
  for select
  using (public.current_workspace_role() in ('owner', 'admin'));

drop policy if exists "Owners and admins manage profiles" on public.profiles;
create policy "Owners and admins manage profiles"
  on public.profiles
  for all
  using (public.current_workspace_role() in ('owner', 'admin'))
  with check (public.current_workspace_role() in ('owner', 'admin'));

drop policy if exists "Active users read owner profiles" on public.profiles;
create policy "Active users read owner profiles"
  on public.profiles
  for select
  using (active = true and role::text = 'owner' and public.current_workspace_profile_active());

select user_id, email, display_name, role, active
from public.profiles
order by email;
