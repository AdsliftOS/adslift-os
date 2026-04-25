-- ============================================
-- Team-Mitglieder + Sales-Attribution
-- ============================================

-- Team Members: Mapping zwischen Supabase-User (email) und Close-User
create table if not exists team_members (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  name text not null,
  role text not null default 'Setter', -- Setter | Closer | Admin | Geschäftsführer | Partner
  close_user_id text,
  commission_rate numeric not null default 10, -- Prozent vom Deal-Volumen
  status text not null default 'active', -- active | inactive
  created_at timestamptz default now()
);

-- Sales weeks: closer_email referenziert team_members.email (kein FK, lockere Kopplung)
alter table sales_weeks add column if not exists closer_email text;

-- Personal todos für Mitarbeiter (Anrufe, Follow-Ups, Zahlungserinnerung)
create table if not exists employee_todos (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  title text not null,
  description text not null default '',
  type text not null default 'call', -- call | followup | payment_reminder | other
  due_date date,
  due_time text, -- HH:MM optional
  lead_name text,
  lead_close_id text,
  phone text,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists employee_todos_user_idx on employee_todos(user_email, done, due_date);

-- Seed: bereits existierende User
insert into team_members (email, name, role, commission_rate)
values
  ('info@consulting-og.de', 'Alex', 'Geschäftsführer', 0),
  ('office@consulting-og.de', 'Daniel', 'Partner', 0)
on conflict (email) do nothing;
