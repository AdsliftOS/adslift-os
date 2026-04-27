-- ============================================
-- Pipeline (neue Projekte v2) — Sandbox-Schema
-- Komplett isoliert vom bestehenden `projects` table.
-- Sobald die neue Pipeline produktionsreif ist, wird /projects durch
-- /pipeline ersetzt. Bis dahin parallel.
-- ============================================

-- Step-Templates (Baukasten-Bausteine)
-- Default-Templates werden geseedet (Zielgruppe, Offer, Meta-Setup, Meta Ads,
-- LinkedIn, Monitoring). User können eigene Templates anlegen.
create table if not exists pipeline_step_templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text not null default 'box',
  description text not null default '',
  default_fields jsonb not null default '[]',  -- [{key, label, type}]
  color text not null default '#1c7ed6',
  is_default boolean not null default false,   -- system-default vs user-created
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Projekte (v2)
create table if not exists pipeline_projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client_id uuid,                              -- references existing clients table
  client_email text,                           -- auto-filled from client on create
  ad_account_id text,                          -- Meta Ad-Account, z.B. act_123
  status text not null default 'draft',        -- draft | active | paused | done
  start_date date,
  customer_portal_token text,                  -- random token for customer login URL
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Steps in einem Projekt (instanziiert aus Templates oder custom)
create table if not exists pipeline_steps (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references pipeline_projects(id) on delete cascade,
  template_id uuid,                            -- nullable for custom steps
  name text not null,
  icon text not null default 'box',
  description text not null default '',
  position int not null default 0,             -- sortable
  status text not null default 'todo',         -- todo | active | done | skipped
  data jsonb not null default '{}',            -- step-specific data
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists pipeline_steps_project_idx on pipeline_steps(project_id, position);

-- Datei-Anhänge pro Step (HTML-Upload für Creatives, Adcopies, Briefings)
create table if not exists pipeline_step_files (
  id uuid default gen_random_uuid() primary key,
  step_id uuid not null references pipeline_steps(id) on delete cascade,
  filename text not null,
  type text not null default 'html',           -- html | image | pdf | other
  content text,                                -- raw HTML inline (small)
  url text,                                    -- supabase storage URL (large files)
  uploaded_by_email text,
  created_at timestamptz default now()
);

create index if not exists pipeline_step_files_step_idx on pipeline_step_files(step_id);

-- RLS: matche bestehende "Allow all" Pattern aus supabase-schema.sql
alter table pipeline_step_templates enable row level security;
alter table pipeline_projects enable row level security;
alter table pipeline_steps enable row level security;
alter table pipeline_step_files enable row level security;

drop policy if exists "Allow all" on pipeline_step_templates;
drop policy if exists "Allow all" on pipeline_projects;
drop policy if exists "Allow all" on pipeline_steps;
drop policy if exists "Allow all" on pipeline_step_files;

create policy "Allow all" on pipeline_step_templates for all using (true) with check (true);
create policy "Allow all" on pipeline_projects for all using (true) with check (true);
create policy "Allow all" on pipeline_steps for all using (true) with check (true);
create policy "Allow all" on pipeline_step_files for all using (true) with check (true);

-- Default Step-Templates (das was im Excalidraw-Board steht)
insert into pipeline_step_templates (name, icon, description, color, is_default, sort_order)
values
  ('Zielgruppen-Analyse', 'users', 'ICP definieren, Pains identifizieren, Recherche', '#7c3aed', true, 10),
  ('Offer bauen', 'gift', 'Value Stack, Pricing, Garantie, Hormozi-Style', '#e8590c', true, 20),
  ('Meta-Setup', 'settings', 'Pixel · CAPI · Events · Business Manager · Conversion-API', '#1c7ed6', true, 30),
  ('Meta Ads', 'megaphone', 'Creatives · Launch · Optimize · Skalieren · Reporting', '#1864ab', true, 40),
  ('LinkedIn Outreach', 'linkedin', 'Prospereye 1st Message + Claude Bot Reply', '#0d72ff', true, 50),
  ('Monitoring', 'activity', 'Daily Performance · Lead-Quality · Alerts · Wochen-Reports', '#2f9e44', true, 60)
on conflict do nothing;
