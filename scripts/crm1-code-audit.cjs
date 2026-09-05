const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CRM1 = path.join(ROOT, 'crm1');
const BOOT = path.join(CRM1, 'advanced-business-layer.js');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const jsFiles = walk(CRM1).filter(p => p.endsWith('.js'));
const texts = new Map(jsFiles.map(p => [p, fs.readFileSync(p, 'utf8')]));
const bootText = texts.get(BOOT) || '';
const active = new Set();
const re = /(?:['"`])\.\/(crm1-[^'"`?]+\.js|advanced-business-layer\.core\.js)(?:\?[^'"` ]*)?(?:['"`])/g;
for (const m of bootText.matchAll(re)) active.add(m[1]);
active.add('advanced-business-layer.js');

const references = new Map();
for (const [file, text] of texts) {
  for (const candidate of jsFiles) {
    const rel = path.relative(CRM1, candidate).replaceAll('\\', '/');
    const base = path.basename(candidate);
    if (file === candidate) continue;
    if (text.includes(`./${base}`) || text.includes(`/${base}`) || text.includes(`'${base}'`) || text.includes(`"${base}"`)) {
      if (!references.has(rel)) references.set(rel, []);
      references.get(rel).push(path.relative(CRM1, file).replaceAll('\\', '/'));
    }
  }
}

const crm1Js = jsFiles
  .map(p => path.relative(CRM1, p).replaceAll('\\', '/'))
  .sort();
const activeList = [...active].sort();
const likelyOrphans = crm1Js.filter(rel => rel !== 'advanced-business-layer.js' && !active.has(rel) && !references.has(rel));

console.log(`CRM1 JS files: ${crm1Js.length}`);
console.log(`Bootstrap-listed modules: ${activeList.length}`);
console.log('\nBootstrap modules not found as files:');
for (const rel of activeList.filter(rel => !crm1Js.includes(rel))) console.log(`- ${rel}`);
console.log('\nFiles referenced by another CRM1 JS file but not bootstrap-listed:');
for (const rel of [...references.keys()].filter(rel => !active.has(rel)).sort()) console.log(`- ${rel} <- ${references.get(rel).join(', ')}`);
console.log('\nLikely unreferenced/orphan JS (candidate for cleanup review):');
for (const rel of likelyOrphans) console.log(`- ${rel}`);

if (process.env.CRM1_AUDIT_STRICT === '1' && likelyOrphans.length) {
  console.error(`\nStrict orphan audit failed: ${likelyOrphans.length} unreferenced JS files found.`);
  process.exit(2);
}
