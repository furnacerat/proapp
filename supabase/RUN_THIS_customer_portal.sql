-- Customer portal foundation: token-backed public reads and approval actions.
-- Run after the base schema and company sharing scripts.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.change_orders') is not null then
    execute 'drop policy if exists "Users manage own rows" on public.change_orders';
  end if;
  if to_regclass('public.portal_tokens') is not null then
    execute 'drop policy if exists "Users manage own rows" on public.portal_tokens';
  end if;
  if to_regclass('public.signature_requests') is not null then
    execute 'drop policy if exists "Users manage own rows" on public.signature_requests';
  end if;
end $$;

create table if not exists public.portal_tokens (like public.customers including all);
create table if not exists public.change_orders (like public.customers including all);
create table if not exists public.signature_requests (like public.customers including all);
alter table public.portal_tokens add column if not exists title text;
alter table public.change_orders add column if not exists title text;
alter table public.signature_requests add column if not exists title text;
alter table public.portal_tokens add column if not exists company_id uuid null references public.companies(id);
alter table public.portal_tokens add column if not exists created_by uuid null references auth.users(id);
alter table public.change_orders add column if not exists company_id uuid null references public.companies(id);
alter table public.change_orders add column if not exists created_by uuid null references auth.users(id);
alter table public.signature_requests add column if not exists company_id uuid null references public.companies(id);
alter table public.signature_requests add column if not exists created_by uuid null references auth.users(id);
create index if not exists portal_tokens_company_id_idx on public.portal_tokens (company_id);
create index if not exists portal_tokens_hash_idx on public.portal_tokens ((payload->>'tokenHash'));
create index if not exists change_orders_company_id_idx on public.change_orders (company_id);
create index if not exists change_orders_job_id_idx on public.change_orders (job_id);
create index if not exists signature_requests_company_id_idx on public.signature_requests (company_id);
create index if not exists signature_requests_customer_id_idx on public.signature_requests (customer_id);
create index if not exists signature_requests_job_id_idx on public.signature_requests (job_id);
alter table public.portal_tokens enable row level security;
alter table public.change_orders enable row level security;
alter table public.signature_requests enable row level security;

drop policy if exists "Users manage own rows" on public.portal_tokens;
drop policy if exists "Users manage own rows" on public.change_orders;
drop policy if exists "Users manage own rows" on public.signature_requests;
drop policy if exists "Company members read rows" on public.portal_tokens;
drop policy if exists "Company members read rows" on public.change_orders;
drop policy if exists "Company members read rows" on public.signature_requests;
create policy "Company members read rows" on public.portal_tokens
  for select to authenticated using (public.is_company_member(company_id));
create policy "Company members read rows" on public.change_orders
  for select to authenticated using (public.is_company_member(company_id));
create policy "Company members read rows" on public.signature_requests
  for select to authenticated using (public.is_company_member(company_id));
drop policy if exists "Company members insert rows" on public.portal_tokens;
drop policy if exists "Company members insert rows" on public.change_orders;
drop policy if exists "Company members insert rows" on public.signature_requests;
create policy "Company members insert rows" on public.portal_tokens
  for insert to authenticated with check (public.is_company_member(company_id));
create policy "Company members insert rows" on public.change_orders
  for insert to authenticated with check (public.is_company_member(company_id));
create policy "Company members insert rows" on public.signature_requests
  for insert to authenticated with check (public.is_company_member(company_id));
drop policy if exists "Company members update rows" on public.portal_tokens;
drop policy if exists "Company members update rows" on public.change_orders;
drop policy if exists "Company members update rows" on public.signature_requests;
create policy "Company members update rows" on public.portal_tokens
  for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "Company members update rows" on public.change_orders
  for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "Company members update rows" on public.signature_requests
  for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "Company owners delete rows" on public.portal_tokens;
drop policy if exists "Company owners delete rows" on public.change_orders;
drop policy if exists "Company owners delete rows" on public.signature_requests;
create policy "Company owners delete rows" on public.portal_tokens
  for delete to authenticated using (public.current_company_role(company_id) = any(array['owner', 'admin']));
create policy "Company owners delete rows" on public.change_orders
  for delete to authenticated using (public.current_company_role(company_id) = any(array['owner', 'admin']));
create policy "Company owners delete rows" on public.signature_requests
  for delete to authenticated using (public.current_company_role(company_id) = any(array['owner', 'admin']));

create or replace function public.get_customer_portal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  access_payload jsonb;
  customer_payload jsonb;
  customer_id text;
  scoped_job_id text;
  job_ids text[];
begin
  select payload into access_payload
  from public.portal_tokens
  where payload->>'tokenHash' = token_hash
    and coalesce((payload->>'active')::boolean, true)
    and (
      payload->>'expiresAt' is null
      or (payload->>'expiresAt')::timestamptz > now()
    )
  limit 1;

  if access_payload is null then
    return null;
  end if;

  customer_id := access_payload->>'customerId';
  scoped_job_id := nullif(access_payload->>'jobId', '');

  select payload into customer_payload
  from public.customers
  where id = customer_id or payload->>'id' = customer_id
  limit 1;

  if customer_payload is null then
    return null;
  end if;

  select coalesce(array_agg(id), array[]::text[]) into job_ids
  from public.jobs
  where (scoped_job_id is not null and id = scoped_job_id)
     or (scoped_job_id is null and payload->>'customerId' = customer_id);

  update public.portal_tokens
  set payload = payload || jsonb_build_object('lastUsedAt', now()::text),
      updated_at = now()
  where payload->>'tokenHash' = token_hash;

  return jsonb_build_object(
    'access', access_payload,
    'customer', customer_payload,
    'jobs', coalesce((select jsonb_agg(payload order by updated_at desc) from public.jobs where id = any(job_ids)), '[]'::jsonb),
    'estimates', coalesce((select jsonb_agg(payload order by updated_at desc) from public.estimates where payload->>'customerId' = customer_id), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(payload order by updated_at desc) from public.invoices where payload->>'customerId' = customer_id or payload->>'jobId' = any(job_ids)), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(payload order by created_at desc) from public.payments where payload->>'invoiceId' in (select id from public.invoices where payload->>'customerId' = customer_id or payload->>'jobId' = any(job_ids))), '[]'::jsonb),
    'changeOrders', coalesce((select jsonb_agg(payload order by updated_at desc) from public.change_orders where payload->>'jobId' = any(job_ids)), '[]'::jsonb),
    'signatureRequests', coalesce((select jsonb_agg(payload order by updated_at desc) from public.signature_requests where payload->>'customerId' = customer_id and (scoped_job_id is null or payload->>'jobId' = scoped_job_id)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(payload order by created_at desc) from public.notes where payload->>'jobId' = any(job_ids) and payload->>'clientVisible' = 'true'), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(payload order by created_at desc) from public.job_photos where payload->>'jobId' = any(job_ids) and coalesce(payload->>'clientVisible', 'true') <> 'false'), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(payload order by created_at desc) from public.activity_log where payload->>'jobId' = any(job_ids) and payload->>'type' = any(array['update', 'photo', 'change_order', 'invoice', 'payment'])), '[]'::jsonb)
  );
end $$;

create or replace function public.portal_approve_estimate(p_token text, p_estimate_id text, p_customer_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  portal jsonb;
  customer_id text;
begin
  portal := public.get_customer_portal(p_token);
  if portal is null then
    raise exception 'Invalid portal token';
  end if;

  customer_id := portal->'customer'->>'id';

  update public.estimates
  set status = 'approved',
      payload = payload || jsonb_build_object(
        'status', 'approved',
        'viewedAt', coalesce(payload->>'viewedAt', now()::text),
        'approvedAt', now()::text,
        'approvedBy', p_customer_name,
        'updatedAt', now()::text
      ),
      updated_at = now()
  where id = p_estimate_id
    and payload->>'customerId' = customer_id;
end $$;

create or replace function public.portal_approve_change_order(p_token text, p_change_order_id text, p_customer_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  portal jsonb;
begin
  portal := public.get_customer_portal(p_token);
  if portal is null then
    raise exception 'Invalid portal token';
  end if;

  update public.change_orders
  set status = 'approved',
      payload = payload || jsonb_build_object(
        'status', 'approved',
        'approvedAt', now()::text,
        'approvedBy', p_customer_name,
        'updatedAt', now()::text
      ),
      updated_at = now()
  where id = p_change_order_id
    and payload->>'jobId' in (
      select value->>'id'
      from jsonb_array_elements(portal->'jobs') value
    );
end $$;

create or replace function public.portal_sign_document(
  p_token text,
  p_request_id text,
  p_signature_text text,
  p_signature_data_url text,
  p_signer_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  portal jsonb;
  customer_id text;
  current_audit jsonb;
begin
  portal := public.get_customer_portal(p_token);
  if portal is null then
    raise exception 'Invalid portal token';
  end if;

  customer_id := portal->'customer'->>'id';

  select coalesce(payload->'auditTrail', '[]'::jsonb) into current_audit
  from public.signature_requests
  where id = p_request_id
    and payload->>'customerId' = customer_id;

  update public.signature_requests
  set status = 'signed',
      payload = payload || jsonb_build_object(
        'status', 'signed',
        'signatureText', p_signature_text,
        'signatureDataUrl', p_signature_data_url,
        'signerName', p_signer_name,
        'viewedAt', coalesce(payload->>'viewedAt', now()::text),
        'signedAt', now()::text,
        'updatedAt', now()::text,
        'auditTrail', coalesce(current_audit, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'event', 'document_signed',
          'timestamp', now()::text,
          'actor', p_signer_name,
          'details', 'Signed from customer portal'
        ))
      ),
      updated_at = now()
  where id = p_request_id
    and payload->>'customerId' = customer_id
    and (
      nullif(portal->'access'->>'jobId', '') is null
      or payload->>'jobId' = portal->'access'->>'jobId'
    );
end $$;

revoke all on function public.get_customer_portal(text) from public;
revoke all on function public.portal_approve_estimate(text, text, text) from public;
revoke all on function public.portal_approve_change_order(text, text, text) from public;
revoke all on function public.portal_sign_document(text, text, text, text, text) from public;
grant execute on function public.get_customer_portal(text) to anon, authenticated;
grant execute on function public.portal_approve_estimate(text, text, text) to anon, authenticated;
grant execute on function public.portal_approve_change_order(text, text, text) to anon, authenticated;
grant execute on function public.portal_sign_document(text, text, text, text, text) to anon, authenticated;
