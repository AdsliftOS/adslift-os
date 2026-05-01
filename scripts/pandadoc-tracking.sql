-- Tracking-Tabelle für PandaDoc-Polling
-- Markiert welche Dokumente schon verarbeitet wurden, damit das Polling-Workflow
-- sie nicht doppelt processed.

create table if not exists pandadoc_processed (
  document_id text primary key,
  client_email text,
  processed_at timestamptz default now()
);

create index if not exists pandadoc_processed_at_idx on pandadoc_processed(processed_at desc);

alter table pandadoc_processed enable row level security;

drop policy if exists "auth_all_pandadoc" on pandadoc_processed;
create policy "auth_all_pandadoc" on pandadoc_processed
  for all to authenticated using (true) with check (true);

drop policy if exists "anon_all_pandadoc" on pandadoc_processed;
create policy "anon_all_pandadoc" on pandadoc_processed
  for all to anon using (true) with check (true);

select count(*) as existing_rows from pandadoc_processed;
