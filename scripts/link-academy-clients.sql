-- Verknüpft academy_customers mit clients via client_id
-- + Auto-Link via Email-Match für existierende Daten

-- 1. Neue Spalte
alter table academy_customers
  add column if not exists client_id uuid references clients(id) on delete set null;

-- 2. Auto-Link: bestehende academy_customers mit clients matchen via Email (case-insensitive)
update academy_customers ac
set client_id = c.id
from clients c
where ac.client_id is null
  and lower(ac.email) = lower(c.email)
  and c.email is not null
  and c.email != '';

-- 3. Index
create index if not exists academy_customers_client_idx on academy_customers(client_id);

-- Verify
select
  (select count(*) from academy_customers) as total_academy_customers,
  (select count(*) from academy_customers where client_id is not null) as linked_to_clients;
