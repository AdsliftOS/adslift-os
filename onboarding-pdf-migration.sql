-- ============================================
-- Onboarding-Module — Migration zu PDF-Workflow
-- Statt JSON-Workbook in der App: PDF download + upload
-- ============================================

-- 1. Module-Master: workbook_pdf_url (Download-PDF) + sample_pdf_url
alter table onboarding_modules
  add column if not exists workbook_pdf_url text,
  add column if not exists workbook_pdf_filename text;

-- 2. Progress: submission_file_url (hochgeladene ausgefüllte PDF)
alter table onboarding_progress
  add column if not exists submission_file_url text,
  add column if not exists submission_file_name text;

-- 3. Storage-Bucket für Onboarding-Submissions (idempotent)
insert into storage.buckets (id, name, public)
values ('onboarding-submissions', 'onboarding-submissions', true)
on conflict (id) do update set public = true;

-- 4. Storage-Policies: anon kann hochladen (per Token in path) + lesen
drop policy if exists "anon_upload_onboarding" on storage.objects;
create policy "anon_upload_onboarding" on storage.objects
  for insert to anon with check (bucket_id = 'onboarding-submissions');

drop policy if exists "anon_read_onboarding" on storage.objects;
create policy "anon_read_onboarding" on storage.objects
  for select to anon using (bucket_id = 'onboarding-submissions');

drop policy if exists "auth_all_onboarding_storage" on storage.objects;
create policy "auth_all_onboarding_storage" on storage.objects
  for all to authenticated using (bucket_id = 'onboarding-submissions') with check (bucket_id = 'onboarding-submissions');

-- 5. Token-Insert auch für anon (vorerst, für interne Tests / Zapier-Webhook später wieder strenger)
drop policy if exists "anon_insert_tokens" on onboarding_tokens;
create policy "anon_insert_tokens" on onboarding_tokens
  for insert to anon with check (true);
