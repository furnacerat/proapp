do $$
declare
  table_name text;
  table_names text[] := array[
    'customers',
    'estimates',
    'estimate_items',
    'jobs',
    'tasks',
    'expenses',
    'invoices',
    'payments',
    'time_entries',
    'shopping_lists',
    'shopping_list_items',
    'material_orders',
    'material_order_items',
    'suppliers',
    'allowances',
    'allowance_selections',
    'workers',
    'receipts',
    'job_photos',
    'notes',
    'activity_log'
  ];
begin
  foreach table_name in array table_names loop
    execute format(
      'create table if not exists public.%I (
        id text primary key,
        payload jsonb not null default ''{}''::jsonb,
        name text,
        status text,
        user_id uuid null,
        customer_id text null,
        estimate_id text null,
        job_id text null,
        task_id text null,
        invoice_id text null,
        supplier_id text null,
        allowance_id text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )',
      table_name
    );
  end loop;
end $$;

create index if not exists customers_customer_id_idx on public.customers (customer_id);
create index if not exists estimates_customer_id_idx on public.estimates (customer_id);
create index if not exists estimate_items_estimate_id_idx on public.estimate_items (estimate_id);
create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_estimate_id_idx on public.jobs (estimate_id);
create index if not exists tasks_customer_id_idx on public.tasks (customer_id);
create index if not exists tasks_estimate_id_idx on public.tasks (estimate_id);
create index if not exists tasks_job_id_idx on public.tasks (job_id);
create index if not exists expenses_job_id_idx on public.expenses (job_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
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

-- Auth, row-level security policies, and Supabase Storage buckets are intentionally deferred.
-- This first phase keeps local storage intact and stores the current record shape in payload.
