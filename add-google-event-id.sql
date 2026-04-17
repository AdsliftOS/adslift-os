-- Run this in Supabase SQL Editor
alter table calendar_events add column if not exists google_event_id text;
alter table calendar_events add column if not exists google_account_email text;
