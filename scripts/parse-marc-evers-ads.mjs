import fs from 'fs';
import path from 'path';

const text = fs.readFileSync('./marc-evers-analysis/page-text.txt', 'utf-8');

// Split into ad blocks by "Bibliotheks-ID:" markers
const blocks = text.split(/(?=Bibliotheks-ID:)/g);
console.log('total blocks:', blocks.length);

const marcAds = [];
for (const b of blocks) {
  if (/Marc Evers Marketing/i.test(b)) {
    // Extract metadata
    const idMatch = b.match(/Bibliotheks-ID:\s*(\d+)/);
    const dateMatch = b.match(/(\d{2}\.\d{2}\.\d{4}(?:\s*bis\s*\d{2}\.\d{2}\.\d{4})?)/);
    const statusMatch = b.match(/^[\s\S]{0,80}?(Aktiv|Inaktiv)/m);
    const variantsMatch = b.match(/(\d+)\s*Werbeanzeigen?\s*verwenden/i);
    // The body usually starts after "Anzeige\n"
    const bodyStart = b.indexOf('Anzeige\n');
    const body = bodyStart >= 0 ? b.slice(bodyStart + 8) : b;
    // Cut at next ad or at "Aktiv"/"Inaktiv" boundary further down
    const cutMarkers = ['\nInaktiv\n', '\nAktiv\n', '\nDetails ansehen\n'];
    let bodyClean = body;
    for (const m of cutMarkers) {
      const idx = bodyClean.lastIndexOf(m);
      // skip
    }

    marcAds.push({
      libraryId: idMatch ? idMatch[1] : null,
      runDates: dateMatch ? dateMatch[1] : null,
      variants: variantsMatch ? parseInt(variantsMatch[1]) : 1,
      rawLength: b.length,
      body: body.slice(0, 4000).trim(),
    });
  }
}

console.log('Marc Evers ads found:', marcAds.length);
console.log('total variants:', marcAds.reduce((s, a) => s + (a.variants || 1), 0));

fs.writeFileSync('./marc-evers-analysis/marc-evers-ads-parsed.json', JSON.stringify(marcAds, null, 2));

// Build a markdown report
let md = `# Marc Evers Marketing & Consulting — Ad Library Analyse\n\n`;
md += `**Quelle:** Meta Ad Library (DE), abgerufen ${new Date().toISOString().slice(0,10)}\n`;
md += `**Anzeigen-Gruppen gefunden:** ${marcAds.length}\n`;
md += `**Anzeigen-Varianten gesamt:** ${marcAds.reduce((s, a) => s + (a.variants || 1), 0)}\n\n`;
md += `---\n\n`;

marcAds.forEach((ad, i) => {
  md += `## Ad #${i+1} — Library ID ${ad.libraryId}\n`;
  md += `- **Laufzeit:** ${ad.runDates}\n`;
  md += `- **Varianten:** ${ad.variants}\n\n`;
  md += '```\n' + ad.body + '\n```\n\n---\n\n';
});

fs.writeFileSync('./marc-evers-analysis/REPORT.md', md);
console.log('report saved');
