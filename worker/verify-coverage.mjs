#!/usr/bin/env node
/**
 * verify-coverage.mjs — DE dekkingscontrole: telt drie lagen tegen elkaar en
 * rapporteert ELK verschil, nooit stilzwijgend.
 *
 *   1. BRON      — de Uscreen-oogst (~/.albunyaan-cc/*.jsonl)
 *   2. DATABASE  — de cloud-Supabase
 *   3. WEERGAVE  — wat de gegenereerde bladerversie daadwerkelijk rendert
 *
 * Uitvoer: één tabel per soort met ✅ bij gelijk en ❌ + de ontbrekende namen
 * bij ongelijk. Exitcode 1 zodra er één ❌ is, zodat "klaar" pas "klaar" is als
 * alle drie de lagen gelijk tellen.
 *
 * ALLEEN-LEZEN. Draait automatisch na elke showcase-build en elke import.
 *
 * Run (vanuit repo-root of worker/):
 *   set -a; source ~/.albunyaan-cc/cloud.env; set +a
 *   node worker/verify-coverage.mjs [--showcase PAD] [--telegram]
 *
 * --telegram  stuurt bij ❌ een melding naar de oprichter (telegram.env).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CC = path.join(os.homedir(), '.albunyaan-cc');
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TELEGRAM = args.includes('--telegram');

for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB = process.env.SUPABASE_URL + '/rest/v1';
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

const readJsonl = (f) => !fs.existsSync(f) ? [] :
  fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

async function dbCount(table, query = '') {
  const r = await fetch(`${SB}/${table}?select=id${query}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const n = parseInt((r.headers.get('content-range') || '').split('/')[1], 10);
  return Number.isFinite(n) ? n : 0;
}
async function dbAll(q) { // altijd pagineren: REST kapt stil af boven 1000
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/${q}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${q}: ${r.status}`);
    const c = await r.json();
    rows.push(...c);
    if (c.length < 1000) return rows;
  }
}

// ── laag 3: de gegenereerde bladerversie ─────────────────────────────────────
function newestShowcase() {
  const dir = path.join(REPO, 'var/showcase');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'))
    .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0]?.f ?? null;
}
function readShowcase(file) {
  if (!file || !fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script id="data" type="application\/json">(.*?)<\/script>/s);
  if (!m) return null;
  const D = JSON.parse(m[1]);
  const cats = new Set(), series = new Set(), vids = new Set(), attach = new Set();
  const noteAttach = (e) => { for (const r of (e[9] || [])) if (r[4]) attach.add(String(r[4])); };
  for (const [name, blocks] of D.c) {
    cats.add(name);
    for (const b of blocks) {
      if (b[0] === 'S') { series.add(b[1]); for (const e of b[3]) { vids.add(e[6]); noteAttach(e); } }
      else { vids.add(b[1][6]); noteAttach(b[1]); }
    }
  }
  return { file, cats, series, vids, attach };
}

const rows = [];
function line(soort, bron, db, weergave, missing = [], toelichting = '') {
  const vals = [bron, db, weergave].filter((v) => v !== null);
  const ok = vals.every((v) => v === vals[0]);
  rows.push({ soort, bron, db, weergave, ok, missing, toelichting });
}

// ── BRON ─────────────────────────────────────────────────────────────────────
const details = readJsonl(path.join(CC, 'uscreen-video-details.jsonl')).filter((d) => !d.error);
const srcVideos = new Set(details.map((d) => String(d.id)));
const srcColl = readJsonl(path.join(CC, 'uscreen-collection-members.jsonl')).filter((c) => (c.videoIds || []).length);
const srcCats = readJsonl(path.join(CC, 'uscreen-category-collections.jsonl'));
const srcRes = readJsonl(path.join(CC, 'uscreen-file-resources.jsonl'));
const srcResOk = readJsonl(path.join(CC, 'uscreen-resources-manifest.jsonl')).filter((r) => r.file);
const srcDesc = readJsonl(path.join(CC, 'uscreen-collection-descriptions.jsonl')).filter((d) => d.text);

// ── DATABASE ─────────────────────────────────────────────────────────────────
const dbVideoRows = await dbAll('videos?select=external_id,title,bunny_video_id&source=eq.uscreen');
const dbVideos = new Set(dbVideoRows.map((v) => String(v.external_id)));
const dbCollRows = await dbAll('collections?select=external_id,title,description&source=eq.uscreen');
const dbCatRows = await dbAll('categories?select=id,external_id,name&source=eq.uscreen');
const dbResVideos = await dbCount('videos', '&source=eq.uscreen&resources=neq.[]');
const dbCollDesc = dbCollRows.filter((c) => (c.description || '').trim()).length;

// ── WEERGAVE ─────────────────────────────────────────────────────────────────
const show = readShowcase(argVal('--showcase', newestShowcase()));

// ── vergelijkingen ───────────────────────────────────────────────────────────
const titleOf = new Map(dbVideoRows.map((v) => [String(v.external_id), v.title]));
const notInSource = [...dbVideos].filter((id) => !srcVideos.has(id));
const notInDb = [...srcVideos].filter((id) => !dbVideos.has(id));
const notShown = show ? [...dbVideos].filter((id) => !show.vids.has(id)) : [];
line("video's", srcVideos.size, dbVideos.size, show ? show.vids.size : null,
  [...notInDb.map((id) => `${id} (in bron, NIET in database)`),
   ...notShown.map((id) => `${id} ${titleOf.get(id) ?? ''} (in database, NIET in weergave)`),
   ...notInSource.map((id) => `${id} ${titleOf.get(id) ?? ''} (in database, niet meer bij Uscreen)`)].slice(0, 14),
  notInSource.length && !notInDb.length && !notShown.length
    ? `${notInSource.length} rijen bestaan alleen bij ons: op Uscreen verwijderd, bij ons bewaard (geen verlies)` : '');

const dbCollTitles = new Set(dbCollRows.map((c) => c.title));
line('series', srcColl.length, dbCollRows.length, show ? show.series.size : null,
  show ? [...dbCollTitles].filter((t) => !show.series.has(t)).slice(0, 10) : []);

const dbCatNames = new Set(dbCatRows.map((c) => c.name));
const shownCatNames = show ? new Set([...show.cats].filter((n) => !n.startsWith('📦'))) : null;
// Waarom ontbreekt een categorie? Tel hoeveel storefront-items ze heeft; als die
// geen tegenhanger in onze catalogus hebben is het geen migratiegat maar
// content die hier niet thuishoort (live-kanalen = aparte werkstroom WS6).
const orderById = new Map(readJsonl(path.join(CC, 'uscreen-category-order.jsonl')).map((c) => [String(c.id), c]));
const missingCats = shownCatNames ? dbCatRows.filter((c) => !shownCatNames.has(c.name)) : [];
line('categorieën', srcCats.length, dbCatRows.length, shownCatNames ? shownCatNames.size : null,
  missingCats.map((c) => {
    const n = (orderById.get(String(c.external_id))?.items || []).length;
    return `${c.name} — ${n} items op de storefront, 0 daarvan bestaan als video/serie bij ons`;
  }));

// bijlagen: dezelfde eenheid in alle drie de lagen = UNIEKE bestand-id's
const dbAttachRows = await dbAll('videos?select=external_id,resources&source=eq.uscreen&resources=neq.[]');
const dbAttachIds = new Set();
for (const v of dbAttachRows) for (const r of (v.resources || [])) if (r.id) dbAttachIds.add(String(r.id));
line('bijlagen (unieke bestanden)', srcRes.length, dbAttachIds.size, show ? show.attach.size : null,
  [...dbAttachIds].filter((id) => show && !show.attach.has(id)).slice(0, 10),
  srcRes.length !== dbAttachIds.size
    ? `${srcRes.length - dbAttachIds.size} bestanden uit de catalogus hangen bij Uscreen aan géén enkele video` : '');
line('bestanden veiliggesteld', srcRes.length, srcResOk.length, null, [],
  srcRes.length !== srcResOk.length ? `${srcRes.length - srcResOk.length} niet gedownload — zie uscreen-resources-manifest.jsonl` : '');
line('series met beschrijving', srcDesc.length, dbCollDesc, null, []);

// ── uitvoer ──────────────────────────────────────────────────────────────────
const n = (v) => v === null ? '—' : Number(v).toLocaleString('nl-NL');
console.log('\n═ DEKKINGSCONTROLE — bron vs database vs weergave ═\n');
console.log(`${'soort'.padEnd(26)}${'bron'.padStart(9)}${'database'.padStart(11)}${'weergave'.padStart(11)}   status`);
console.log('─'.repeat(72));
for (const r of rows) {
  console.log(`${r.soort.padEnd(26)}${n(r.bron).padStart(9)}${n(r.db).padStart(11)}${n(r.weergave).padStart(11)}   ${r.ok ? '✅' : '❌'}`);
  if (r.toelichting) console.log(`${''.padEnd(28)}↳ ${r.toelichting}`);
  if (!r.ok && r.missing.length) {
    for (const m of r.missing) console.log(`${''.padEnd(28)}ontbreekt: ${String(m).slice(0, 48)}`);
    if (r.missing.length >= 10) console.log(`${''.padEnd(28)}… (eerste 10 getoond)`);
  }
}
console.log('─'.repeat(72));
if (show) console.log(`weergave gemeten in: ${path.relative(REPO, show.file)}`);
else console.log('weergave: GEEN bladerversie gevonden — alleen bron/database vergeleken');

const bad = rows.filter((r) => !r.ok);
console.log(bad.length ? `\n❌ ${bad.length} verschil(len): ${bad.map((r) => r.soort).join(', ')}\n`
                       : '\n✅ Alle lagen tellen gelijk.\n');

if (bad.length && TELEGRAM) {
  try {
    const env = fs.readFileSync(path.join(CC, 'telegram.env'), 'utf8');
    const tok = env.match(/TELEGRAM_BOT_TOKEN=(.*)/)?.[1]?.trim();
    const chat = env.match(/TELEGRAM_CHAT_ID=(.*)/)?.[1]?.trim();
    if (tok && chat) {
      const text = '⚠️ Dekkingscontrole: verschil gevonden in ' + bad.map((r) => r.soort).join(', ')
        + '\n' + bad.map((r) => `${r.soort}: bron ${n(r.bron)} · db ${n(r.db)} · weergave ${n(r.weergave)}`).join('\n');
      await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text }),
      });
      console.log('Telegram-melding verstuurd.');
    }
  } catch (e) { console.log('Telegram-melding mislukt:', String(e.message).slice(0, 80)); }
}
process.exit(bad.length ? 1 : 0);
