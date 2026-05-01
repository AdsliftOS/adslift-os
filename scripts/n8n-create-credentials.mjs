import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const N8N_KEY = env.match(/N8N_API_KEY=([^\s]+)/)[1];
const PAT = env.match(/SUPABASE_PAT=([^\s]+)/)[1];
const PROJECT_REF = 'ofrvoxupatowfatpleji';
const N8N_URL = 'https://adsliftauto.app.n8n.cloud';

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
  headers: { Authorization: 'Bearer ' + PAT },
});
const supabaseKeys = await keysRes.json();
const serviceRole = supabaseKeys.find((k) => k.name === 'service_role').api_key;

console.log('Creating Supabase credential ...');
const res = await fetch(`${N8N_URL}/api/v1/credentials`, {
  method: 'POST',
  headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Supabase Adslift',
    type: 'supabaseApi',
    data: { host: `https://${PROJECT_REF}.supabase.co`, serviceRole },
  }),
});
const text = await res.text();
console.log(res.status, text);

if (res.ok) {
  const data = JSON.parse(text);
  console.log('Credential ID:', data.id);
}
