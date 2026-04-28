create table if not exists public.customers (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  name text,
  title text,
  status text,
  user_id uuid null,
  customer_id text null,
  estimate_id text null,
  estimate_item_id text null,
  job_id text null,
  task_id text null,
  worker_id text null,
  invoice_id text null,
  supplier_id text null,
  allowance_id text null,
  receipt_id text null,
  source_type text null,
  source_id text null,
  project_type text null,
  subtotal_cost numeric null,
  markup_amount numeric null,
  total_price numeric null,
  profit_amount numeric null,
  profit_margin numeric null,
  client_notes text null,
  internal_notes text null,
  converted_job_id text null,
  description text null,
  category text null,
  type text null,
  quantity numeric null,
  unit text null,
  unit_cost numeric null,
  unit_price numeric null,
  markup_percent numeric null,
  cost_total numeric null,
  price_total numeric null,
  client_visible boolean null,
  start_date date null,
  end_date date null,
  progress numeric null,
  estimated_total numeric null,
  actual_cost numeric null,
  estimated_cost numeric null,
  vendor text null,
  amount numeric null,
  date date null,
  due_date date null,
  payment_date date null,
  method text null,
  reimbursable boolean null,
  subtotal numeric null,
  tax numeric null,
  total numeric null,
  paid_amount numeric null,
  balance_due numeric null,
  invoice_number text null,
  worker_name text null,
  start_time text null,
  end_time text null,
  hours numeric null,
  overtime_hours numeric null,
  hourly_rate numeric null,
  overtime_rate numeric null,
  labor_cost numeric null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estimates (like public.customers including all);
create table if not exists public.estimate_items (like public.customers including all);
create table if not exists public.jobs (like public.customers including all);
create table if not exists public.job_items (like public.customers including all);
create table if not exists public.tasks (like public.customers including all);
create table if not exists public.expenses (like public.customers including all);
create table if not exists public.invoices (like public.customers including all);
create table if not exists public.invoice_items (like public.customers including all);
create table if not exists public.payments (like public.customers including all);
create table if not exists public.time_entries (like public.customers including all);
create table if not exists public.shopping_lists (like public.customers including all);
create table if not exists public.shopping_list_items (like public.customers including all);
create table if not exists public.material_orders (like public.customers including all);
create table if not exists public.material_order_items (like public.customers including all);
create table if not exists public.suppliers (like public.customers including all);
create table if not exists public.allowances (like public.customers including all);
create table if not exists public.allowance_selections (like public.customers including all);
create table if not exists public.workers (like public.customers including all);
create table if not exists public.receipts (like public.customers including all);
create table if not exists public.job_photos (like public.customers including all);
create table if not exists public.notes (like public.customers including all);
create table if not exists public.activity_log (like public.customers including all);

alter table public.customers add column if not exists title text;
alter table public.estimates add column if not exists title text;
alter table public.estimate_items add column if not exists title text;
alter table public.jobs add column if not exists title text;
alter table public.job_items add column if not exists title text;
alter table public.tasks add column if not exists title text;
alter table public.expenses add column if not exists title text;
alter table public.invoices add column if not exists title text;
alter table public.invoice_items add column if not exists title text;
alter table public.payments add column if not exists title text;
alter table public.time_entries add column if not exists title text;
alter table public.shopping_lists add column if not exists title text;
alter table public.shopping_list_items add column if not exists title text;
alter table public.material_orders add column if not exists title text;
alter table public.material_order_items add column if not exists title text;
alter table public.suppliers add column if not exists title text;
alter table public.allowances add column if not exists title text;
alter table public.allowance_selections add column if not exists title text;
alter table public.workers add column if not exists title text;
alter table public.receipts add column if not exists title text;
alter table public.job_photos add column if not exists title text;
alter table public.notes add column if not exists title text;
alter table public.activity_log add column if not exists title text;

alter table public.expenses add column if not exists vendor text;
alter table public.expenses add column if not exists amount numeric;
alter table public.expenses add column if not exists date date;
alter table public.expenses add column if not exists reimbursable boolean;
alter table public.expenses add column if not exists receipt_id text;

alter table public.time_entries add column if not exists worker_id text;
alter table public.time_entries add column if not exists worker_name text;
alter table public.time_entries add column if not exists date date;
alter table public.time_entries add column if not exists start_time text;
alter table public.time_entries add column if not exists end_time text;
alter table public.time_entries add column if not exists hours numeric;
alter table public.time_entries add column if not exists overtime_hours numeric;
alter table public.time_entries add column if not exists hourly_rate numeric;
alter table public.time_entries add column if not exists overtime_rate numeric;
alter table public.time_entries add column if not exists labor_cost numeric;

alter table public.invoices add column if not exists invoice_number text;
alter table public.invoices add column if not exists subtotal numeric;
alter table public.invoices add column if not exists tax numeric;
alter table public.invoices add column if not exists total numeric;
alter table public.invoices add column if not exists paid_amount numeric;
alter table public.invoices add column if not exists balance_due numeric;
alter table public.invoices add column if not exists amount numeric;
alter table public.invoices add column if not exists due_date date;

alter table public.invoice_items add column if not exists invoice_id text;
alter table public.invoice_items add column if not exists quantity numeric;
alter table public.invoice_items add column if not exists unit text;
alter table public.invoice_items add column if not exists unit_price numeric;
alter table public.invoice_items add column if not exists total numeric;
alter table public.invoice_items add column if not exists source_type text;
alter table public.invoice_items add column if not exists source_id text;

alter table public.payments add column if not exists invoice_id text;
alter table public.payments add column if not exists job_id text;
alter table public.payments add column if not exists customer_id text;
alter table public.payments add column if not exists amount numeric;
alter table public.payments add column if not exists payment_date date;
alter table public.payments add column if not exists method text;

create index if not exists customers_customer_id_idx on public.customers (customer_id);
create index if not exists estimates_customer_id_idx on public.estimates (customer_id);
create index if not exists estimate_items_estimate_id_idx on public.estimate_items (estimate_id);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_estimate_id_idx on public.jobs (estimate_id);
create index if not exists job_items_job_id_idx on public.job_items (job_id);
create index if not exists job_items_estimate_item_id_idx on public.job_items (estimate_item_id);
create index if not exists tasks_customer_id_idx on public.tasks (customer_id);
create index if not exists tasks_estimate_id_idx on public.tasks (estimate_id);
create index if not exists tasks_job_id_idx on public.tasks (job_id);
create index if not exists expenses_job_id_idx on public.expenses (job_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists time_entries_job_id_idx on public.time_entries (job_id);
create index if not exists shopping_lists_job_id_idx on public.shopping_lists (job_id);
create index if not exists shopping_list_items_job_id_idx on public.shopping_list_items (job_id);
create index if not exists material_orders_job_id_idx on public.material_orders (job_id);
create index if not exists material_orders_supplier_id_idx on public.material_orders (supplier_id);
create index if not exists material_order_items_supplier_id_idx on public.material_order_items (supplier_id);
create index if not exists allowances_job_id_idx on public.allowances (job_id);
create index if not exists allowance_selections_allowance_id_idx on public.allowance_selections (allowance_id);
create index if not exists receipts_job_id_idx on public.receipts (job_id);
create index if not exists job_photos_job_id_idx on public.job_photos (job_id);
create index if not exists notes_job_id_idx on public.notes (job_id);
create index if not exists activity_log_job_id_idx on public.activity_log (job_id);

alter table public.customers enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_items enable row level security;
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.time_entries enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.material_orders enable row level security;
alter table public.material_order_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.allowances enable row level security;
alter table public.allowance_selections enable row level security;
alter table public.workers enable row level security;
alter table public.receipts enable row level security;
alter table public.job_photos enable row level security;
alter table public.notes enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "Users manage own rows" on public.customers;
create policy "Users manage own rows" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.estimates;
create policy "Users manage own rows" on public.estimates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.estimate_items;
create policy "Users manage own rows" on public.estimate_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.jobs;
create policy "Users manage own rows" on public.jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.job_items;
create policy "Users manage own rows" on public.job_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.tasks;
create policy "Users manage own rows" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.expenses;
create policy "Users manage own rows" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.invoices;
create policy "Users manage own rows" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.invoice_items;
create policy "Users manage own rows" on public.invoice_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.payments;
create policy "Users manage own rows" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.time_entries;
create policy "Users manage own rows" on public.time_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.shopping_lists;
create policy "Users manage own rows" on public.shopping_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.shopping_list_items;
create policy "Users manage own rows" on public.shopping_list_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.material_orders;
create policy "Users manage own rows" on public.material_orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.material_order_items;
create policy "Users manage own rows" on public.material_order_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.suppliers;
create policy "Users manage own rows" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.allowances;
create policy "Users manage own rows" on public.allowances for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.allowance_selections;
create policy "Users manage own rows" on public.allowance_selections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.workers;
create policy "Users manage own rows" on public.workers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.receipts;
create policy "Users manage own rows" on public.receipts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.job_photos;
create policy "Users manage own rows" on public.job_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.notes;
create policy "Users manage own rows" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own rows" on public.activity_log;
create policy "Users manage own rows" on public.activity_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Supabase Storage buckets for receipts, job photos, documents, and logos are still deferred.
