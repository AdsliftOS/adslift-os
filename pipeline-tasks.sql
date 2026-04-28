-- Sub-Tasks pro Step — gespeichert auf pipeline_steps.data.tasks (jsonb)
-- Templates bekommen default_tasks die beim Hinzufügen kopiert werden.

alter table pipeline_step_templates
  add column if not exists default_tasks jsonb not null default '[]';

-- Sinnvolle Default-Tasks für die 6 System-Templates
update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"ICP klar definieren (Branche · Größe · Region)","done":false},
  {"id":"t2","title":"Pains & Desires sammeln","done":false},
  {"id":"t3","title":"Wettbewerber-Recherche","done":false},
  {"id":"t4","title":"Persona-Doku erstellen","done":false}
]'::jsonb where name = 'Zielgruppen-Analyse' and is_default = true;

update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"Value Stack zusammenstellen","done":false},
  {"id":"t2","title":"Pricing finalisieren","done":false},
  {"id":"t3","title":"Garantie definieren","done":false},
  {"id":"t4","title":"Bonus-Stack bauen","done":false},
  {"id":"t5","title":"Offer-One-Pager finalisieren","done":false}
]'::jsonb where name = 'Offer bauen' and is_default = true;

update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"Business Manager Zugang vom Kunden","done":false},
  {"id":"t2","title":"Pixel installieren","done":false},
  {"id":"t3","title":"Conversion-API (CAPI) einrichten","done":false},
  {"id":"t4","title":"Standard-Events definieren (Lead, Purchase)","done":false},
  {"id":"t5","title":"Domain verifizieren","done":false},
  {"id":"t6","title":"Conversion-API testen","done":false}
]'::jsonb where name = 'Meta-Setup' and is_default = true;

update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"Hooks & Angles brainstormen","done":false},
  {"id":"t2","title":"Creatives produzieren (3+ Varianten)","done":false},
  {"id":"t3","title":"Adcopies schreiben","done":false},
  {"id":"t4","title":"Audiences definieren","done":false},
  {"id":"t5","title":"Kampagne aufsetzen","done":false},
  {"id":"t6","title":"Live-Schaltung","done":false},
  {"id":"t7","title":"Optimierung & Skalierung","done":false}
]'::jsonb where name = 'Meta Ads' and is_default = true;

update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"Lead-Liste in Prospereye importieren","done":false},
  {"id":"t2","title":"1st Message Template festlegen","done":false},
  {"id":"t3","title":"Claude-Bot an Inbox connecten","done":false},
  {"id":"t4","title":"Reply-Logik kalibrieren","done":false},
  {"id":"t5","title":"Outreach starten","done":false},
  {"id":"t6","title":"Wöchentliche KPI-Review","done":false}
]'::jsonb where name = 'LinkedIn Outreach' and is_default = true;

update pipeline_step_templates set default_tasks = '[
  {"id":"t1","title":"Daily Performance-Check","done":false},
  {"id":"t2","title":"Lead-Quality-Audit","done":false},
  {"id":"t3","title":"Alerts konfigurieren","done":false},
  {"id":"t4","title":"Wochen-Report an Kunde","done":false},
  {"id":"t5","title":"Optimierungsplan dokumentieren","done":false}
]'::jsonb where name = 'Monitoring' and is_default = true;
