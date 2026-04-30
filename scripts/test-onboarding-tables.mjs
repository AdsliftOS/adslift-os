import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://ofrvoxupatowfatpleji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U'
);
const { data, error } = await sb.from('onboarding_modules').select('slug, title, sort_order').order('sort_order');
if (error) { console.error('FAIL', error.message); process.exit(1); }
console.log('OK — Module gefunden:');
data.forEach(m => console.log(`  ${m.sort_order}. ${m.slug} — ${m.title}`));
