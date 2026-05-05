-- Manuelle Onboarding-Bestätigung am Pipeline-Projekt.
-- Fall: Kunde hat das Onboarding extern erledigt → kein Wizard-Data,
-- aber Onboarding ist trotzdem "fertig". Toggle in der UI setzt das Flag.

alter table pipeline_projects
  add column if not exists onboarding_confirmed boolean not null default false;
