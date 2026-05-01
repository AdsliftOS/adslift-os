import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = 'ofrvoxupatowfatpleji';

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: 'Bearer ' + pat },
});
const keys = await keysRes.json();
const serviceRole = keys.find(k => k.name === 'service_role').api_key;

const sb = createClient(`https://${PROJECT_REF}.supabase.co`, serviceRole);

const file = readFileSync('/Users/alexandergoldmann/Desktop/_Sortiert/Sonstiges/Neuer Ordner/logo gradient.png');
const { error } = await sb.storage.from('email-assets').upload('adslift-icon.png', file, {
  contentType: 'image/png',
  upsert: true
});
if (error) { console.error('Error:', error.message); process.exit(1); }

const { data } = sb.storage.from('email-assets').getPublicUrl('adslift-icon.png');
console.log('PUBLIC URL:', data.publicUrl);
