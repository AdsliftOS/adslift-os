-- ============================================
-- Academy: Submission-Upload + Coach-Review
-- ============================================
-- Erweitert Academy um:
--   1. Lesson-Flag `requires_submission` — wenn true, muss Kunde nach Anschauen Workbook hochladen
--   2. Tabelle `lesson_submissions` — hochgeladene PDF + Coach-Feedback (Loom + Text) + Approve
--   3. Storage-Bucket `lesson-submissions` — public, anon kann hochladen + lesen

-- 1. Lesson-Flag
alter table lessons add column if not exists requires_submission boolean not null default false;

-- 2. Submissions-Table
create table if not exists lesson_submissions (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid not null references lessons(id) on delete cascade,
  customer_id uuid not null,
  file_url text not null,
  file_name text not null,
  status text not null default 'submitted',  -- submitted | feedback_given | approved
  feedback_loom_url text,
  feedback_text text,
  submitted_at timestamptz default now(),
  feedback_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz default now()
);

create index if not exists lesson_submissions_lesson_idx on lesson_submissions(lesson_id);
create index if not exists lesson_submissions_customer_idx on lesson_submissions(customer_id);
create index if not exists lesson_submissions_status_idx on lesson_submissions(status);
create index if not exists lesson_submissions_lesson_customer_idx on lesson_submissions(lesson_id, customer_id);

-- 3. Storage-Bucket
insert into storage.buckets (id, name, public)
values ('lesson-submissions', 'lesson-submissions', true)
on conflict (id) do update set public = true;

-- 4. RLS
alter table lesson_submissions enable row level security;

drop policy if exists "anon_all_lesson_submissions" on lesson_submissions;
create policy "anon_all_lesson_submissions" on lesson_submissions
  for all to anon using (true) with check (true);

drop policy if exists "auth_all_lesson_submissions" on lesson_submissions;
create policy "auth_all_lesson_submissions" on lesson_submissions
  for all to authenticated using (true) with check (true);

drop policy if exists "anon_upload_lesson_submissions" on storage.objects;
create policy "anon_upload_lesson_submissions" on storage.objects
  for insert to anon with check (bucket_id = 'lesson-submissions');

drop policy if exists "anon_read_lesson_submissions" on storage.objects;
create policy "anon_read_lesson_submissions" on storage.objects
  for select to anon using (bucket_id = 'lesson-submissions');

drop policy if exists "auth_all_lesson_submissions_storage" on storage.objects;
create policy "auth_all_lesson_submissions_storage" on storage.objects
  for all to authenticated using (bucket_id = 'lesson-submissions') with check (bucket_id = 'lesson-submissions');
