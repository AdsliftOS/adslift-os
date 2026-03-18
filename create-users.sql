-- Run this in Supabase SQL Editor to create the two user accounts
-- Password for both: Adslift2026!

-- Alex
SELECT supabase_auth_admin.create_user(
  '{"email": "info@consulting-og.de", "password": "Adslift2026!", "email_confirmed": true}'::jsonb
);

-- Daniel
SELECT supabase_auth_admin.create_user(
  '{"email": "office@consulting-og.de", "password": "Adslift2026!", "email_confirmed": true}'::jsonb
);
