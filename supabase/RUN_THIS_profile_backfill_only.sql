-- RUN THIS FILE ONLY.
-- Clear the Supabase SQL Editor first, then paste this entire file.
-- This file intentionally contains no trigger or function definitions.

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

select user_id, email, display_name, role, active
from public.profiles
order by email;
