-- Setzt den Pipeline-Projektnamen auf den Namen des verknüpften Kunden.
-- Wirkt nur auf Projekte mit client_id; alle anderen bleiben unverändert.
-- Idempotent: läuft beliebig oft, ändert nur was abweicht.

-- Vorschau: was würde geändert?
select
  pp.id,
  pp.name as alt_name,
  c.name as neuer_name
from pipeline_projects pp
join clients c on c.id = pp.client_id
where pp.client_id is not null
  and pp.name is distinct from c.name;

-- Wenn die Liste oben passt: dieses Update ausführen.
update pipeline_projects pp
set name = c.name,
    updated_at = now()
from clients c
where pp.client_id = c.id
  and pp.client_id is not null
  and pp.name is distinct from c.name;
