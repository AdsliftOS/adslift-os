-- Step-Template Kategorien:
--  setup     → Neues Projekt aufsetzen (Zielgruppe, Offer, Meta-Setup ...)
--  campaign  → Neue Kampagne ergänzen (zu laufendem Projekt: neue
--              Zielgruppe, neue Creatives, Audiences, Launch, Optimize ...)
--  other     → freie Bausteine

alter table pipeline_step_templates
  add column if not exists category text not null default 'setup';

-- Bestehende 6 Default-Templates auf "setup" markieren
update pipeline_step_templates set category = 'setup'
 where is_default = true;

-- Kampagnen-spezifische Templates (für neue Kampagne in laufendem Projekt)
insert into pipeline_step_templates (name, icon, description, default_tasks, color, is_default, category, sort_order)
values
  ('Neue Zielgruppe', 'users',
   'Audience für die neue Kampagne festlegen',
   '[
     {"id":"t1","title":"Audience-Brief vom Kunden einholen","done":false},
     {"id":"t2","title":"ICP für neue Kampagne präzisieren","done":false},
     {"id":"t3","title":"Custom Audience erstellen","done":false},
     {"id":"t4","title":"Lookalike Audience anlegen","done":false}
   ]'::jsonb,
   '#7c3aed', true, 'campaign', 110),

  ('Neue Creatives', 'megaphone',
   'Neue Hooks, Visuals & Videos für die Kampagne',
   '[
     {"id":"t1","title":"Hooks & Angles brainstormen","done":false},
     {"id":"t2","title":"Storyboard / Skript schreiben","done":false},
     {"id":"t3","title":"Creator / UGC briefen","done":false},
     {"id":"t4","title":"Creatives produzieren","done":false},
     {"id":"t5","title":"Interne Review","done":false},
     {"id":"t6","title":"Kunden-Freigabe einholen","done":false}
   ]'::jsonb,
   '#e8590c', true, 'campaign', 120),

  ('Neue Adcopies', 'gift',
   'Texte für Primary, Headlines, Descriptions',
   '[
     {"id":"t1","title":"Primary Text (3+ Varianten)","done":false},
     {"id":"t2","title":"Headlines (3+ Varianten)","done":false},
     {"id":"t3","title":"Descriptions","done":false},
     {"id":"t4","title":"CTA festlegen","done":false},
     {"id":"t5","title":"Review & Freigabe","done":false}
   ]'::jsonb,
   '#1c7ed6', true, 'campaign', 130),

  ('Kampagnen-Setup', 'settings',
   'Aufbau der neuen Kampagne in Meta Ads Manager',
   '[
     {"id":"t1","title":"Kampagnen-Ziel definieren","done":false},
     {"id":"t2","title":"Budget & Laufzeit planen","done":false},
     {"id":"t3","title":"Anzeigengruppen aufsetzen","done":false},
     {"id":"t4","title":"Audiences zuweisen","done":false},
     {"id":"t5","title":"Anzeigen einpflegen","done":false},
     {"id":"t6","title":"Tracking-Check (Pixel/CAPI)","done":false}
   ]'::jsonb,
   '#1864ab', true, 'campaign', 140),

  ('Launch & Initial-Check', 'megaphone',
   'Live-Schaltung der neuen Kampagne',
   '[
     {"id":"t1","title":"Kampagne live schalten","done":false},
     {"id":"t2","title":"24h-Monitoring","done":false},
     {"id":"t3","title":"48h Budget-Check","done":false},
     {"id":"t4","title":"Erste Anpassungen","done":false}
   ]'::jsonb,
   '#0d72ff', true, 'campaign', 150),

  ('Optimierung & Skalieren', 'activity',
   'Laufende Optimierung der Kampagne',
   '[
     {"id":"t1","title":"Daily Performance-Check","done":false},
     {"id":"t2","title":"Schwache Anzeigen pausieren","done":false},
     {"id":"t3","title":"Top-Performer skalieren","done":false},
     {"id":"t4","title":"Audience-Tests starten","done":false},
     {"id":"t5","title":"Wöchentlicher Review","done":false}
   ]'::jsonb,
   '#2f9e44', true, 'campaign', 160),

  ('Reporting', 'activity',
   'Reporting + Kunden-Update für die Kampagne',
   '[
     {"id":"t1","title":"Wochen-Report erstellen","done":false},
     {"id":"t2","title":"Kunden-Call vorbereiten","done":false},
     {"id":"t3","title":"Optimierungsvorschläge dokumentieren","done":false},
     {"id":"t4","title":"Report an Kunde versenden","done":false}
   ]'::jsonb,
   '#7c3aed', true, 'campaign', 170)
on conflict do nothing;

-- Allgemeine Bausteine (weder Setup noch Campaign-spezifisch)
insert into pipeline_step_templates (name, icon, description, default_tasks, color, is_default, category, sort_order)
values
  ('Webseite live', 'sparkles',
   'Landingpage / Funnel-Seite live schalten',
   '[
     {"id":"t1","title":"Domain konfigurieren","done":false},
     {"id":"t2","title":"SSL-Zertifikat","done":false},
     {"id":"t3","title":"Tracking integrieren","done":false},
     {"id":"t4","title":"Final-Check + Live","done":false}
   ]'::jsonb,
   '#1c7ed6', true, 'other', 200),

  ('Email-Sequenz', 'gift',
   'Lead-Nurturing Email-Funnel aufsetzen',
   '[
     {"id":"t1","title":"Sequenz konzipieren","done":false},
     {"id":"t2","title":"Mails schreiben","done":false},
     {"id":"t3","title":"Im Tool aufsetzen","done":false},
     {"id":"t4","title":"Test versenden","done":false}
   ]'::jsonb,
   '#e8590c', true, 'other', 210),

  ('Kunden-Call', 'users',
   'Strategie- oder Update-Call mit Kunde',
   '[
     {"id":"t1","title":"Agenda vorbereiten","done":false},
     {"id":"t2","title":"Slides / Daten zusammenstellen","done":false},
     {"id":"t3","title":"Call durchführen","done":false},
     {"id":"t4","title":"Follow-Up Notes versenden","done":false}
   ]'::jsonb,
   '#7c3aed', true, 'other', 220)
on conflict do nothing;
