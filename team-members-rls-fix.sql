-- ============================================
-- RLS-Fix für die neuen Tabellen
-- ============================================
-- Falls Login "Zugriff verweigert: ... ist nicht in team_members eingetragen"
-- zeigt obwohl die Zeile existiert, ist RLS auf den neuen Tabellen aktiv ohne
-- Policies. Diese SQL setzt die "Allow all" Policy passend zum Rest deiner
-- bestehenden Tabellen (siehe supabase-schema.sql Zeile 113ff).
-- ============================================

alter table team_members enable row level security;
alter table employee_todos enable row level security;

drop policy if exists "Allow all" on team_members;
drop policy if exists "Allow all" on employee_todos;

create policy "Allow all" on team_members for all using (true) with check (true);
create policy "Allow all" on employee_todos for all using (true) with check (true);
