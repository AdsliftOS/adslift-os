-- Lockert NOT-NULL-Constraints auf Text-Feldern der Legacy-projects-Tabelle.
-- Default '' bleibt — aber explizit übergebene NULL-Werte werfen keinen Fehler mehr.
-- Hintergrund: Briefings konnten nicht gespeichert werden weil ein leeres Feld als NULL ankam.

alter table projects alter column briefing drop not null;
alter table projects alter column meeting_notes drop not null;
alter table projects alter column target_audience drop not null;
alter table projects alter column offer drop not null;
alter table projects alter column product drop not null;
alter table projects alter column start_date drop not null;
