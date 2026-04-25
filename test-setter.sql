-- ============================================
-- Test-Setter für Mitarbeiter-Bereich Entwicklung
-- ============================================
-- Erfundene Testdaten — kein echter Mensch.
--
-- Damit dieser Account sich auch wirklich einloggen kann:
--  1. Dieses SQL ausführen (legt team_members Eintrag an)
--  2. Im Supabase Dashboard → Authentication → Users → "Add user"
--     - Email:    setter-test@adslift.dev
--     - Password: SetterTest2026!
--     - Auto-confirm user: ✓
--  3. Mit der gleichen E-Mail in der App einloggen — fertig.
--
-- Wenn du den Test-Account später nicht mehr brauchst:
--  delete from team_members where email = 'setter-test@adslift.dev';
--  + im Supabase Dashboard den Auth-User löschen.
-- ============================================

insert into team_members (email, name, role, close_user_id, commission_rate, status)
values (
  'setter-test@adslift.dev',
  'Tim Tester',
  'Setter',
  null,           -- später in Settings → Team mit Close-User verknüpfen
  8,              -- 8% Provision (Beispiel-Setter-Satz)
  'active'
)
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  commission_rate = excluded.commission_rate,
  status = excluded.status;

-- Beispiel-ToDos damit der Bereich nicht leer aussieht beim Testen
insert into employee_todos (user_email, title, description, type, due_date, due_time, lead_name, phone)
values
  ('setter-test@adslift.dev', 'Max Müller anrufen', 'Erstkontakt — kalt aus Webseiten-Form', 'call', current_date, '10:00', 'Max Müller', '+49 170 1234567'),
  ('setter-test@adslift.dev', 'Sarah Schmidt nachfassen', 'Hat letzte Woche Termin verschoben — neuen Termin vereinbaren', 'followup', current_date, '14:30', 'Sarah Schmidt', '+49 170 9876543'),
  ('setter-test@adslift.dev', 'Müller GmbH Zahlung erinnern', 'Rechnung 1042 ist 5 Tage überfällig', 'payment_reminder', current_date + interval '1 day', null, 'Müller GmbH', '+49 30 555 1234'),
  ('setter-test@adslift.dev', 'Lars Wagner — Demo zeigen', 'Will sich angeblich Demo anschauen, Slot anbieten', 'call', current_date + interval '2 days', '11:15', 'Lars Wagner', '+49 171 4567890'),
  ('setter-test@adslift.dev', 'Anna Becker — Vertrag besprechen', 'Hat Fragen zum Bezahlsplan', 'followup', current_date - interval '1 day', '16:00', 'Anna Becker', '+49 172 2345678');
