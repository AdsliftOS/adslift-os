import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://ofrvoxupatowfatpleji.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mcnZveHVwYXRvd2ZhdHBsZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjk0NTQsImV4cCI6MjA4OTQwNTQ1NH0.AIqVTa0JK_srhTaD-a6CH9Ik94FATjhX8P-ilToCO0U'
);

// Try to insert a test token (should fail with anon, succeed with auth)
const token = 'demo-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const { error: tokErr } = await sb.from('onboarding_tokens').insert({
  token,
  client_name: 'Demo Kunde',
  client_email: 'demo@test.de',
  variant: 'donewithyou',
});
if (tokErr) { console.error('Token-Insert FAIL (anon RLS):', tokErr.message); }
else { console.log('Token-Insert OK:', token); }

// Cleanup
await sb.from('onboarding_tokens').delete().eq('token', token);
