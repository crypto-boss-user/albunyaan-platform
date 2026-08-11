/**
 * archive-structure.mjs — mappenstructuur van het NAS-originelenarchief
 * (teambesluit 2026-08-11: het archief moet menselijk doorbladerbaar zijn,
 * exact zoals het platform eruitziet).
 *
 * Berekent voor ELKE video (bron-universum = uscreen-video-details.jsonl ∪
 * uscreen-video-ids.jsonl, zelfde als archive-request-links.mjs) het
 * archiefpad:
 *
 *   <nn> - <categorienaam>/                 nn = platform-volgorde (categories.position)
 *     <nn> - <serienaam>/                   nn = plek in category_items-volgorde
 *       <nn> - <afleveringstitel>           nn = plek in collection_items-volgorde
 *     <nn> - <losse videotitel>             losse video direct in de categoriemap
 *   99 - Buiten categorieën/                alles wat nergens in hangt
 *     <serienaam>/<nn> - <titel>            series zonder categorie (alfabetisch)
 *     <titel> (<id>)                        losse video's, id erbij tegen naamboksing
 *
 * Volgorde-bron is IDENTIEK aan de bladerversie (build-library-showcase.mjs):
 * categories.position → category_items.position → collection_items.position,
 * inclusief het vangnet voor categorieën zonder vastgestelde volgorde (series
 * alfabetisch, dan losse video's — zelfde als wat de bladerversie toont).
 *
 * Dedup-besluit (teambesluit punt 2): een video die op het platform in
 * meerdere categorieën/series voorkomt krijgt zijn EERSTE plek (laagste
 * categorie-positie) als vaste plek en wordt maar één keer opgeslagen; elke
 * andere plek waar hij óók hoort komt in `ook_in`, zodat niets informatie
 * verliest. Nummering blijft de platform-nummering — een plek die elders is
 * ondergebracht laat dus een "gat" in de nummering achter (zichtbaar in de
 * proefweergave; bewust, zodat nummers 1-op-1 met het platform overeenkomen).
 *
 * Paden zijn ZONDER extensie: de echte extensie is pas bekend als Uscreen de
 * originele bestandsnaam prijsgeeft (Content-Disposition bij de wachtrij-HEAD);
 * archive-request-links.mjs plakt hem erachter.
 *
 * Bestandsnaam-hygiëne: verboden tekens (\ / : * ? " < > | en stuurtekens)
 * worden _ ; componenten gemaximeerd op 150 bytes (Synology/SMB-limiet 255,
 * ruime marge); ELKE aangepaste naam wordt gelogd (teambesluit punt 1) in
 * ~/.albunyaan-cc/archief/structuur-hernoemd.log.
 *
 * Uitvoer:
 *   ~/.albunyaan-cc/archief/structuur.jsonl       — per video: id, dest, ook_in
 *   ~/.albunyaan-cc/archief/structuur-series.jsonl — per serie: collection
 *     (uscreen-id), dirs[] (eerste = primaire map, rest = hardlink-mappen) en
 *     eps [{id, bestand}] — de bron voor archive-extras.mjs en archive-links.mjs
 *   ~/.albunyaan-cc/archief/structuur-hernoemd.log — alle naam-aanpassingen
 *   ~/.albunyaan-cc/archief/structuur-voorbeeld.txt — proefweergave (2 categorieën)
 *
 * structuur.jsonl is de BEVROREN toewijzing: archive-request-links.mjs leest
 * hem bij elke run. Alleen opnieuw genereren na een teambesluit — hergenereren
 * terwijl de DB veranderd is kan nummers verschuiven t.o.v. wat al op de NAS
 * staat.
 *
 * Draaien (read-only op de database):  node archive-structure.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
fs.mkdirSync(OUTDIR, { recursive: true });
const OUT = path.join(OUTDIR, 'structuur.jsonl');
const RENAMELOG = path.join(OUTDIR, 'structuur-hernoemd.log');
const PREVIEW = path.join(OUTDIR, 'structuur-voorbeeld.txt');

// ── env + gepagineerd Supabase-lezen (1000-rijen-clamp: vaste les) ──
for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SUPABASE_URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) { console.error('Geen Supabase-env in cloud.env — stop.'); process.exit(1); }
const PAGE = 1000;
async function sbCount(table, query, key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${key}${query}`, {
    method: 'HEAD', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) throw new Error(`telling ${table}: ${res.status}`);
  const total = parseInt((res.headers.get('content-range') || '').split('/')[1], 10);
  if (!Number.isFinite(total)) throw new Error(`telling ${table}: onleesbare content-range`);
  return total;
}
async function sbAll(table, select, query = '', label = table, key = 'id') {
  const expected = await sbCount(table, query, key);
  const rows = [];
  for (let from = 0; from < expected; from += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}&order=${key}.asc`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${Math.min(from + PAGE - 1, expected - 1)}` },
    });
    if (!res.ok) throw new Error(`ophalen ${table}: ${res.status} ${await res.text()}`);
    rows.push(...(await res.json()));
  }
  if (rows.length !== expected) throw new Error(`${table}: ${rows.length} van ${expected} — paginering onbetrouwbaar, stop.`);
  console.log(`  ${label}: ${rows.length}`);
  return rows;
}
const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

console.log('Bibliotheek ophalen…');
const videos = await sbAll('videos', 'id,external_id,title', '', "video's");
const collections = await sbAll('collections', 'id,external_id,title', '', 'series');
const categories = await sbAll('categories', 'id,name,position', '', 'categorieën');
const items = await sbAll('collection_items', 'collection_id,video_id,position', '', 'afleveringen');
const catItems = await sbAll('category_items', 'category_id,video_id,collection_id,position', '', 'categorie-inhoud');
let videoCats = [];
try { videoCats = await sbAll('video_categories', 'video_id,category_id', '', 'categoriekoppelingen', 'video_id'); }
catch (e) { console.warn(`  let op: video_categories niet leesbaar (${e.message})`); }

// ── bron-universum: alle Uscreen-ids die het archief in moeten ──
const universe = new Set();
for (const r of readJsonl(path.join(CC, 'uscreen-video-details.jsonl'))) universe.add(String(r.id));
for (const r of readJsonl(path.join(CC, 'uscreen-video-ids.jsonl'))) universe.add(String(r.id));
const jsonlTitles = new Map();
for (const r of readJsonl(path.join(CC, 'uscreen-videos-rich.jsonl'))) jsonlTitles.set(String(r.id), r.title ?? '');
for (const r of readJsonl(path.join(CC, 'uscreen-video-details.jsonl'))) {
  if (!jsonlTitles.get(String(r.id)) && r.title) jsonlTitles.set(String(r.id), r.title);
}

// ── naam-hygiëne ──
const renames = [];
function san(name, ctx) {
  const orig = String(name ?? '').trim();
  let out = orig.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim().replace(/[. ]+$/g, '');
  if (!out) out = 'zonder titel';
  while (Buffer.byteLength(out, 'utf8') > 150) out = out.slice(0, -1).trimEnd();
  if (out !== orig) renames.push(`${ctx}: "${orig}" → "${out}"`);
  return out;
}
const p2 = (n, w) => String(n).padStart(w, '0');
const padW = (count) => Math.max(2, String(count).length);

// ── hulpstructuren (zelfde opbouw als build-library-showcase.mjs) ──
const byId = new Map(videos.map((v) => [v.id, v]));
const collById = new Map(collections.map((c) => [c.id, c]));
const itemsByColl = new Map();
for (const it of items) {
  if (!itemsByColl.has(it.collection_id)) itemsByColl.set(it.collection_id, []);
  itemsByColl.get(it.collection_id).push(it);
}
for (const list of itemsByColl.values()) list.sort((a, b) => a.position - b.position);
const ciByCat = new Map();
for (const ci of catItems) {
  if (!ciByCat.has(ci.category_id)) ciByCat.set(ci.category_id, []);
  ciByCat.get(ci.category_id).push(ci);
}
const vcByCat = new Map();
for (const l of videoCats) {
  if (!vcByCat.has(l.category_id)) vcByCat.set(l.category_id, []);
  vcByCat.get(l.category_id).push(l.video_id);
}
const collOfVideo = new Map();
for (const it of items) if (!collOfVideo.has(it.video_id)) collOfVideo.set(it.video_id, it.collection_id);
const catsOrdered = categories.slice().sort((a, b) =>
  ((a.position ?? 9999) - (b.position ?? 9999)) || String(a.name).localeCompare(String(b.name), 'nl'));

// ── plaatsing ──
// placed: video.id (DB-uuid) → {dest, ook_in[]}; sleutel naar buiten toe is external_id
const placed = new Map();
const stats = { vast: 0, dubbel: 0, vangnetCats: [], buiten: 0, nietInDb: 0 };

function placeOrNote(v, destPath) {
  const cur = placed.get(v.id);
  if (cur) { cur.ook_in.push(destPath); stats.dubbel++; return false; }
  placed.set(v.id, { dest: destPath, ook_in: [] });
  stats.vast++;
  return true;
}

/** Plaats een serie-blok: alle (nog niet geplaatste) afleveringen onder serieDir.
 * Afleveringsnummer = échte plek in de serie (gaten bestaan niet meer: sinds het
 * hardlink-besluit (teamfeedback 2026-08-11) vult elke secundaire seriemap zich
 * met hardlinks, dus elke map toont de volledige serie.
 *
 * seriesOut: per collectie ÉÉN regel — dirs[0] = primaire map (eerste
 * platform-plek), dirs[1..] = secundaire mappen (hardlink-doelen voor
 * afleveringen én serie-metadata: cover, teksten, thumbnails, bijlagen).
 * eps = volledige afleveringslijst; bestandsnamen zijn per map identiek
 * (zelfde collection_items-volgorde → zelfde nummering). */
const seriesOut = new Map(); // collection-ext-id → {collection, dirs[], eps[]}
function placeSeries(coll, parentDir, serieDirName) {
  const list = itemsByColl.get(coll.id) || [];
  const w = padW(list.length);
  const key = String(coll.external_id ?? coll.id);
  let entry = seriesOut.get(key);
  if (!entry) { entry = { collection: key, dirs: [], eps: [] }; seriesOut.set(key, entry); }
  const dir = `${parentDir}/${serieDirName}`;
  if (!entry.dirs.includes(dir)) entry.dirs.push(dir);
  const fillEps = entry.eps.length === 0;
  let nieuw = 0;
  list.forEach((it, i) => {
    const v = byId.get(it.video_id);
    if (!v) return;
    const base = `${p2(i + 1, w)} - ${san(v.title, `aflevering ${v.external_id}`)}`;
    if (fillEps) entry.eps.push({ id: String(v.external_id), bestand: base });
    if (placeOrNote(v, `${dir}/${base}`)) nieuw++;
  });
  return nieuw;
}

const treeForPreview = new Map(); // catDir → geordende regels voor de proefweergave

for (let ci = 0; ci < catsOrdered.length; ci++) {
  const c = catsOrdered[ci];
  const catDir = `${p2(ci + 1, 2)} - ${san(c.name, `categorie ${c.name}`)}`;
  const lines = [];
  const list = (ciByCat.get(c.id) || []).slice().sort((a, b) => a.position - b.position);
  if (list.length) {
    const w = padW(list.length);
    list.forEach((entry, i) => {
      const nn = p2(i + 1, w);
      if (entry.collection_id) {
        const coll = collById.get(entry.collection_id);
        if (!coll || !(itemsByColl.get(coll.id) || []).length) return;
        const dirName = `${nn} - ${san(coll.title, `serie ${coll.external_id ?? coll.id}`)}`;
        const nieuw = placeSeries(coll, catDir, dirName);
        lines.push({ soort: 'S', naam: dirName, coll, nieuw });
      } else if (entry.video_id) {
        const v = byId.get(entry.video_id);
        if (!v) return;
        const dest = `${catDir}/${nn} - ${san(v.title, `video ${v.external_id}`)}`;
        const nieuw = placeOrNote(v, dest);
        lines.push({ soort: 'V', naam: `${nn} - ${san(v.title, '')}`, nieuw });
      }
    });
  } else {
    // Vangnet — identiek aan de bladerversie: geen vastgestelde volgorde →
    // series alfabetisch, dan losse video's; mét die volgorde genummerd.
    const vids = (vcByCat.get(c.id) || []).map((id) => byId.get(id)).filter(Boolean);
    if (!vids.length) continue;
    stats.vangnetCats.push(c.name);
    const seen = new Set(); const colls = [];
    for (const v of vids) {
      const cid = collOfVideo.get(v.id);
      if (cid && !seen.has(cid)) { seen.add(cid); const coll = collById.get(cid); if (coll) colls.push(coll); }
    }
    colls.sort((a, b) => String(a.title).localeCompare(String(b.title), 'nl'));
    const loose = vids.filter((v) => !collOfVideo.has(v.id))
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nl'));
    const w = padW(colls.length + loose.length);
    let n = 0;
    for (const coll of colls) {
      const dirName = `${p2(++n, w)} - ${san(coll.title, `serie ${coll.external_id ?? coll.id}`)}`;
      const nieuw = placeSeries(coll, catDir, dirName);
      lines.push({ soort: 'S', naam: dirName, coll, nieuw });
    }
    for (const v of loose) {
      const dest = `${catDir}/${p2(++n, w)} - ${san(v.title, `video ${v.external_id}`)}`;
      const nieuw = placeOrNote(v, dest);
      lines.push({ soort: 'V', naam: dest.slice(catDir.length + 1), nieuw });
    }
  }
  if (lines.length) treeForPreview.set(catDir, lines);
}

// ── 99 - Buiten categorieën: series zonder categorie, dan losse video's ──
const BUITEN = '99 - Buiten categorieën';
const buitenLines = [];
const dirNames = new Set(); // botsingswacht binnen 99 (mappen zijn hier ongenummerd)
for (const coll of collections.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'nl'))) {
  const list = itemsByColl.get(coll.id) || [];
  if (!list.some((it) => byId.get(it.video_id) && !placed.has(it.video_id))) continue;
  let dirName = san(coll.title, `serie ${coll.external_id ?? coll.id}`);
  if (dirNames.has(dirName.toLowerCase())) {
    dirName = `${dirName} (${coll.external_id ?? coll.id})`;
    renames.push(`99-map botsing: serie "${coll.title}" → "${dirName}"`);
  }
  dirNames.add(dirName.toLowerCase());
  const nieuw = placeSeries(coll, BUITEN, dirName);
  if (nieuw) { buitenLines.push({ soort: 'S', naam: dirName, coll, nieuw }); stats.buiten += nieuw; }
}
for (const v of videos) {
  if (placed.has(v.id)) continue;
  const dest = `${BUITEN}/${san(v.title, `video ${v.external_id}`)} (${v.external_id})`;
  placeOrNote(v, dest);
  buitenLines.push({ soort: 'V', naam: dest.slice(BUITEN.length + 1) });
  stats.buiten++;
}

// ── uitvoer: per Uscreen-id één regel ──
const out = [];
const inDb = new Set();
for (const v of videos) {
  if (!v.external_id) continue;
  inDb.add(String(v.external_id));
  const pl = placed.get(v.id);
  if (!pl) continue;
  out.push({ id: String(v.external_id), dest: pl.dest, ook_in: pl.ook_in });
}
for (const id of universe) {
  if (inDb.has(id)) continue;
  stats.nietInDb++;
  const title = jsonlTitles.get(id) || `video ${id}`;
  out.push({ id, dest: `${BUITEN}/${san(title, `niet-in-db ${id}`)} (${id})`, ook_in: [], niet_in_db: true });
}
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'structuur-series.jsonl'),
  [...seriesOut.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(RENAMELOG, renames.length ? renames.join('\n') + '\n' : 'geen namen aangepast\n');

// ── proefweergave: 2 categorieën (waar mogelijk één met serie ÉN losse video) ──
function previewCat(catDir, lines, maxBlocks = 10) {
  const outL = [`${catDir}/`];
  const shown = lines.slice(0, maxBlocks);
  for (const l of shown) {
    if (l.soort === 'S') {
      const list = itemsByColl.get(l.coll.id) || [];
      const w = padW(list.length);
      const elders = list.length - l.nieuw;
      outL.push(`  ${l.naam}/${elders > 0 ? `   (${elders} afl. elders ondergebracht → gat in nummering, zie ook_in)` : ''}`);
      const eps = [];
      list.forEach((it, i) => {
        const v = byId.get(it.video_id);
        if (!v) return;
        const pl = placed.get(v.id);
        const here = pl && pl.dest.startsWith(`${catDir}/${l.naam}/`);
        if (here) eps.push(`    ${p2(i + 1, w)} - ${san(v.title, '')}.mp4`);
      });
      outL.push(...eps.slice(0, 4));
      if (eps.length > 4) outL.push(`    … nog ${eps.length - 4} afleveringen`);
    } else {
      outL.push(`  ${l.naam}.mp4${l.nieuw === false ? '   (elders ondergebracht)' : ''}`);
    }
  }
  if (lines.length > maxBlocks) outL.push(`  … nog ${lines.length - maxBlocks} series/video's`);
  return outL.join('\n');
}
const cats = [...treeForPreview.entries()];
const first = cats[0];
const mixed = cats.find(([d, ls], i) => i > 0 && ls.some((l) => l.soort === 'S') && ls.some((l) => l.soort === 'V')) ?? cats[1];
const dupExample = out.find((r) => r.ook_in.length);
const preview = [
  'PROEFWEERGAVE ARCHIEFSTRUCTUUR (teambesluit 2026-08-11) — gegenereerd door archive-structure.mjs',
  '(.mp4 als voorbeeld; de echte extensie volgt uit het originele Uscreen-bestand)',
  '',
  previewCat(first[0], first[1]),
  '',
  previewCat(mixed[0], mixed[1]),
  '',
  `${BUITEN}/  (eerste regels van ${buitenLines.length})`,
  ...buitenLines.slice(0, 6).map((l) => `  ${l.naam}${l.soort === 'S' ? '/' : '.mp4'}`),
  '',
  dupExample ? `Voorbeeld meervoudige categorie: id ${dupExample.id}\n  vaste plek: ${dupExample.dest}\n  hoort óók in: ${dupExample.ook_in.join(' | ')}` : 'Geen video in meerdere categorieën aangetroffen.',
].join('\n');
fs.writeFileSync(PREVIEW, preview + '\n');

console.log(`\nStructuur berekend:`);
console.log(`  ${stats.vast} video's een vaste plek (waarvan ${stats.buiten} in "${BUITEN}")`);
console.log(`  ${stats.dubbel} extra plekken vastgelegd als ook_in (dedup, teambesluit punt 2)`);
console.log(`  ${stats.nietInDb} ids uit de bron-jsonl zonder databaserij → "${BUITEN}"`);
console.log(`  vangnet-categorieën (volgorde niet vastgesteld, zoals bladerversie): ${stats.vangnetCats.length ? stats.vangnetCats.join(', ') : 'geen'}`);
console.log(`  ${renames.length} namen aangepast (log: ${RENAMELOG})`);
console.log(`  toewijzing: ${OUT} (${out.length} regels; universum ${universe.size})`);
if (out.length !== universe.size) {
  console.error(`  ⚠ LET OP: ${out.length} toewijzingen ≠ ${universe.size} ids in het universum — uitzoeken vóór de run!`);
}
console.log(`  proefweergave: ${PREVIEW}`);
