import { readFileSync } from 'fs';
const pat = readFileSync('.env','utf8').match(/SUPABASE_PAT=([^\s]+)/)[1];
const q = async (sql) => {
  const r = await fetch('https://api.supabase.com/v1/projects/ofrvoxupatowfatpleji/database/query', {
    method:'POST', headers:{'Authorization':'Bearer '+pat,'Content-Type':'application/json'},
    body: JSON.stringify({query: sql})
  });
  return r.json();
};

console.log('=== Tabellen mit client/customer-Verbindung ===');
const cols = await q(`select table_name, column_name, data_type from information_schema.columns where table_schema='public' and column_name in ('client_id','customer_id','client') order by table_name`);
const by={};
for (const row of cols) (by[row.table_name]=by[row.table_name]||[]).push(`${row.column_name} (${row.data_type})`);
for (const t of Object.keys(by).sort()) console.log('  ' + t.padEnd(30) + by[t].join(', '));

console.log('\n=== Alle public Tabellen ===');
const all = await q(`select table_name from information_schema.tables where table_schema='public' order by table_name`);
for (const r of all) console.log('  ' + r.table_name);
