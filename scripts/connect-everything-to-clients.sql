-- ============================================
-- Alle Tabellen mit clients verknüpfen
-- ============================================
-- Kunde = Master-Entität. Jede relevante Tabelle bekommt client_id (uuid FK).
-- Bestehende Text-Felder ('client') bleiben erstmal als Fallback erhalten.

-- 1. projects: client (text) → client_id (uuid)
alter table projects add column if not exists client_id uuid references clients(id) on delete set null;
update projects p set client_id = c.id
from clients c
where p.client_id is null and lower(p.client) = lower(c.name);
create index if not exists projects_client_idx on projects(client_id);

-- 2. deals: client (text) → client_id (uuid)
alter table deals add column if not exists client_id uuid references clients(id) on delete set null;
update deals d set client_id = c.id
from clients c
where d.client_id is null and lower(d.client) = lower(c.name);
create index if not exists deals_client_idx on deals(client_id);

-- 3. calendar_events: client (text) → client_id (uuid)
alter table calendar_events add column if not exists client_id uuid references clients(id) on delete set null;
update calendar_events e set client_id = c.id
from clients c
where e.client_id is null and lower(e.client) = lower(c.name);
create index if not exists calendar_events_client_idx on calendar_events(client_id);

-- 4. tasks: NEU client_id
alter table tasks add column if not exists client_id uuid references clients(id) on delete set null;
create index if not exists tasks_client_idx on tasks(client_id);

-- 5. expenses: NEU client_id
alter table expenses add column if not exists client_id uuid references clients(id) on delete set null;
create index if not exists expenses_client_idx on expenses(client_id);

-- 6. time_entries: NEU client_id
alter table time_entries add column if not exists client_id uuid references clients(id) on delete set null;
create index if not exists time_entries_client_idx on time_entries(client_id);

-- Verify Auto-Link Erfolg
select
  'projects' as table_name,
  (select count(*) from projects) as total,
  (select count(*) from projects where client_id is not null) as linked
union all
select 'deals', (select count(*) from deals), (select count(*) from deals where client_id is not null)
union all
select 'calendar_events', (select count(*) from calendar_events), (select count(*) from calendar_events where client_id is not null)
union all
select 'tasks', (select count(*) from tasks), (select count(*) from tasks where client_id is not null)
union all
select 'expenses', (select count(*) from expenses), (select count(*) from expenses where client_id is not null)
union all
select 'time_entries', (select count(*) from time_entries), (select count(*) from time_entries where client_id is not null);
