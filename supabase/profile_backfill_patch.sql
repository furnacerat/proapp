-- Profile backfill and self-profile creation patch.
-- Run this after rbac_profiles.sql.
--
-- Why this exists:
-- RLS uses public.profiles to decide whether a signed-in user is an owner,
-- admin, crew, etc. If public.profiles is empty, current_app_role() falls back
-- to crew and owner/admin workspace visibility will not work.

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

drop policy if exists "Users insert own crew profile" on public.profiles;
create policy "Users insert own crew profile"
  on public.profiles
  for insert
  with check (
    auth.uid() = user_id
    and role in ('crew', 'viewer')
    and active = true
  );

select user_id, email, display_name, role, active
from public.profiles
order by email;
