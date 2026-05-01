alter table academy_customers
  add column if not exists onboarding_completed boolean default false;

-- Existing customers (z.B. info@consulting-og.de) markieren wir als completed,
-- damit sie nicht erneut durch den Wizard gezwungen werden.
update academy_customers
set onboarding_completed = true
where created_at < now() - interval '1 day' and onboarding_completed is not true;

select email, onboarding_completed from academy_customers order by created_at desc;
