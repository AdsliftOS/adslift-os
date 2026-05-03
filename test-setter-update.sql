-- Test-Setter E-Mail anpassen — Supabase mag nur gängige TLDs.
-- Nutze diese E-Mail für den Auth-User im Dashboard.

update team_members
   set email = 'timtester@gmail.com'
 where email = 'setter-test@adslift.dev';

update employee_todos
   set user_email = 'timtester@gmail.com'
 where user_email = 'setter-test@adslift.dev';
