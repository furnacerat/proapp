create table if not exists public.customers (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  name text,
  status text,
  customer_id text,
  estimate_id text,
  job_id text,
  task_id text,
  order_id text,
  shopping_list_id text,
  invoice_id text,
  expense_id text,
  allowance_id text,
  worker_id text,
  supplier_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (like public.customers including all);
create table if not exists public.jobs (like public.customers including all);
create table if not exists public.tasks (like public.customers including all);
create table if not exists public.expenses (like public.customers including all);
create table if not exists public.invoices (like public.customers including all);
create table if not exists public.payments (like public.customers including all);
create table if not exists public.time_entries (like public.customers including all);
create table if not exists public.shopping_lists (like public.customers including all);
create table if not exists public.shopping_list_items (like public.customers including all);
create table if not exists public.orders (like public.customers including all);
create table if not exists public.suppliers (like public.customers including all);
create table if not exists public.allowances (like public.customers including all);
create table if not exists public.receipts (like public.customers including all);

create index if not exists customers_customer_id_idx on public.customers (customer_id);
create index if not exists estimates_customer_id_idx on public.estimates (customer_id);
create index if not exists estimates_job_id_idx on public.estimates (job_id);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_estimate_id_idx on public.jobs (estimate_id);
create index if not exists tasks_job_id_idx on public.tasks (job_id);
create index if not exists tasks_customer_id_idx on public.tasks (customer_id);
create index if not exists tasks_worker_id_idx on public.tasks (worker_id);
create index if not exists expenses_job_id_idx on public.expenses (job_id);
create index if not exists expenses_customer_id_idx on public.expenses (customer_id);
create index if not exists expenses_allowance_id_idx on public.expenses (allowance_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_job_id_idx on public.payments (job_id);
create index if not exists time_entries_job_id_idx on public.time_entries (job_id);
create index if not exists time_entries_worker_id_idx on public.time_entries (worker_id);
create index if not exists shopping_lists_job_id_idx on public.shopping_lists (job_id);
create index if not exists shopping_list_items_shopping_list_id_idx on public.shopping_list_items (shopping_list_id);
create index if not exists orders_job_id_idx on public.orders (job_id);
create index if not exists orders_supplier_id_idx on public.orders (supplier_id);
create index if not exists allowances_job_id_idx on public.allowances (job_id);
create index if not exists receipts_job_id_idx on public.receipts (job_id);
create index if not exists receipts_shopping_list_id_idx on public.receipts (shopping_list_id);

-- Auth, row-level security policies, and Supabase Storage buckets are intentionally deferred.
-- This first schema keeps the current local-storage record shape in payload while exposing
-- relationship IDs for synced queries and future normalized migrations.
