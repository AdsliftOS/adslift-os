-- Backfill: Maps existing projects.onboarding-Daten zu clients via Email + Name
-- Sodass der Onboarding-Tab im Kunden-Detail die Daten zeigt.

-- 1. Match by Email aus onboarding-JSON (most reliable)
update projects p
set client_id = c.id
from clients c
where p.client_id is null
  and lower(p.onboarding->>'contactEmail') = lower(c.email)
  and c.email is not null and c.email != '';

-- 2. Match by Company-Name (companyName aus onboarding)
update projects p
set client_id = c.id
from clients c
where p.client_id is null
  and lower(p.onboarding->>'companyName') = lower(c.name)
  and (p.onboarding->>'companyName') is not null;

-- 3. Match by client text-field (legacy)
update projects p
set client_id = c.id
from clients c
where p.client_id is null
  and lower(p.client) = lower(c.name)
  and p.client is not null;

-- 4. Match by client text-field to company
update projects p
set client_id = c.id
from clients c
where p.client_id is null
  and lower(p.client) = lower(c.company)
  and p.client is not null;

-- Result
select
  count(*) filter (where client_id is not null) as linked,
  count(*) filter (where client_id is null) as unlinked,
  count(*) filter (where client_id is null and onboarding is not null and onboarding != '{}'::jsonb) as unlinked_with_onboarding
from projects;
