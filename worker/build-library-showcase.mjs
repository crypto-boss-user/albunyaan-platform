#!/usr/bin/env node
/**
 * build-library-showcase.mjs — bouwt één HTML-bestand waarin de VOLLEDIGE
 * bibliotheek doorzoekbaar en doorbladerbaar is.
 *
 * Sinds 2026-08-07 (fidelity-werkorder) toont hij de bibliotheek zoals leden
 * hem zien: CATEGORIEËN in de echte site-volgorde (categories.position), met
 * daarbinnen de handmatig geordende MIX van series én losse video's
 * (category_items.position). Per video: beschrijving en bijlagen (naam, type,
 * grootte). Alles wat buiten de categorieën valt staat in een aparte groep
 * achteraan — er wordt niets stilletjes weggelaten.
 *
 * STRIKT READ-ONLY tegen Supabase. Schrijft alleen het HTML-bestand.
 *
 * Draaien:
 *   set -a; source ~/.albunyaan-cc/cloud.env; set +a
 *   node worker/build-library-showcase.mjs
 *
 * Opties:
 *   --out PAD      doel (standaard var/showcase/bibliotheek-<datum>.html)
 *   --ttl DAGEN    geldigheid van de afspeellinks (standaard 7)
 *   --no-play      geen afspeellinks meebakken → kleiner bestand, alleen bladeren
 *
 * LET OP: met afspeellinks bevat het bestand tijdelijk geldige speeltokens.
 * Deel het binnen het team, niet publiek. De ondertekeningssleutel zelf komt
 * NOOIT in het bestand terecht.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvFile(path.join(REPO, 'apps/web/.env.local'));
loadEnvFile(path.join(os.homedir(), '.albunyaan-cc/cloud.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID;
const EMBED_TOKEN_KEY = process.env.BUNNY_EMBED_TOKEN_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FOUT: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  console.error('Draai eerst:  set -a; source ~/.albunyaan-cc/cloud.env; set +a');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const NO_PLAY = args.includes('--no-play');
const TTL_DAYS = parseInt(argVal('--ttl', '7'), 10);
const startedAt = new Date();
const stamp = startedAt.toISOString().slice(0, 10);
const OUT = path.resolve(argVal('--out', path.join(REPO, 'var', 'showcase', `bibliotheek-${stamp}.html`)));
const expiresAt = new Date(startedAt.getTime() + TTL_DAYS * 86400_000);
const expiresStr = expiresAt.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const PAGE = 1000;

async function sbCount(table, query = '', key = 'id') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${key}${query}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) throw new Error(`telling ${table}: ${res.status} ${await res.text()}`);
  const total = parseInt((res.headers.get('content-range') || '').split('/')[1], 10);
  if (!Number.isFinite(total)) throw new Error(`telling ${table}: onleesbare content-range`);
  return total;
}

async function sbAll(table, select, query = '', label = table, key = 'id') {
  const expected = await sbCount(table, query, key);
  const rows = [];
  for (let from = 0; from < expected; from += PAGE) {
    const to = Math.min(from + PAGE - 1, expected - 1);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}&order=${key}.asc`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Range: `${from}-${to}` },
    });
    if (!res.ok) throw new Error(`ophalen ${table} [${from}-${to}]: ${res.status} ${await res.text()}`);
    rows.push(...(await res.json()));
    process.stdout.write(`\r  ${label}: ${rows.length}/${expected}   `);
  }
  process.stdout.write('\n');
  if (rows.length !== expected) throw new Error(`${table}: ${rows.length} van ${expected} — paginering onbetrouwbaar, afgebroken.`);
  return rows;
}

const nl = (n) => Number(n ?? 0).toLocaleString('nl-NL');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();

console.log('\nBibliotheek ophalen…\n');
const videos = await sbAll('videos', 'id,external_id,title,member_visible,bunny_video_id,thumbnail_url,duration_seconds,description,resources,original_max_height,bunny_height', '', "video's");
const collections = await sbAll('collections', 'id,external_id,title,description,raw', '', 'series');
const categories = await sbAll('categories', 'id,name,position', '', 'categorieën');
const items = await sbAll('collection_items', 'id,collection_id,video_id,position', '', 'afleveringen');
const catItems = await sbAll('category_items', 'id,category_id,video_id,collection_id,position', '', 'categorie-inhoud');
let videoCats = [];
try { videoCats = await sbAll('video_categories', 'video_id,category_id', '', 'categoriekoppelingen', 'video_id'); }
catch (e) { console.warn(`  let op: video_categories niet leesbaar (${e.message})`); }

// ── afspeellinks vooraf ondertekenen (de sleutel zelf gaat NOOIT mee) ──
const expires = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
function playUrl(guid) {
  if (NO_PLAY || !LIBRARY_ID || !guid) return null;
  const base = `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${guid}?autoplay=false&preload=true`;
  if (!EMBED_TOKEN_KEY) return base;
  const token = createHash('sha256').update(`${EMBED_TOKEN_KEY}${guid}${expires}`).digest('hex');
  return `${base}&token=${token}&expires=${expires}`;
}

// ── compacte datastructuur ──
const byId = new Map(videos.map((v) => [v.id, v]));
const collById = new Map(collections.map((c) => [c.id, c]));

const itemsByColl = new Map();
for (const it of items) {
  if (!itemsByColl.has(it.collection_id)) itemsByColl.set(it.collection_id, []);
  itemsByColl.get(it.collection_id).push(it);
}

// gemeenschappelijk thumbnail-voorvoegsel afsplitsen — scheelt fors in bestandsgrootte
const thumbs = videos.map((v) => v.thumbnail_url).filter(Boolean);
let PREFIX = '';
if (thumbs.length) {
  PREFIX = thumbs[0];
  for (const t of thumbs) { while (PREFIX && !t.startsWith(PREFIX)) PREFIX = PREFIX.slice(0, -1); }
}
const shortThumb = (u) => (u ? (PREFIX && u.startsWith(PREFIX) ? u.slice(PREFIX.length) : `\u0000${u}`) : '');

// dekkings-tellers (unieke video's, niet plaatsen)
const mvSeen = new Set(), mvHaveSeen = new Set();
for (const v of videos) {
  if (!v.member_visible) continue;
  mvSeen.add(v.id);
  if (v.bunny_video_id) mvHaveSeen.add(v.id);
}
const mvTotal = mvSeen.size, mvHave = mvHaveSeen.size;

// ── kwaliteitsstatus per video ──────────────────────────────────────────────
// 2 = gemeten én gelijk aan de bron · 1 = gemeten én LAGER dan de bron
// 0 = (nog) niet gemeten. Alleen de video's die de gefixte engine heeft
// overgezet zijn gemeten; de rest volgt met de kwaliteitsronde. Nooit gokken:
// "niet gemeten" is een eigen categorie, geen impliciet "goed" of "fout".
const qSeen = { ok: 0, low: 0, unknown: 0 };
function qualityOf(v) {
  if (!v.bunny_video_id) return [0, 0, 0];
  const src = v.original_max_height || 0, got = v.bunny_height || 0;
  if (!src || !got) { qSeen.unknown++; return [0, src, got]; }
  if (got >= src) { qSeen.ok++; return [2, src, got]; }
  qSeen.low++; return [1, src, got];
}

// één video-rij: [titel,duur,mv,have,thumb,play,extid,num,beschrijving,bijlagen,kwaliteit]
function epRow(v, num) {
  // [titel, type, grootte, url, id] — het id is nodig voor verify-coverage.mjs
  const res = (Array.isArray(v.resources) ? v.resources : [])
    .map((r) => [r.title ?? `bestand ${r.id}`, (r.extension ?? '').toUpperCase(), r.size ?? 0, r.url ?? '', String(r.id ?? '')]);
  return [
    v.title || '', v.duration_seconds || 0, v.member_visible ? 1 : 0, v.bunny_video_id ? 1 : 0,
    shortThumb(v.thumbnail_url), playUrl(v.bunny_video_id) || '', v.external_id || '', num,
    plain(v.description), res, qualityOf(v),
  ];
}

// serie-blok: ['S', titel, cover, eps]
function seriesBlock(coll) {
  const list = (itemsByColl.get(coll.id) || []).slice().sort((a, b) => a.position - b.position);
  const eps = [];
  for (const it of list) {
    const v = byId.get(it.video_id);
    if (v) eps.push(epRow(v, eps.length + 1));
  }
  if (!eps.length) return null;
  const cover = coll.raw?.cover_url || coll.raw?.coverUrl || coll.raw?.cover || null;
  return ['S', coll.title || '', cover ? shortThumb(cover) : '', eps, plain(coll.description)];
}

// ── categorieën in ECHTE volgorde, inhoud in category_items-volgorde ──
const ciByCat = new Map();
for (const ci of catItems) {
  if (!ciByCat.has(ci.category_id)) ciByCat.set(ci.category_id, []);
  ciByCat.get(ci.category_id).push(ci);
}
const catsOrdered = categories.slice().sort((a, b) =>
  ((a.position ?? 9999) - (b.position ?? 9999)) || String(a.name).localeCompare(String(b.name), 'nl'));

// vangnet: categorie → video's uit de platte koppeltabel (geen volgorde bekend)
const vcByCat = new Map();
for (const l of videoCats) {
  if (!vcByCat.has(l.category_id)) vcByCat.set(l.category_id, []);
  vcByCat.get(l.category_id).push(l.video_id);
}
// serie waarin een video zit — om vangnet-video's tot serieblokken te bundelen
const collOfVideo = new Map();
for (const it of items) if (!collOfVideo.has(it.video_id)) collOfVideo.set(it.video_id, it.collection_id);

const CATS = [];             // [naam, blokken[], voetnoot]
const usedColls = new Set(); // collecties die al ergens getoond zijn
const usedLoose = new Set(); // losse video's die al ergens getoond zijn
let epTotal = 0;
const fallbackCats = [];

for (const c of catsOrdered) {
  const list = (ciByCat.get(c.id) || []).slice().sort((a, b) => a.position - b.position);
  const blocks = [];
  if (list.length) {
    for (const ci of list) {
      if (ci.collection_id) {
        const coll = collById.get(ci.collection_id);
        const blk = coll && seriesBlock(coll);
        if (blk) { blocks.push(blk); usedColls.add(ci.collection_id); epTotal += blk[3].length; }
      } else if (ci.video_id) {
        const v = byId.get(ci.video_id);
        if (v) { blocks.push(['V', epRow(v, blocks.length + 1)]); usedLoose.add(v.id); }
      }
    }
    if (blocks.length) { CATS.push([c.name, blocks, '']); continue; }
  }
  // VANGNET (2026-08-07): geen vastgestelde volgorde → toon de categorie tóch,
  // opgebouwd uit video_categories. Series alfabetisch, dan losse video's;
  // met voetnoot, zodat niemand deze volgorde voor de echte aanziet.
  const vids = (vcByCat.get(c.id) || []).map((id) => byId.get(id)).filter(Boolean);
  if (!vids.length) continue;
  const seenColl = new Set(), fb = [];
  for (const v of vids) {
    const cid = collOfVideo.get(v.id);
    if (cid) { if (!seenColl.has(cid)) { seenColl.add(cid); const coll = collById.get(cid); const blk = coll && seriesBlock(coll); if (blk) fb.push(blk); } }
  }
  fb.sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'nl'));
  const looseHere = vids.filter((v) => !collOfVideo.has(v.id)).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nl'));
  for (const v of looseHere) fb.push(['V', epRow(v, fb.length + 1)]);
  if (!fb.length) continue;
  for (const b of fb) if (b[0] === 'S') epTotal += b[3].length;
  CATS.push([c.name, fb, 'volgorde niet vastgesteld — categorie niet openbaar op storefront']);
  fallbackCats.push(c.name);
}

// ── restgroep: alles wat (nog) niet via category_items geplaatst is ──
// Eerst de overige series (op titel), daarna overige losse video's.
const restBlocks = [];
for (const coll of collections.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'nl'))) {
  if (usedColls.has(coll.id)) continue;
  const blk = seriesBlock(coll);
  if (blk) { restBlocks.push(blk); epTotal += blk[3].length; }
}
const inSeries = new Set(items.map((i) => i.video_id));
const restLoose = videos
  .filter((v) => !inSeries.has(v.id) && !usedLoose.has(v.id))
  .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'nl'));
for (const v of restLoose) restBlocks.push(['V', epRow(v, restBlocks.length + 1)]);
if (restBlocks.length) CATS.push([`📦 Buiten de categorieën (${nl(restBlocks.length)} series/video's)`, restBlocks, 'staan in geen enkele categorie op Uscreen — alfabetisch geordend']);

const uniqueInSeries = new Set(items.map((i) => i.video_id)).size;
const nSeriesShown = CATS.reduce((n, [, blocks]) => n + blocks.filter((b) => b[0] === 'S').length, 0);
const nLooseShown = CATS.reduce((n, [, blocks]) => n + blocks.filter((b) => b[0] === 'V').length, 0);

const DATA = { p: PREFIX, c: CATS, gen: startedAt.toISOString(), ttl: NO_PLAY ? 0 : TTL_DAYS, exp: NO_PLAY ? '' : expiresStr };
const covPct = mvTotal ? (100 * mvHave / mvTotal) : 0;
// Kwaliteitstellers over unieke video's mét kopie (niet over plaatsen).
const qUnique = { ok: 0, low: 0, unknown: 0 };
for (const v of videos) {
  if (!v.bunny_video_id) continue;
  const src = v.original_max_height || 0, got = v.bunny_height || 0;
  if (!src || !got) qUnique.unknown++;
  else if (got >= src) qUnique.ok++;
  else qUnique.low++;
}
const qTotal = qUnique.ok + qUnique.low + qUnique.unknown;

console.log(`\n  ${nl(CATS.length)} categorieën · ${nl(nSeriesShown)} serie-blokken · ${nl(nLooseShown)} losse video's`);
console.log(`  ${nl(mvHave)} van ${nl(mvTotal)} lid-zichtbare video's op eigen opslag\n`);

// ─────────────────────────── HTML ───────────────────────────

const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Onze videobibliotheek — albunyaan.tv</title>
<style>
:root{
  color-scheme:light;
  --surface-0:#f4f3f0; --surface-1:#fcfcfb; --line:#e2e0d9;
  --text-primary:#0b0b0b; --text-secondary:#52514e; --text-muted:#807e78;
  --accent:#2a78d6;
  --good:#0ca30c; --warning:#fab219;
  --good-bg:#e8f6e8; --warning-bg:#fdf4de;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
    --surface-0:#111110; --surface-1:#1a1a19; --line:#33322e;
    --text-primary:#fff; --text-secondary:#c3c2b7; --text-muted:#8f8e85;
    --accent:#3987e5; --good-bg:#122a12; --warning-bg:#302713;
  }
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--surface-0);color:var(--text-primary);
  font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px 80px}

header{padding:36px 0 20px}
h1{font-size:30px;margin:0 0 4px;letter-spacing:-.022em}
.sub{color:var(--text-secondary);font-size:14px}

.hero{background:var(--surface-1);border:1px solid var(--line);border-radius:16px;
  padding:26px 28px;margin:22px 0 18px}
.hero .big{font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:1.05}
.hero .cap{color:var(--text-secondary);margin-top:2px}
.meter{height:12px;background:var(--surface-0);border:1px solid var(--line);
  border-radius:99px;overflow:hidden;margin-top:16px}
.meter i{display:block;height:100%;background:var(--accent);border-radius:99px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.tile{background:var(--surface-1);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.tile .n{font-size:23px;font-weight:700;letter-spacing:-.02em}
.tile .l{font-size:12px;color:var(--text-secondary);margin-top:2px}

.banner{border:1px solid var(--line);border-left:4px solid var(--warning);
  background:var(--warning-bg);border-radius:10px;padding:13px 17px;margin:16px 0;font-size:14px}

.bar{position:sticky;top:0;z-index:20;background:var(--surface-0);
  padding:14px 0 12px;border-bottom:1px solid var(--line);margin-bottom:20px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input[type=search]{flex:1;min-width:240px;padding:11px 15px;border:1px solid var(--line);
  border-radius:10px;font-size:15px;background:var(--surface-1);color:var(--text-primary)}
input[type=search]:focus{outline:2px solid var(--accent);outline-offset:-1px}
select,.btn{padding:11px 14px;border:1px solid var(--line);border-radius:10px;
  background:var(--surface-1);color:var(--text-primary);font-size:14px;cursor:pointer}
.count{color:var(--text-secondary);font-size:13.5px;margin-top:9px}

h2.cat{font-size:19px;margin:30px 0 12px;letter-spacing:-.015em;display:flex;align-items:baseline;gap:10px}
h2.cat .cnt{font-size:12.5px;color:var(--text-muted);font-weight:400}

.series{background:var(--surface-1);border:1px solid var(--line);border-radius:13px;
  margin-bottom:11px;overflow:hidden}
.shead{display:flex;gap:15px;align-items:center;padding:13px 16px;cursor:pointer;user-select:none}
.shead:hover{background:var(--surface-0)}
.shead img{width:104px;height:59px;object-fit:cover;border-radius:7px;background:var(--surface-0);flex:none}
.shead .meta{flex:1;min-width:0}
.shead .t{font-weight:640;font-size:15.5px;letter-spacing:-.01em}
.shead .d{font-size:12.5px;color:var(--text-secondary);margin-top:2px}
.chev{color:var(--text-muted);font-size:13px;flex:none}

.pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:99px;
  font-size:11.5px;font-weight:640;white-space:nowrap}
.pill.ok{background:var(--good-bg);color:var(--good)}
.pill.wait{background:var(--warning-bg);color:#8a6000}
.pill.q0{background:var(--surface-0);color:var(--text-muted);border:1px solid var(--line)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .pill.wait{color:var(--warning)}}

.eps{display:none;border-top:1px solid var(--line)}
.series.open .eps{display:block}
.ep{display:flex;gap:13px;align-items:center;padding:9px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ep:last-child{border-bottom:0}
.ep:hover{background:var(--surface-0)}
.ep .num{width:30px;text-align:right;color:var(--text-muted);font-size:12.5px;
  font-variant-numeric:tabular-nums;flex:none}
.ep img{width:78px;height:44px;object-fit:cover;border-radius:5px;background:var(--surface-0);flex:none}
.ep .t{flex:1;min-width:0;font-size:14px}
.ep .dur{color:var(--text-muted);font-size:12.5px;font-variant-numeric:tabular-nums;flex:none}
.play{background:var(--accent);color:#fff;border:0;padding:6px 13px;border-radius:7px;
  font-size:12.5px;font-weight:640;cursor:pointer;flex:none;text-decoration:none}
.play[disabled]{background:var(--surface-0);color:var(--text-muted);cursor:not-allowed;
  border:1px solid var(--line)}
.info{background:none;border:1px solid var(--line);border-radius:7px;color:var(--text-secondary);
  font-size:12.5px;padding:6px 10px;cursor:pointer;flex:none}
.detail{display:none;flex-basis:100%;padding:4px 16px 10px 59px;font-size:13.5px;color:var(--text-secondary)}
.ep.open .detail{display:block}
.detail .att{margin-top:6px}
.detail .att a{color:var(--accent);text-decoration:none}
.detail .att a:hover{text-decoration:underline}
.detail .att .noord{color:var(--text-muted)}
.sdesc{padding:11px 16px;font-size:13.5px;color:var(--text-secondary);
  border-bottom:1px solid var(--line);background:var(--surface-0)}
.note{font-size:12.5px;color:var(--text-muted);margin:-6px 0 10px 2px}

dialog{border:0;border-radius:14px;padding:0;background:#000;max-width:min(94vw,1080px);width:100%}
dialog::backdrop{background:rgba(0,0,0,.75)}
dialog iframe{width:100%;aspect-ratio:16/9;border:0;display:block}
.dh{display:flex;justify-content:space-between;align-items:center;gap:14px;
  padding:11px 15px;background:var(--surface-1);color:var(--text-primary);font-size:14px}
.dh button{background:0;border:0;font-size:22px;cursor:pointer;color:var(--text-secondary);line-height:1}

.empty{text-align:center;padding:50px;color:var(--text-secondary)}
footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);
  color:var(--text-muted);font-size:12.5px}
</style></head><body>
<div class="wrap">

<header>
  <h1>Onze videobibliotheek</h1>
  <div class="sub">Alles wat van Uscreen naar onze eigen infrastructuur is overgezet — categorieën, series en losse video's in de oorspronkelijke volgorde, met beschrijvingen en bijlagen.</div>
</header>

<div class="hero">
  <div class="big">${nl(mvHave)} <span style="font-size:26px;font-weight:500;color:var(--text-secondary)">van ${nl(mvTotal)}</span></div>
  <div class="cap">video's die leden kunnen bekijken, staan op onze eigen opslag — <strong>${covPct.toFixed(1).replace('.', ',')}%</strong></div>
  <div class="meter"><i style="width:${covPct.toFixed(2)}%"></i></div>
  <div class="tiles">
    <div class="tile"><div class="n">${nl(CATS.length)}</div><div class="l">categorieën (site-volgorde)</div></div>
    <div class="tile"><div class="n">${nl(nSeriesShown)}</div><div class="l">serie-blokken<br><span style="font-size:11px">${nl(uniqueInSeries)} unieke video's in series</span></div></div>
    <div class="tile"><div class="n">${nl(nLooseShown)}</div><div class="l">losse video's (films, app-pagina's)</div></div>
    <div class="tile"><div class="n">${nl(qUnique.ok)}</div><div class="l">al op bronkwaliteit<br><span style="font-size:11px">van ${nl(qTotal)} video's met kopie</span></div></div>
  </div>
  <div class="cap" style="margin-top:14px;font-size:13px">
    <strong>Kwaliteit:</strong> ${nl(qUnique.ok)} van ${nl(qTotal)} video's staan aantoonbaar op bronkwaliteit${qUnique.low ? ` · ${nl(qUnique.low)} nog op de oude, lagere kwaliteit` : ''} ·
    ${nl(qUnique.unknown)} nog niet gemeten (die worden meegenomen in de kwaliteitsronde).
  </div>
</div>

${NO_PLAY ? `<div class="banner" id="banner">
  <strong>Overzicht van de bibliotheek.</strong> Elke categorie, serie, losse video en aflevering in de volgorde van de echte site, met beschrijvingen en bijlagen. Alle gegevens komen uit onze eigen database en beeldopslag — er wordt niets bij Uscreen opgehaald.
</div>` : `<div class="banner" id="banner">
  <strong>▶ Afspeellinks geldig t/m ${esc(expiresStr)}.</strong> Bladeren en zoeken blijft daarna gewoon werken; alleen de afspeelknoppen verlopen dan. Het afspelen loopt via onze videodienst Bunny.
</div>`}

<div class="bar">
  <div class="row">
    <input type="search" id="q" placeholder="Zoek op titel van serie, video of aflevering…" autocomplete="off">
    <select id="cat"><option value="">Alle categorieën</option>${CATS.map((c, i) => `<option value="${i}">${esc(c[0])}</option>`).join('')}</select>
    <select id="st">
      <option value="">Alle video's</option>
      <option value="have">Alleen overgezet</option>
      <option value="miss">Alleen nog niet overgezet</option>
      <option value="qok">Alleen op bronkwaliteit</option>
      <option value="qlow">Alleen lagere kwaliteit</option>
      <option value="qunk">Kwaliteit nog niet gemeten</option>
    </select>
    <button class="btn" id="expand">Alles openklappen</button>
  </div>
  <div class="count" id="count"></div>
</div>

<div id="list"></div>

<footer>
  Gegenereerd op ${startedAt.toLocaleString('nl-NL')} uit onze eigen database ·
  ${NO_PLAY ? 'zonder afspeellinks' : `afspeellinks geldig t/m ${esc(expiresStr)}`} ·
  Volgorde = de echte site-volgorde (categorieën &amp; inhoud) ·
  Opnieuw te genereren met <code>worker/build-library-showcase.mjs</code>.
</footer>
</div>

<dialog id="player"><div class="dh"><span id="pt"></span><button id="pc" aria-label="Sluiten">×</button></div><div id="pb"></div></dialog>

<script id="data" type="application/json">${JSON.stringify(DATA).replace(/</g, '\\u003c')}</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const P = D.p;
const src = (t) => !t ? '' : (t.charCodeAt(0) === 0 ? t.slice(1) : P + t);
const fmt = (n) => Number(n).toLocaleString('nl-NL');
const dur = (s) => { if (!s) return ''; const h = s/3600|0, m = (s%3600)/60|0, x = s%60|0;
  return h ? h + ':' + String(m).padStart(2,'0') + ':' + String(x).padStart(2,'0')
           : m + ':' + String(x).padStart(2,'0'); };
const mb = (b) => b ? (b/1048576).toFixed(1).replace('.', ',') + ' MB' : '';
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const list = document.getElementById('list');
const q = document.getElementById('q'), cat = document.getElementById('cat'), st = document.getElementById('st');
const countEl = document.getElementById('count');

// statusfilter per video-rij (opslag én kwaliteit)
function keep(e, s){
  const q = e[10] ? e[10][0] : 0;
  switch (s) {
    case 'have': return !!e[3];
    case 'miss': return !e[3];
    case 'qok': return q === 2;
    case 'qlow': return q === 1;
    case 'qunk': return !!e[3] && q === 0;
    default: return true;
  }
}

// blok-filter: serie → gefilterde eps; video → wel/niet
function filterBlocks(blocks, term, s){
  const out = [];
  for (const b of blocks){
    if (b[0] === 'S'){
      const seriesHit = !term || b[1].toLowerCase().includes(term);
      let eps = b[3].filter(e => keep(e, s));
      if (term && !seriesHit) eps = eps.filter(e => e[0].toLowerCase().includes(term));
      if (eps.length) out.push(['S', b[1], b[2], eps, b[4]]);
    } else {
      const e = b[1];
      if (term && !e[0].toLowerCase().includes(term)) continue;
      if (!keep(e, s)) continue;
      out.push(b);
    }
  }
  return out;
}

function match(){
  const term = q.value.trim().toLowerCase(), c = cat.value, s = st.value;
  const out = [];
  D.c.forEach((C, i) => {
    if (c !== '' && String(i) !== c) return;
    const blocks = filterBlocks(C[1], term, s);
    if (blocks.length) out.push([C[0], blocks, C[2] || '']);
  });
  return out;
}

// kwaliteitsbadge: [status, bron, opgeslagen] → groen / oranje / grijs
function qPill(q){
  if (!q || !q[0]) return q && q[0] === 0 && q[2] ? '' : '<span class="pill q0">kwaliteit nog niet gemeten</span>';
  if (q[0] === 2) return '<span class="pill ok">'+q[2]+'p ✓ bronkwaliteit</span>';
  return '<span class="pill wait">'+q[2]+'p → '+q[1]+'p volgt</span>';
}

function epHtml(e, num){
  const hasDetail = e[8] || (e[9] && e[9].length);
  return '<div class="ep"><span class="num">'+num+'</span>'
    + (e[4] ? '<img loading="lazy" src="'+esc(src(e[4]))+'" alt="">' : '<img alt="">')
    + '<span class="t">'+esc(e[0])+'</span>'
    + '<span class="dur">'+dur(e[1])+'</span>'
    + '<span class="pill '+(e[3]?'ok':'wait')+'">'+(e[3]?'✓ op onze opslag':'◷ nog niet')+'</span>'
    + (e[3] ? qPill(e[10]) : '')
    + (hasDetail ? '<button class="info">ℹ info</button>' : '')
    + (e[5] ? '<button class="play" data-u="'+esc(e[5])+'" data-t="'+esc(e[0])+'">Afspelen</button>'
            : '<button class="play" disabled>Afspelen</button>')
    + (hasDetail ? '<div class="detail">'
        + (e[8] ? '<div>'+esc(e[8])+'</div>' : '')
        + ((e[9]||[]).length ? '<div class="att">📎 Bijlagen:<br>' + e[9].map(r =>
            (r[3] ? '<a href="'+esc(r[3])+'?download='+encodeURIComponent(r[0]+(r[1]?'.'+r[1].toLowerCase():''))+'">'+esc(r[0])+'</a>'
                  : '<span>'+esc(r[0])+' <span class="noord">(veiliggesteld, downloadlink volgt)</span></span>')
            + ' <span class="noord">'+esc(r[1])+(r[2]?' · '+mb(r[2]):'')+'</span>').join('<br>') + '</div>' : '')
      + '</div>' : '')
    + '</div>';
}

function render(){
  const res = match();
  let nEp = 0, nHave = 0;
  for (const [,blocks] of res) for (const b of blocks){
    if (b[0]==='S'){ nEp += b[3].length; nHave += b[3].filter(e=>e[3]).length; }
    else { nEp++; nHave += b[1][3] ? 1 : 0; }
  }
  countEl.textContent = fmt(res.length) + ' categorieën · ' + fmt(nEp) + " video's · " + fmt(nHave) + ' op eigen opslag';
  if (!res.length){ list.innerHTML = '<div class="empty">Niets gevonden.</div>'; return; }

  let html = '';
  res.forEach(([name, blocks, note], ci) => {
    const tot = blocks.reduce((n,b)=> n + (b[0]==='S' ? b[3].length : 1), 0);
    html += '<h2 class="cat">'+esc(name)+' <span class="cnt">'+fmt(blocks.length)+' onderdelen · '+fmt(tot)+" video's</span></h2>";
    if (note) html += '<div class="note">ⓘ '+esc(note)+'</div>';
    blocks.forEach((b, bi) => {
      if (b[0] === 'S'){
        const eps = b[3];
        const have = eps.filter(e=>e[3]).length, mv = eps.filter(e=>e[2]).length;
        const done = mv > 0 && have >= mv;
        html += '<section class="series" data-ci="'+ci+'" data-bi="'+bi+'">'
          + '<div class="shead" role="button" tabindex="0" aria-expanded="false">'
          + (b[2] ? '<img loading="lazy" src="'+esc(src(b[2]))+'" alt="">' : '<img alt="">')
          + '<div class="meta"><div class="t">'+esc(b[1])+'</div>'
          + '<div class="d">serie · '+fmt(eps.length)+' afleveringen</div></div>'
          + '<span class="pill '+(done?'ok':'wait')+'">'+(done?'✓':'◷')+' '+fmt(have)+'/'+fmt(eps.length)+'</span>'
          + '<span class="chev">▸</span></div>'
          + '<div class="eps"></div></section>';
      } else {
        html += '<section class="series solo"><div class="eps" style="display:block;border-top:0">'+epHtml(b[1], '•')+'</div></section>';
      }
    });
  });
  list.innerHTML = html;
  const res2 = res; // sluit huidige filterstand in
  list.querySelectorAll('.series[data-ci]').forEach(el => {
    const ci = +el.dataset.ci, bi = +el.dataset.bi;
    const head = el.querySelector('.shead');
    const open = () => {
      const was = el.classList.contains('open');
      el.classList.toggle('open');
      head.setAttribute('aria-expanded', String(!was));
      el.querySelector('.chev').textContent = was ? '▸' : '▾';
      if (!was && !el.querySelector('.ep')){
        const blk = res2[ci][1][bi];
        el.querySelector('.eps').innerHTML =
          (blk[4] ? '<div class="sdesc">'+esc(blk[4])+'</div>' : '')
          + blk[3].map((e, n) => epHtml(e, e[7] ?? (n+1))).join('');
      }
    };
    head.onclick = open;
    head.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}

document.addEventListener('click', (ev) => {
  const inf = ev.target.closest('.info');
  if (inf){ inf.closest('.ep').classList.toggle('open'); return; }
  const b = ev.target.closest('.play'); if (!b || b.disabled) return;
  pt.textContent = b.dataset.t;
  pb.innerHTML = '<iframe src="'+b.dataset.u+'" allow="encrypted-media;picture-in-picture" allowfullscreen></iframe>';
  dlg.showModal();
});
const dlg = document.getElementById('player'), pb = document.getElementById('pb'), pt = document.getElementById('pt');
document.getElementById('pc').onclick = () => dlg.close();
dlg.addEventListener('close', () => { pb.innerHTML = ''; });

document.getElementById('expand').onclick = () => {
  const all = [...list.querySelectorAll('.series[data-ci]')];
  const opening = !all.every(e => e.classList.contains('open'));
  all.forEach(el => {
    if (opening && !el.classList.contains('open')) el.querySelector('.shead').click();
    else if (!opening && el.classList.contains('open')) el.querySelector('.shead').click();
  });
  document.getElementById('expand').textContent = opening ? 'Alles dichtklappen' : 'Alles openklappen';
};

let t; const deb = () => { clearTimeout(t); t = setTimeout(render, 130); };
q.oninput = deb; cat.onchange = render; st.onchange = render;
render();
</script>
</body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
const sizeMb = (fs.statSync(OUT).size / 1e6).toFixed(1).replace('.', ',');
console.log(`Klaar — ${sizeMb} MB\n  ${OUT}`);
if (!NO_PLAY) console.log(`  Afspeellinks geldig t/m ${expiresStr}`);
if (fallbackCats.length) console.log(`  let op: ${fallbackCats.length} categorie(ën) met vangnet-volgorde: ${fallbackCats.join(', ')}`);
console.log(`\nOpen met:  open "${OUT}"\n`);

// Dekkingscontrole hoort BIJ de build: een bladerversie die stilzwijgend een
// categorie mist, is precies het probleem dat dit script moet uitsluiten.
if (!args.includes('--no-verify')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [path.join(HERE, 'verify-coverage.mjs'), '--showcase', OUT, '--telegram'],
    { stdio: 'inherit' });
  if (r.status !== 0) console.error('LET OP: dekkingscontrole meldt verschillen (zie tabel hierboven).');
}
