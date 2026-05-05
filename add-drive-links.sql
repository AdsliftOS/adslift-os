-- Mehrere benannte Drive-Links pro Pipeline-Projekt
-- Format: [{ "name": "Brand-Assets", "url": "https://drive.google.com/..." }, ...]

alter table pipeline_projects
  add column if not exists drive_links jsonb not null default '[]'::jsonb;

-- Bestehende Einzel-Links als ersten Eintrag in die neue Liste übernehmen.
update pipeline_projects
set drive_links = jsonb_build_array(
  jsonb_build_object('name', 'Drive', 'url', drive_link)
)
where drive_link is not null
  and drive_link <> ''
  and (drive_links is null or drive_links = '[]'::jsonb);
