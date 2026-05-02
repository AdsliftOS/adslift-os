-- Revolut Business integration: OAuth connection + cached outgoing transactions

create table if not exists public.revolut_connection (
  id text primary key default 'default',
  client_id text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  oldest_synced_at timestamptz,
  constraint revolut_connection_singleton check (id = 'default')
);

alter table public.revolut_connection enable row level security;

drop policy if exists "revolut_connection_all" on public.revolut_connection;
create policy "revolut_connection_all" on public.revolut_connection
  for all using (true) with check (true);

create table if not exists public.revolut_transactions (
  id text primary key,
  type text,
  state text,
  tx_created_at timestamptz,
  tx_completed_at timestamptz,
  amount numeric not null,
  currency text not null,
  amount_eur numeric,
  description text,
  merchant_name text,
  merchant_category text,
  counterparty_name text,
  reference text,
  category text,
  expense_id uuid references public.expenses(id) on delete set null,
  ignored boolean not null default false,
  raw jsonb,
  imported_at timestamptz not null default now()
);

create index if not exists revolut_transactions_tx_created_idx
  on public.revolut_transactions (tx_created_at desc);

create index if not exists revolut_transactions_ignored_idx
  on public.revolut_transactions (ignored);

alter table public.revolut_transactions enable row level security;

drop policy if exists "revolut_transactions_all" on public.revolut_transactions;
create policy "revolut_transactions_all" on public.revolut_transactions
  for all using (true) with check (true);
