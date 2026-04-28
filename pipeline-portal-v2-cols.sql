alter table pipeline_projects
  add column if not exists portal_pin text;

alter table pipeline_projects
  add column if not exists portal_customer_name text;
