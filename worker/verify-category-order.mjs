/**
 * verify-category-order.mjs — READ-ONLY check that category ordering on the
 * new platform matches Uscreen exactly.
 *
 * Compares, for every category:
 *   scraped truth (uscreen-category-collections.jsonl collectionIds sequence)
 *   vs DB (categories.raw->collections sequence used by the data layer).
 * Then, for a spot-check category (default: 156459 "Tatbieqaat Himaayah /
 * Protect Your Child"), prints the exact flattened video order the category
 * page now serves — (collection order, episode position) — for eyeball
 * comparison against the live Uscreen page.
 *
 * Run:  set -a; source ~/.albunyaan-cc/cloud.env; set +a
 *       node worker/verify-category-order.mjs [categoryExternalId]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = process.env.SUPABASE_URL + '/rest/v1/';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const SPOT = process.argv[2] || '156459';

async function fetchAll(pathAndQuery) {
  // Supabase REST clamps top-level pages to 1000 rows SILENTLY — paginate.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(BASE + pathAndQuery, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${r.status} ${pathAndQuery}`);
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < 1000) return rows;
  }
}

const scrape = new Map();
for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/uscreen-category-collections.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const d = JSON.parse(line);
  scrape.set(String(d.id), { title: d.title, collectionIds: (d.collectionIds || []).map(String) });
}

const cats = await fetchAll('categories?select=external_id,name,raw&source=eq.uscreen');
let ok = 0, mismatch = 0, missing = 0;
for (const c of cats) {
  const s = scrape.get(String(c.external_id));
  if (!s) { missing++; console.log(`  NOT IN SCRAPE: ${c.external_id} ${c.name}`); continue; }
  const db = (c.raw?.collections || []).map(String);
  if (JSON.stringify(db) === JSON.stringify(s.collectionIds)) ok++;
  else { mismatch++; console.log(`  ORDER MISMATCH ${c.external_id} ${c.name}\n    scrape: ${s.collectionIds}\n    db:     ${db}`); }
}
console.log(`\ncategories checked: ${cats.length} — order OK: ${ok}, mismatch: ${mismatch}, not in scrape: ${missing}`);

// Spot-check: the exact page order for one category.
const spotCat = cats.find((c) => String(c.external_id) === SPOT);
if (!spotCat) { console.log(`spot-check category ${SPOT} not found`); process.exit(mismatch ? 1 : 0); }
console.log(`\n=== page order spot-check: ${spotCat.name} (${SPOT}) ===`);
const collExt = (spotCat.raw?.collections || []).map(String);
const colls = await fetchAll(`collections?select=id,external_id,title&source=eq.uscreen&external_id=in.(${collExt.join(',')})`);
const byExt = new Map(colls.map((c) => [c.external_id, c]));
let pos = 0;
for (const ext of collExt) {
  const coll = byExt.get(ext);
  if (!coll) { console.log(`  [collection ${ext} MISSING FROM DB]`); continue; }
  const items = await fetchAll(`collection_items?select=position,videos(title,status)&collection_id=eq.${coll.id}&order=position.asc`);
  console.log(`  ── ${coll.title} (${items.length} items)`);
  for (const it of items) {
    const v = it.videos;
    const vis = v && ['published', 'live'].includes(v.status) ? ' ' : '✗hidden';
    console.log(`  ${String(++pos).padStart(3)}. [p${it.position}]${vis} ${v?.title ?? '(missing video row)'}`);
  }
}
process.exit(mismatch ? 1 : 0);
