import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://ofrvoxupatowfatpleji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U'
);
const token = 'demo' + Math.random().toString(36).slice(2, 14);
const { error } = await sb.from('onboarding_tokens').insert({ token, client_name: 'Demo Brudi', client_email: 'demo@adslift.de', variant: 'donewithyou' });
if (error) { console.error('FAIL:', error.message); process.exit(1); }
const { data: mods } = await sb.from('onboarding_modules').select('id, sort_order').order('sort_order');
const rows = mods.map((m, i) => ({ token, module_id: m.id, status: i === 0 ? 'active' : 'locked' }));
await sb.from('onboarding_progress').insert(rows);
console.log(`OK — Demo-Token erstellt:\nhttp://localhost:8080/onboarding-portal/${token}`);
