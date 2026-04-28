-- Customer-Portal v2: PIN-Schutz + Feedback-Channel

-- PIN pro Projekt (6-stellig, Plain — niedrige Sicherheit, aber besser als
-- offener Token-Link). Zusätzlich Customer-Name fürs Tracking.
alter table pipeline_projects
  add column if not exists portal_pin text,
  add column if not exists portal_customer_name text;

-- Feedback: Kunde kann pro Step oder Projekt ein Feedback hinterlassen.
-- Admin sieht's im Projekt-Detail mit Read-Marker.
create table if not exists pipeline_feedback (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references pipeline_projects(id) on delete cascade,
  step_id uuid references pipeline_steps(id) on delete set null,
  author_name text not null default '',
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists pipeline_feedback_project_idx on pipeline_feedback(project_id, read_at);

alter table pipeline_feedback enable row level security;
drop policy if exists "Allow all" on pipeline_feedback;
create policy "Allow all" on pipeline_feedback for all using (true) with check (true);
