-- ============================================
-- adslift OS — Supabase Schema
-- Führe dieses SQL im Supabase SQL Editor aus
-- ============================================

-- Clients
create table if not exists clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  projects int not null default 0,
  revenue numeric not null default 0,
  status text not null default 'Active',
  created_at timestamptz default now()
);

-- Projects
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  client text not null,
  name text not null,
  product text not null default '',
  type text not null default 'neukunde',
  creative_format text not null default 'beides',
  start_date text not null default '',
  assignees jsonb not null default '[]',
  phases jsonb not null default '[]',
  briefing text not null default '',
  meeting_notes text not null default '',
  target_audience text not null default '',
  offer text not null default '',
  comments jsonb not null default '[]',
  onboarding jsonb,
  deadline text,
  created_at timestamptz default now()
);

-- Calendar Events
create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date text not null,
  start_time text not null,
  end_time text not null,
  type text not null default 'other',
  client text,
  description text,
  meeting_link text,
  project_id text,
  created_at timestamptz default now()
);

-- Tasks
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null default 'admin',
  priority text not null default 'medium',
  due_date text,
  col text not null default 'todo',
  recurrence text not null default 'none',
  created_at timestamptz default now()
);

-- Sales Weeks
create table if not exists sales_weeks (
  id uuid default gen_random_uuid() primary key,
  week_start text not null,
  kw int not null,
  year int not null,
  new_leads int not null default 0,
  reached int not null default 0,
  scheduled int not null default 0,
  showed int not null default 0,
  closed int not null default 0,
  deal_volume numeric not null default 0,
  created_at timestamptz default now()
);

-- Finance Deals
create table if not exists deals (
  id uuid default gen_random_uuid() primary key,
  start_date text not null,
  client text not null,
  service_type text not null default 'done4you',
  net_amount numeric not null default 0,
  tax_rate numeric not null default 19,
  payment_method text not null default 'Überweisung',
  monthly_payments jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Finance Expenses
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  description text not null default '',
  monthly_expenses jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Settings
create table if not exists app_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb not null
);

-- Enable RLS (Row Level Security) but allow all for now
-- Later we add proper auth policies
alter table clients enable row level security;
alter table projects enable row level security;
alter table calendar_events enable row level security;
alter table tasks enable row level security;
alter table sales_weeks enable row level security;
alter table deals enable row level security;
alter table expenses enable row level security;
alter table app_settings enable row level security;

-- Temporary: allow all access (we'll add auth later)
create policy "Allow all" on clients for all using (true) with check (true);
create policy "Allow all" on projects for all using (true) with check (true);
create policy "Allow all" on calendar_events for all using (true) with check (true);
create policy "Allow all" on tasks for all using (true) with check (true);
create policy "Allow all" on sales_weeks for all using (true) with check (true);
create policy "Allow all" on deals for all using (true) with check (true);
create policy "Allow all" on expenses for all using (true) with check (true);
create policy "Allow all" on app_settings for all using (true) with check (true);
