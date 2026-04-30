-- RUN THIS FILE ONLY to add the Team -> Worker link column.
-- Clear the Supabase SQL Editor first, then paste this whole file.

alter table public.profiles add column if not exists worker_id text;

update public.profiles as profiles
set worker_id = workers.id
from public.workers as workers
where profiles.worker_id is null
  and lower(coalesce(profiles.email, '')) = lower(coalesce(workers.payload->>'email', ''));

select user_id, email, display_name, role, worker_id, active
from public.profiles
order by email;
