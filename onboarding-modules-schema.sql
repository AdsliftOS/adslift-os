-- ============================================
-- Adslift Onboarding-Module (Phase 2: Setup)
-- ============================================
-- Modulares Onboarding-System mit Loom + Doc + Workbook + Feedback-Loop.
-- Sequential Unlock: nächstes Modul wird erst nach Approval freigeschaltet.

-- 1. Module-Master (gleich für alle Kunden)
create table if not exists onboarding_modules (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title text not null,
  description text not null default '',
  loom_url text,                          -- Loom share URL (wird embedded)
  doc_url text,                           -- Notion / Google Doc Link
  workbook_schema jsonb not null default '[]',  -- [{key, label, type, placeholder, required, options?}]
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists onboarding_modules_sort_idx on onboarding_modules(sort_order);

-- 2. Tokens (Magic-Link pro Kunde — gibt Zugang zum Portal)
create table if not exists onboarding_tokens (
  token text primary key,
  client_id uuid,                         -- references clients(id), nullable bis Kunde existiert
  client_name text not null,
  client_email text not null,
  variant text not null default 'donewithyou',  -- 'done4you' | 'donewithyou'
  created_at timestamptz default now()
);

create index if not exists onboarding_tokens_email_idx on onboarding_tokens(client_email);

-- 3. Progress pro Kunde + Modul
create table if not exists onboarding_progress (
  id uuid default gen_random_uuid() primary key,
  token text not null references onboarding_tokens(token) on delete cascade,
  module_id uuid not null references onboarding_modules(id) on delete cascade,
  status text not null default 'locked',  -- locked | active | submitted | feedback_given | approved
  submission jsonb not null default '{}',
  feedback_loom_url text,
  feedback_text text,
  submitted_at timestamptz,
  feedback_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz default now(),
  unique(token, module_id)
);

create index if not exists onboarding_progress_token_idx on onboarding_progress(token);
create index if not exists onboarding_progress_status_idx on onboarding_progress(status);

-- ============================================
-- RLS: alles offen für anon (Portal ist public via token)
-- ============================================
alter table onboarding_modules enable row level security;
alter table onboarding_tokens enable row level security;
alter table onboarding_progress enable row level security;

drop policy if exists "anon_read_modules" on onboarding_modules;
create policy "anon_read_modules" on onboarding_modules for select to anon using (true);
drop policy if exists "anon_all_modules" on onboarding_modules;
create policy "anon_all_modules" on onboarding_modules for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tokens" on onboarding_tokens;
create policy "anon_read_tokens" on onboarding_tokens for select to anon using (true);
drop policy if exists "anon_all_tokens" on onboarding_tokens;
create policy "anon_all_tokens" on onboarding_tokens for all to authenticated using (true) with check (true);

drop policy if exists "anon_all_progress" on onboarding_progress;
create policy "anon_all_progress" on onboarding_progress for all to anon using (true) with check (true);
drop policy if exists "auth_all_progress" on onboarding_progress;
create policy "auth_all_progress" on onboarding_progress for all to authenticated using (true) with check (true);

-- ============================================
-- Seed: 4 Module
-- ============================================
insert into onboarding_modules (slug, title, description, sort_order, workbook_schema) values
(
  'zielgruppe',
  'Zielgruppe finden',
  'Definiere deine ideale Zielgruppe — wer sie ist, was sie sich wünscht, und welche Probleme sie hat.',
  1,
  '[
    {"key":"ideal_client","label":"Beschreibe deinen idealen Kunden in 3-4 Sätzen","type":"textarea","placeholder":"z.B. Handwerker mit 5-20 Mitarbeitern, die seit 10+ Jahren am Markt sind und keinen klaren Online-Auftritt haben...","required":true},
    {"key":"demographics","label":"Demografie (Alter, Region, Einkommen, Berufsstand)","type":"textarea","placeholder":"Alter: 35-55. Region: DACH. Umsatz: 500k-3M €/Jahr...","required":true},
    {"key":"problems","label":"Die 3 größten Probleme deiner Zielgruppe","type":"textarea","placeholder":"1. Zu wenig qualifizierte Anfragen\n2. Falsche Kunden mit zu kleinem Budget\n3. ...","required":true},
    {"key":"desires","label":"Was wünscht sich deine Zielgruppe wirklich?","type":"textarea","placeholder":"Volle Auftragsbücher mit Wunschkunden, planbarer Umsatz, weniger Akquise-Stress...","required":true}
  ]'::jsonb
),
(
  'offer',
  'Offer bauen',
  'Baue ein unwiderstehliches Angebot mit Hormozi''s Value-Equation.',
  2,
  '[
    {"key":"main_offer","label":"Dein Hauptangebot in einem Satz","type":"textarea","placeholder":"Wir liefern Webdesignern 10-15 qualifizierte Wunschkunden pro Monat in 90 Tagen — oder du zahlst nichts.","required":true},
    {"key":"dream_outcome","label":"Welches Traum-Ergebnis bekommt der Kunde?","type":"textarea","placeholder":"Was ist die ultimative Transformation? (Volle Pipeline, planbarer Umsatz, eigene Brand, ...)","required":true},
    {"key":"perceived_likelihood","label":"Wie machst du Erfolg wahrscheinlich? (Beweise, Garantien, Track-Record)","type":"textarea","placeholder":"Case Studies, Testimonials, Daten, eigene Erfolge, Garantien...","required":true},
    {"key":"time_delay","label":"Wie schnell sieht der Kunde Ergebnisse?","type":"textarea","placeholder":"Erste Anfragen in 7-14 Tagen, signifikanter Pipeline-Aufbau in 60 Tagen...","required":true},
    {"key":"effort_sacrifice","label":"Wie reduzierst du Aufwand für den Kunden?","type":"textarea","placeholder":"Wir machen 95%, du gibst nur Input. Keine Tech-Sorgen, keine Strategie-Last...","required":true},
    {"key":"bonuses","label":"Bonus-Leistungen (mind. 3)","type":"textarea","placeholder":"1. Kostenloser Zielgruppen-Workshop (Wert 1.500 €)\n2. Conversion-Audit (Wert 800 €)\n3. ...","required":true},
    {"key":"guarantee","label":"Welche Garantie gibst du?","type":"textarea","placeholder":"Geld-zurück nach 90 Tagen wenn keine 10 qualifizierten Anfragen, oder ...","required":true},
    {"key":"price","label":"Preis","type":"input","placeholder":"z.B. 4.997 € einmalig + 1.500 €/Monat","required":true}
  ]'::jsonb
),
(
  'positionierung',
  'Positionierung',
  'Differenziere dich vom Markt und werde unverwechselbar.',
  3,
  '[
    {"key":"usp","label":"Was ist dein USP (Unique Selling Proposition)?","type":"textarea","placeholder":"Was kannst nur du, was niemand sonst auf dem Markt kann?","required":true},
    {"key":"differentiation","label":"Wie unterscheidest du dich von 3 direkten Mitbewerbern?","type":"textarea","placeholder":"Mitbewerber A macht X, ich mache Y weil...\nMitbewerber B...\n","required":true},
    {"key":"brand_story","label":"Deine Brand-Story (5-7 Sätze)","type":"textarea","placeholder":"Warum machst du das? Was ist die Vision? Welcher Wendepunkt hat dich hierhin gebracht?","required":true},
    {"key":"positioning_statement","label":"Positionierungs-Statement","type":"textarea","placeholder":"Für [Zielgruppe], die [Problem], biete ich [Lösung], weil [Differenzierung].","required":true}
  ]'::jsonb
),
(
  'mbm',
  'Meta Business Manager Setup',
  'Setze deinen Meta Business Manager komplett auf — Werbekonto, Pixel, CAPI, Domain-Verify.',
  4,
  '[
    {"key":"mbm_id","label":"Meta Business Manager ID","type":"input","placeholder":"z.B. 123456789012345","required":true},
    {"key":"ad_account_id","label":"Werbekonto ID","type":"input","placeholder":"act_123456789","required":true},
    {"key":"pixel_id","label":"Pixel ID","type":"input","placeholder":"123456789012345","required":true},
    {"key":"domain","label":"Verifizierte Domain","type":"input","placeholder":"deineagentur.de","required":true},
    {"key":"pixel_test","label":"Pixel-Test bestanden?","type":"select","options":["Ja","Nein","Brauche Hilfe"],"required":true},
    {"key":"capi_active","label":"Conversions API aktiv?","type":"select","options":["Ja","Nein","Brauche Hilfe"],"required":true},
    {"key":"domain_verified","label":"Domain verifiziert?","type":"select","options":["Ja","Nein","Brauche Hilfe"],"required":true},
    {"key":"notes","label":"Probleme oder Fragen?","type":"textarea","placeholder":"Wenn etwas nicht klappt, schreib es hier rein — ich helfe dir.","required":false}
  ]'::jsonb
)
on conflict (slug) do nothing;
