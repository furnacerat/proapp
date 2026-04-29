-- RUN THIS FILE ONLY for the Team page.
-- Clear the Supabase SQL Editor first, then paste this whole file.
-- This does not touch the older current_app_role() function.

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

drop policy if exists "Owners and admins read profiles" on public.profiles;
create policy "Owners and admins read profiles" on public.profiles for select using (public.current_workspace_role() in ('owner', 'admin'));

drop policy if exists "Owners and admins manage profiles" on public.profiles;
create policy "Owners and admins manage profiles" on public.profiles for all using (public.current_workspace_role() in ('owner', 'admin')) with check (public.current_workspace_role() in ('owner', 'admin'));

select user_id, email, display_name, role, active
from public.profiles
order by email;
