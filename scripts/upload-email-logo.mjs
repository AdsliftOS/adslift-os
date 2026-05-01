import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const pat = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = 'ofrvoxupatowfatpleji';

// Get service role key from Management API
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { 'Authorization': 'Bearer ' + pat }
});
const keys = await keysRes.json();
const serviceRole = keys.find(k => k.name === 'service_role').api_key;

const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const sb = createClient(SUPABASE_URL, serviceRole);

// 1. Create bucket via Storage API
const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + serviceRole, 'apikey': serviceRole, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'email-assets', name: 'email-assets', public: true })
});
const bucketText = await bucketRes.text();
if (bucketRes.ok) console.log('Bucket created:', bucketText);
else console.log('Bucket maybe existed:', bucketRes.status, bucketText);

// 2. Upload
const file = readFileSync('/Users/alexandergoldmann/Desktop/adslift-skills/adslift-logo.png');
const { error } = await sb.storage.from('email-assets').upload('adslift-logo.png', file, {
  contentType: 'image/png',
  upsert: true
});
if (error) { console.error('Upload error:', error.message); process.exit(1); }

const { data } = sb.storage.from('email-assets').getPublicUrl('adslift-logo.png');
console.log('PUBLIC URL:', data.publicUrl);
