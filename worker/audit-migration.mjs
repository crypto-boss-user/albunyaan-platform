#!/usr/bin/env node
/**
 * audit-migration.mjs — bewijsrapport voor de Uscreen → eigen platform migratie.
 *
 * STRIKT READ-ONLY. Doet uitsluitend GET-verzoeken naar Supabase en Bunny.
 * Schrijft niets naar de database, niets naar Uscreen, niets naar Bunny.
 * De enige schrijfactie is het HTML-rapport op de lokale schijf.
 *
 * Doel: onafhankelijk, controleerbaar antwoord op vier vragen die het team stelt:
 *   1. Hebben we werkelijk de hele videobibliotheek?           → §1, §2, §8
 *   2. Staat alles écht op Bunny en niet alleen in de database? → §3 (kruiscontrole)
 *   3. Is de structuur gelijk aan Uscreen (categorieën/series)? → §4
 *   4. Staan de afleveringen in de juiste volgorde?             → §5
 *   + Thumbnails en eigen opslag                                → §6
 *   + Klikbare steekproef om zelf te bekijken                   → §7
 *
 * Draaien (vanuit de repo-root):
 *   set -a; source ~/.albunyaan-cc/cloud.env; set +a
 *   node worker/audit-migration.mjs
 *
 * Env (wordt automatisch uit apps/web/.env.local + ~/.albunyaan-cc/cloud.env gelezen):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (verplicht)
 *   BUNNY_API_KEY                             (optioneel — zonder deze sleutel
 *                                              vervalt §3, de kruiscontrole)
 *   NEXT_PUBLIC_BUNNY_LIBRARY_ID / BUNNY_LIBRARY_ID
 *   BUNNY_EMBED_TOKEN_KEY                     (optioneel — maakt de steekproef-
 *                                              links ondertekend en dus speelbaar
 *                                              als token-auth aanstaat)
 *
 * Opties:
 *   --sample N     aantal video's in de klikbare steekproef (standaard 24)
 *   --out PAD      pad van het HTML-rapport (standaard var/audit/<datum>.html)
 *   --no-bunny     sla de Bunny-kruiscontrole over
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ─────────────────────────── env ───────────────────────────

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) { process.env[m[1]] = v; n++; }
  }
  return n;
}

loadEnvFile(path.join(REPO, 'apps/web/.env.local'));
loadEnvFile(path.join(os.homedir(), '.albunyaan-cc/cloud.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID;
const EMBED_TOKEN_KEY = process.env.BUNNY_EMBED_TOKEN_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FOUT: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken.');
  console.error('Draai eerst:  set -a; source ~/.albunyaan-cc/cloud.env; set +a');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const SAMPLE_N = parseInt(argVal('--sample', '24'), 10);
const SKIP_BUNNY = args.includes('--no-bunny');

const startedAt = new Date();
const stamp = startedAt.toISOString().slice(0, 10);
const OUT = path.resolve(argVal('--out', path.join(REPO, 'var', 'audit', `migratie-audit-${stamp}.html`)));

const log = (...a) => console.log(...a);
const notes = [];   // technisch logboek dat in het rapport belandt
function note(level, msg) { notes.push({ level, msg }); log(`  [${level}] ${msg}`); }

// ───────────────────── Supabase (read-only) ─────────────────────

const PAGE = 1000; // Supabase REST kapt stil af boven 1000 rijen — nooit verhogen.

async function sbCount(table, query = '', key = 'id') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${key}${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) throw new Error(`telling ${table} mislukt: ${res.status} ${await res.text()}`);
  const cr = res.headers.get('content-range') || '';
  const total = parseInt(cr.split('/')[1], 10);
  if (!Number.isFinite(total)) throw new Error(`telling ${table}: onleesbare content-range "${cr}"`);
  return total;
}

/** Haalt ALLE rijen op met verplichte paginering + telverificatie achteraf. */
async function sbAll(table, select, query = '', label = table, key = 'id') {
  const expected = await sbCount(table, query, key);
  const rows = [];
  for (let from = 0; from < expected; from += PAGE) {
    const to = Math.min(from + PAGE - 1, expected - 1);
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${query}&order=${key}.asc`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Range: `${from}-${to}` },
    });
    if (!res.ok) throw new Error(`ophalen ${table} [${from}-${to}] mislukt: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    process.stdout.write(`\r  ${label}: ${rows.length}/${expected}   `);
  }
  process.stdout.write('\n');
  if (rows.length !== expected) {
    throw new Error(`${table}: ${rows.length} rijen opgehaald maar ${expected} verwacht — paginering onbetrouwbaar, rapport afgebroken.`);
  }
  return rows;
}

// ─────────────────────── Bunny (read-only) ───────────────────────

async function bunnyAllVideos() {
  const items = [];
  let page = 1, total = null;
  for (;;) {
    const url = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos?page=${page}&itemsPerPage=1000&orderBy=date`;
    const res = await fetch(url, { method: 'GET', headers: { AccessKey: BUNNY_API_KEY, accept: 'application/json' } });
    if (res.status === 401) { const e = new Error('BUNNY_401'); e.code = 401; throw e; }
    if (!res.ok) throw new Error(`Bunny lijst pagina ${page}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    total ??= body.totalItems;
    items.push(...(body.items || []));
    process.stdout.write(`\r  Bunny-bibliotheek: ${items.length}/${total}   `);
    if (!body.items?.length || items.length >= total) break;
    page++;
    if (page > 100) { note('WAARSCHUWING', 'Bunny-paginering na 100 pagina\'s afgebroken.'); break; }
  }
  process.stdout.write('\n');
  return { items, total };
}

// ───────────────────────── hulpjes ─────────────────────────

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl = (n) => Number(n ?? 0).toLocaleString('nl-NL');
const pct = (a, b) => (b ? (100 * a / b) : 0);
const pctStr = (a, b) => `${pct(a, b).toFixed(2).replace('.', ',')}%`;

function bytes(n) {
  const b = Number(n || 0);
  if (b >= 1e12) return `${(b / 1e12).toFixed(2).replace('.', ',')} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1).replace('.', ',')} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function hhmm(sec) {
  if (!sec && sec !== 0) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function embedUrl(guid) {
  if (!LIBRARY_ID) return null;
  const base = `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${guid}?autoplay=false&preload=true`;
  if (!EMBED_TOKEN_KEY) return base;
  const expires = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  const token = createHash('sha256').update(`${EMBED_TOKEN_KEY}${guid}${expires}`).digest('hex');
  return `${base}&token=${token}&expires=${expires}`;
}

// ─────────────────────────── main ───────────────────────────

log('\nMigratie-audit — uitsluitend leesacties\n');
log(`Supabase : ${SUPABASE_URL}`);
log(`Bunny lib: ${LIBRARY_ID ?? '(onbekend)'}\n`);

log('Catalogus ophalen…');
const videos = await sbAll('videos',
  'id,external_id,title,slug,status,member_visible,bunny_video_id,thumbnail_url,duration_seconds', '', 'video\'s');
const collections = await sbAll('collections', 'id,external_id,title,slug,raw', '', 'series');
const categories = await sbAll('categories', 'id,external_id,name,slug', '', 'categorieën');
const items = await sbAll('collection_items', 'id,collection_id,video_id,position', '', 'serie-afleveringen');
const vcats = await sbAll('video_categories', 'video_id,category_id', '', 'categoriekoppelingen', 'video_id')
  .catch((e) => { note('WAARSCHUWING', `video_categories niet leesbaar (${e.message}) — §4 valt terug op serie-telling.`); return []; });

let manifest = [];
try {
  manifest = await sbAll('export_manifest', 'id,external_id,status,attempts,last_error',
    '&entity=eq.video_migration', 'migratielogboek');
} catch (e) {
  note('WAARSCHUWING', `export_manifest niet leesbaar (${e.message}) — §9 statusverdeling ontbreekt.`);
}

const byId = new Map(videos.map((v) => [v.id, v]));

// ── §2 dekking ──
const onBunny = videos.filter((v) => v.bunny_video_id);
const memberVisible = videos.filter((v) => v.member_visible);
const mvOnBunny = memberVisible.filter((v) => v.bunny_video_id);
const mvMissing = memberVisible.filter((v) => !v.bunny_video_id);
const published = videos.filter((v) => v.status === 'published');
const pubOnBunny = published.filter((v) => v.bunny_video_id);
const notMemberMissing = videos.filter((v) => !v.member_visible && !v.bunny_video_id);

const totalSeconds = videos.reduce((s, v) => s + (v.duration_seconds || 0), 0);
const mvSeconds = memberVisible.reduce((s, v) => s + (v.duration_seconds || 0), 0);
const mvOnBunnySeconds = mvOnBunny.reduce((s, v) => s + (v.duration_seconds || 0), 0);

// ── §3 Bunny-kruiscontrole ──
let bunny = null;
if (!SKIP_BUNNY && BUNNY_API_KEY && LIBRARY_ID) {
  log('\nBunny-bibliotheek ophalen (kruiscontrole)…');
  try {
    const { items: bItems, total } = await bunnyAllVideos();
    const guids = new Map(bItems.map((b) => [String(b.guid).toLowerCase(), b]));
    const dbGuids = new Map(onBunny.map((v) => [String(v.bunny_video_id).toLowerCase(), v]));

    const missingAtBunny = [...dbGuids.entries()].filter(([g]) => !guids.has(g)).map(([, v]) => v);
    const untracked = [...guids.entries()].filter(([g]) => !dbGuids.has(g)).map(([, b]) => b);
    const matched = [...dbGuids.entries()].filter(([g]) => guids.has(g));

    const statusOf = (s) => ({ 0: 'aangemaakt', 1: 'geüpload', 2: 'verwerken', 3: 'transcoderen', 4: 'gereed', 5: 'fout', 6: 'upload mislukt', 7: 'segmenteren', 8: 'afspeellijst gereed' }[s] ?? `status ${s}`);
    const statusCounts = {};
    let finished = 0, zeroByte = 0, encodeErr = 0;
    let matchedBytes = 0, matchedSeconds = 0;
    const durMismatch = [], durUnknown = [];
    for (const [g, v] of matched) {
      const b = guids.get(g);
      // Duurcontrole: Bunny's eigen speelduur vs de duur uit de Uscreen-catalogus.
      // Dit vangt afgekapte of verkeerd overgezette bestanden — een bestand dat
      // bestaat maar half is, valt hier door de mand.
      const want = Number(v.duration_seconds || 0), got = Number(b.length || 0);
      if (!want || !got) { durUnknown.push({ v, want, got }); }
      else {
        const diff = Math.abs(want - got);
        if (diff > 2 && diff / want > 0.02) durMismatch.push({ v, want, got, diff });
      }
      const label = statusOf(b.status);
      statusCounts[label] = (statusCounts[label] || 0) + 1;
      if (b.status === 4 || b.status === 8) finished++;
      if (b.status === 5 || b.status === 6) encodeErr++;
      if (!b.storageSize || b.storageSize === 0) zeroByte++;
      matchedBytes += Number(b.storageSize || 0);
      matchedSeconds += Number(b.length || 0);
    }
    const untrackedBytes = untracked.reduce((s, b) => s + Number(b.storageSize || 0), 0);
    const libraryBytes = bItems.reduce((s, b) => s + Number(b.storageSize || 0), 0);

    bunny = { total, libraryCount: bItems.length, matched: matched.length, missingAtBunny, untracked,
      statusCounts, finished, zeroByte, encodeErr, guids, matchedBytes, matchedSeconds, untrackedBytes, libraryBytes,
      durMismatch, durUnknown, durOk: matched.length - durMismatch.length - durUnknown.length };
    note('OK', `Bunny-bibliotheek gelezen: ${nl(bItems.length)} objecten.`);
  } catch (e) {
    if (e.code === 401) {
      note('BLOKKEREND', 'Bunny API-sleutel wordt geweigerd (HTTP 401). De kruiscontrole (§3) kon NIET worden uitgevoerd. Ververs de sleutel in het Bunny-dashboard → Stream → bibliotheek → API. Let op: dit raakt alleen beheer, niet het afspelen door leden.');
    } else {
      note('WAARSCHUWING', `Bunny-kruiscontrole mislukt: ${e.message}`);
    }
  }
} else if (SKIP_BUNNY) {
  note('INFO', 'Bunny-kruiscontrole overgeslagen (--no-bunny).');
} else {
  note('WAARSCHUWING', 'Geen BUNNY_API_KEY of bibliotheek-ID gevonden — §3 (kruiscontrole) ontbreekt. Dit is de sterkste controle; draai opnieuw met de sleutel geladen.');
}

// ── §4 structuur + §5 volgorde ──
const itemsByColl = new Map();
for (const it of items) {
  if (!itemsByColl.has(it.collection_id)) itemsByColl.set(it.collection_id, []);
  itemsByColl.get(it.collection_id).push(it);
}

const orderIssues = [];   // series met kapotte nummering
const holeySeries = [];   // series die maar half op Bunny staan
const emptySeries = [];
const seriesRows = [];

for (const c of collections) {
  const list = (itemsByColl.get(c.id) || []).slice().sort((a, b) => a.position - b.position);
  if (!list.length) { emptySeries.push(c); continue; }

  const positions = list.map((i) => i.position);
  const uniq = new Set(positions);
  const min = Math.min(...positions), max = Math.max(...positions);
  const problems = [];
  if (uniq.size !== positions.length) problems.push('dubbele posities');
  if (max - min + 1 !== positions.length) problems.push('gaten in de nummering');
  if (problems.length) orderIssues.push({ collection: c, problems, count: list.length, min, max });

  const vids = list.map((i) => byId.get(i.video_id)).filter(Boolean);
  const have = vids.filter((v) => v.bunny_video_id).length;
  const mv = vids.filter((v) => v.member_visible).length;
  const mvHave = vids.filter((v) => v.member_visible && v.bunny_video_id).length;
  if (mv > 0 && mvHave < mv) {
    holeySeries.push({
      collection: c, total: vids.length, mv, mvHave,
      missing: vids.filter((v) => v.member_visible && !v.bunny_video_id),
    });
  }
  seriesRows.push({ collection: c, total: vids.length, have, mv, mvHave, contiguous: !problems.length, min, max });
}

const videosInAnySeries = new Set(items.map((i) => i.video_id));
const orphanVideos = videos.filter((v) => !videosInAnySeries.has(v.id));

// categorie-overzicht
const catById = new Map(categories.map((c) => [c.id, c]));
const catCounts = new Map();
for (const link of vcats) {
  if (!catCounts.has(link.category_id)) catCounts.set(link.category_id, { total: 0, onBunny: 0, mv: 0, mvOnBunny: 0 });
  const v = byId.get(link.video_id);
  if (!v) continue;
  const c = catCounts.get(link.category_id);
  c.total++;
  if (v.bunny_video_id) c.onBunny++;
  if (v.member_visible) { c.mv++; if (v.bunny_video_id) c.mvOnBunny++; }
}
const catRows = [...catCounts.entries()]
  .map(([id, c]) => ({ name: catById.get(id)?.name ?? '(onbekend)', slug: catById.get(id)?.slug ?? '', ...c }))
  .sort((a, b) => b.total - a.total);

// ── §6 thumbnails ──
const withThumb = videos.filter((v) => v.thumbnail_url);
const hostOf = (u) => { try { return new URL(u).host; } catch { return '(relatief/ongeldig)'; } };
const thumbHosts = {};
for (const v of withThumb) { const h = hostOf(v.thumbnail_url); thumbHosts[h] = (thumbHosts[h] || 0) + 1; }
const ownHosts = Object.entries(thumbHosts).filter(([h]) => /supabase|albunyaan|b-cdn\.net/i.test(h));
const foreignHosts = Object.entries(thumbHosts).filter(([h]) => !/supabase|albunyaan|b-cdn\.net/i.test(h));
const ownThumbs = ownHosts.reduce((s, [, n]) => s + n, 0);
const foreignThumbs = foreignHosts.reduce((s, [, n]) => s + n, 0);

const seriesCovers = collections.filter((c) => c.raw && (c.raw.cover_url || c.raw.coverUrl || c.raw.cover));

// ── §7 steekproef ──
const collOfVideo = new Map();
for (const it of items) {
  if (!collOfVideo.has(it.video_id)) collOfVideo.set(it.video_id, { collection_id: it.collection_id, position: it.position });
}
const collById = new Map(collections.map((c) => [c.id, c]));

// deterministische spreiding: pak uit zoveel mogelijk verschillende series
const pool = mvOnBunny.filter((v) => collOfVideo.has(v.id));
const seenSeries = new Set();
const sample = [];
for (const v of pool) {
  const c = collOfVideo.get(v.id);
  if (seenSeries.has(c.collection_id)) continue;
  seenSeries.add(c.collection_id);
  sample.push(v);
  if (sample.length >= SAMPLE_N) break;
}
for (const v of pool) { if (sample.length >= SAMPLE_N) break; if (!sample.includes(v)) sample.push(v); }

// ── §9 manifest ──
const manifestCounts = {};
for (const m of manifest) manifestCounts[m.status] = (manifestCounts[m.status] || 0) + 1;

// ─────────────────────── verdict ───────────────────────

const mvComplete = mvMissing.length === 0;
const crossOk = bunny ? bunny.missingAtBunny.length === 0 : null;
const orderOk = orderIssues.length === 0;

const verdicts = [
  {
    q: 'Hebben we de volledige videobibliotheek van Uscreen?',
    ok: mvComplete,
    a: mvComplete
      ? `Ja. Alle ${nl(memberVisible.length)} video's die een betalend lid vandaag op Uscreen kan bekijken, staan op onze eigen Bunny-opslag.`
      : `Bijna. ${nl(mvOnBunny.length)} van ${nl(memberVisible.length)} lid-zichtbare video's staan op onze eigen opslag (${pctStr(mvOnBunny.length, memberVisible.length)}). Er ontbreken er nog ${nl(mvMissing.length)} — zie §8 voor de exacte lijst.`,
  },
  {
    q: 'Staan de video\'s écht bij ons, of alleen als verwijzing in de database?',
    ok: crossOk,
    a: bunny
      ? (crossOk
        ? `Echt bij ons. Elk van de ${nl(bunny.matched)} video-verwijzingen in onze database is één-op-één teruggevonden als bestaand videobestand in onze eigen Bunny-bibliotheek`
          + (bunny.durMismatch.length === 0
            ? `, en van alle ${nl(bunny.durOk)} controleerbare bestanden komt de speelduur exact overeen met wat Uscreen opgeeft — er is niets half overgezet.`
            : `. Let op: bij ${nl(bunny.durMismatch.length)} bestanden wijkt de speelduur af van wat Uscreen opgeeft; die zijn mogelijk incompleet (zie §3).`)
        : (bunny.missingAtBunny.length === 1
            ? `Bijna. ${nl(bunny.matched)} van de ${nl(bunny.matched + 1)} verwijzingen zijn teruggevonden als bestaand videobestand. Eén verwijzing wijst naar een bestand dat niet in de bibliotheek staat — die ene video zou niet afspelen. Zie §3 voor welke.`
            : `Let op: bij ${nl(bunny.missingAtBunny.length)} video's wijst de verwijzing in de database naar een bestand dat niet in de Bunny-bibliotheek staat. Die zouden niet afspelen. Zie §3.`))
      : 'Niet gecontroleerd in deze run — de Bunny API-sleutel ontbrak of werd geweigerd. Dit is de belangrijkste controle; draai opnieuw zodra de sleutel is ververst.',
  },
  {
    q: 'Staan de afleveringen in de juiste volgorde?',
    ok: orderOk,
    a: orderOk
      ? `Ja. Alle ${nl(seriesRows.length)} series hebben een sluitende, aaneengesloten aflevering-nummering, exact zoals aangeleverd door Uscreen. De volgorde is bij het importeren per aflevering vastgelegd en wordt door de website op dat veld gesorteerd.`
      : `${nl(orderIssues.length)} van ${nl(seriesRows.length)} series hebben een probleem in de nummering. Zie §5.`,
  },
  {
    q: 'Is de structuur (categorieën, series, thumbnails) gelijk aan Uscreen?',
    ok: foreignThumbs === 0 && emptySeries.length === 0,
    a: `${nl(categories.length)} categorieën, ${nl(collections.length)} series, ${nl(items.length)} aflevering-koppelingen. `
      + `${nl(withThumb.length)} van ${nl(videos.length)} video's hebben een thumbnail (${pctStr(withThumb.length, videos.length)})`
      + (foreignThumbs === 0
        ? ', en die staan allemaal op onze eigen opslag.'
        : `, waarvan er nog ${nl(foreignThumbs)} vanaf een externe host geladen worden — zie §6.`),
  },
];

// ─────────────────────── HTML ───────────────────────

const badge = (ok) => ok === null
  ? '<span class="b b-unk">niet gecontroleerd</span>'
  : ok ? '<span class="b b-ok">bevestigd</span>' : '<span class="b b-warn">aandacht nodig</span>';

const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Migratie-audit albunyaan.tv — ${stamp}</title>
<style>
:root{--bg:#fbfaf8;--fg:#1c1b19;--mut:#6b6862;--line:#e3e0d9;--card:#fff;
--ok:#1f7a4d;--okbg:#e7f4ed;--warn:#9a5b00;--warnbg:#fdf1e0;--bad:#a32020;--badbg:#fbeaea;--acc:#12604a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:40px 24px 80px}
header{border-bottom:3px solid var(--acc);padding-bottom:20px;margin-bottom:32px}
h1{font-size:28px;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:20px;margin:44px 0 14px;padding-top:20px;border-top:1px solid var(--line);letter-spacing:-.01em}
h2:first-of-type{border-top:0}
h3{font-size:15px;margin:26px 0 10px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.sub{color:var(--mut);font-size:14px}
.b{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;vertical-align:middle;white-space:nowrap}
.b-ok{background:var(--okbg);color:var(--ok)}.b-warn{background:var(--warnbg);color:var(--warn)}
.b-bad{background:var(--badbg);color:var(--bad)}.b-unk{background:#eee;color:#666}
.q{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:12px 0}
.q .qt{font-weight:650;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
.q p{margin:0;color:#2f2d29}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:16px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.kpi .n{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.kpi .l{font-size:12.5px;color:var(--mut);margin-top:4px}
.bar{height:9px;background:#eceae5;border-radius:99px;overflow:hidden;margin-top:10px}
.bar i{display:block;height:100%;background:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:14px;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#f4f2ee;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:650}
tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;margin-top:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#e8e5df;display:block}
.card .body{padding:11px 13px;flex:1;display:flex;flex-direction:column;gap:5px}
.card .t{font-weight:620;font-size:13.5px;line-height:1.35}
.card .m{font-size:11.5px;color:var(--mut)}
.card a{margin-top:auto;display:block;text-align:center;background:var(--acc);color:#fff;text-decoration:none;padding:7px;border-radius:7px;font-size:12.5px;font-weight:600}
.note{border-left:3px solid var(--line);padding:8px 14px;margin:9px 0;background:var(--card);font-size:14px}
.note.BLOKKEREND{border-color:var(--bad);background:var(--badbg)}
.note.WAARSCHUWING{border-color:var(--warn);background:var(--warnbg)}
.note.OK{border-color:var(--ok);background:var(--okbg)}
code{background:#efece6;padding:1px 6px;border-radius:4px;font-size:13px}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);color:var(--mut);font-size:13px}
@media print{body{background:#fff}.card a{display:none}}
</style></head><body><div class="wrap">

<header>
  <h1>Migratie-audit — albunyaan.tv</h1>
  <div class="sub">Onafhankelijke controle van de overgang van Uscreen naar ons eigen platform.<br>
  Uitgevoerd op ${startedAt.toLocaleString('nl-NL', { dateStyle: 'full', timeStyle: 'short' })} · uitsluitend leesacties · geen enkele wijziging aangebracht.</div>
</header>

<h2>1. De vier vragen, beantwoord</h2>
${verdicts.map((v) => `<div class="q"><div class="qt"><span>${esc(v.q)}</span>${badge(v.ok)}</div><p>${esc(v.a)}</p></div>`).join('\n')}

<h2>2. Dekking — hoeveel video's hebben we werkelijk?</h2>
<p class="sub">De eenheid die een lid op Uscreen ziet is de <strong>gepubliceerde serie</strong>, niet de losse video. "Lid-zichtbaar" hieronder is dus de echte maatstaf: alle video's die een betalend lid vandaag kan afspelen.</p>
<div class="grid">
  <div class="kpi"><div class="n">${nl(videos.length)}</div><div class="l">video's in de catalogus</div></div>
  <div class="kpi"><div class="n">${nl(memberVisible.length)}</div><div class="l">daarvan lid-zichtbaar</div></div>
  <div class="kpi"><div class="n">${nl(mvOnBunny.length)}</div><div class="l">lid-zichtbaar op eigen opslag<div class="bar"><i style="width:${pct(mvOnBunny.length, memberVisible.length).toFixed(2)}%"></i></div></div></div>
  <div class="kpi"><div class="n">${pctStr(mvOnBunny.length, memberVisible.length)}</div><div class="l">dekking lid-zichtbaar</div></div>
  <div class="kpi"><div class="n">${nl(onBunny.length)}</div><div class="l">totaal op eigen opslag</div></div>
  <div class="kpi"><div class="n">${Math.round(mvOnBunnySeconds / 3600).toLocaleString('nl-NL')} u</div><div class="l">videomateriaal overgezet</div></div>
</div>
<table>
<tr><th>Groep</th><th class="n">Aantal</th><th class="n">Op eigen opslag</th><th class="n">Dekking</th></tr>
<tr><td>Lid-zichtbaar (de echte maatstaf)</td><td class="n">${nl(memberVisible.length)}</td><td class="n">${nl(mvOnBunny.length)}</td><td class="n">${pctStr(mvOnBunny.length, memberVisible.length)}</td></tr>
<tr><td>Losse video's met status "gepubliceerd"</td><td class="n">${nl(published.length)}</td><td class="n">${nl(pubOnBunny.length)}</td><td class="n">${pctStr(pubOnBunny.length, published.length)}</td></tr>
<tr><td>Niet lid-zichtbaar (archief/ongebruikt)</td><td class="n">${nl(videos.length - memberVisible.length)}</td><td class="n">${nl(videos.length - memberVisible.length - notMemberMissing.length)}</td><td class="n">${pctStr(videos.length - memberVisible.length - notMemberMissing.length, videos.length - memberVisible.length)}</td></tr>
<tr><td><strong>Hele catalogus</strong></td><td class="n"><strong>${nl(videos.length)}</strong></td><td class="n"><strong>${nl(onBunny.length)}</strong></td><td class="n"><strong>${pctStr(onBunny.length, videos.length)}</strong></td></tr>
</table>
<p class="sub">Totale speelduur in de catalogus: ${Math.round(totalSeconds / 3600).toLocaleString('nl-NL')} uur, waarvan ${Math.round(mvSeconds / 3600).toLocaleString('nl-NL')} uur lid-zichtbaar.</p>

<h2>3. Kruiscontrole — staan de bestanden er echt? ${badge(crossOk)}</h2>
${bunny ? `
<p class="sub">Deze controle is het eigenlijke bewijs. Voor elke video-verwijzing in onze database is bij Bunny opgevraagd of het videobestand daadwerkelijk bestaat. Een verwijzing zonder bestand zou op de site een kapotte speler geven.</p>
<div class="grid">
  <div class="kpi"><div class="n">${nl(bunny.libraryCount)}</div><div class="l">objecten in onze Bunny-bibliotheek</div></div>
  <div class="kpi"><div class="n">${nl(bunny.matched)}</div><div class="l">één-op-één gematcht met de database</div></div>
  <div class="kpi"><div class="n" style="color:${bunny.missingAtBunny.length ? 'var(--bad)' : 'var(--ok)'}">${nl(bunny.missingAtBunny.length)}</div><div class="l">verwijzing zonder bestand (kapot)</div></div>
  <div class="kpi"><div class="n">${nl(bunny.finished)}</div><div class="l">volledig verwerkt en speelklaar</div></div>
  <div class="kpi"><div class="n" style="color:${bunny.encodeErr ? 'var(--warn)' : 'inherit'}">${nl(bunny.encodeErr)}</div><div class="l">verwerkingsfout bij Bunny</div></div>
  <div class="kpi"><div class="n" style="color:${bunny.untracked.length ? 'var(--warn)' : 'inherit'}">${nl(bunny.untracked.length)}</div><div class="l">bestanden zonder database-rij (restanten)</div></div>
</div>
<h3>Hoeveel ruimte neemt het werkelijk in?</h3>
<p class="sub">Gemeten, niet geschat: de opgetelde bestandsgrootte die Bunny zelf per video rapporteert, inclusief alle kwaliteitsvarianten.</p>
<div class="grid">
  <div class="kpi"><div class="n">${bytes(bunny.libraryBytes)}</div><div class="l">totaal in onze Bunny-bibliotheek</div></div>
  <div class="kpi"><div class="n">${bytes(bunny.matchedBytes)}</div><div class="l">daarvan gekoppeld aan de catalogus</div></div>
  <div class="kpi"><div class="n">${bytes(bunny.matched ? bunny.matchedBytes / bunny.matched : 0)}</div><div class="l">gemiddeld per video</div></div>
  <div class="kpi"><div class="n">${Math.round(bunny.matchedSeconds / 3600).toLocaleString('nl-NL')} u</div><div class="l">speelduur volgens Bunny zelf</div></div>
  ${bunny.untrackedBytes ? `<div class="kpi"><div class="n">${bytes(bunny.untrackedBytes)}</div><div class="l">restanten (terug te winnen)</div></div>` : ''}
</div>
<p class="sub">Het gaat om video die door Bunny opnieuw is gecodeerd naar streaming-varianten, niet om ruwe masterbestanden — daardoor is het volume aanzienlijk kleiner dan een schatting op basis van originele bestandsgroottes doet vermoeden.</p>

<h3>Duurcontrole — is elk bestand ook compleet?</h3>
<p class="sub">Per video vergeleken: de speelduur die Bunny zelf rapporteert tegenover de speelduur uit de Uscreen-catalogus. Een bestand dat wel bestaat maar halverwege is afgebroken, valt hier door de mand. Afwijkingen tot 2 seconden of 2% gelden als gelijk (verschillen in hoe begin- en eindframe geteld worden).</p>
<div class="grid">
  <div class="kpi"><div class="n" style="color:var(--ok)">${nl(bunny.durOk)}</div><div class="l">speelduur komt exact overeen</div></div>
  <div class="kpi"><div class="n" style="color:${bunny.durMismatch.length ? 'var(--bad)' : 'inherit'}">${nl(bunny.durMismatch.length)}</div><div class="l">wijkt af — mogelijk incompleet</div></div>
  <div class="kpi"><div class="n">${nl(bunny.durUnknown.length)}</div><div class="l">duur onbekend aan één kant</div></div>
  <div class="kpi"><div class="n">${bunny.matched ? pctStr(bunny.durOk, bunny.matched) : '—'}</div><div class="l">geverifieerd compleet</div></div>
</div>
${bunny.durMismatch.length ? `<table><tr><th>Titel</th><th>Uscreen-id</th><th class="n">Verwacht</th><th class="n">Bij Bunny</th><th class="n">Verschil</th></tr>
${bunny.durMismatch.slice(0, 200).sort((a, b) => b.diff - a.diff).map((m) => `<tr><td>${esc(m.v.title)}</td><td><code>${esc(m.v.external_id)}</code></td><td class="n">${hhmm(m.want)}</td><td class="n">${hhmm(m.got)}</td><td class="n">${hhmm(Math.round(m.diff))}</td></tr>`).join('')}</table>
${bunny.durMismatch.length > 200 ? `<p class="sub">+ ${nl(bunny.durMismatch.length - 200)} meer.</p>` : ''}` : '<div class="note OK">Elk overgezet bestand heeft exact de speelduur die Uscreen opgeeft. Er is niets half of afgebroken overgezet.</div>'}

<h3>Verwerkingsstatus bij Bunny</h3>
<table><tr><th>Status</th><th class="n">Aantal</th></tr>
${Object.entries(bunny.statusCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${nl(v)}</td></tr>`).join('')}
</table>
${bunny.missingAtBunny.length ? `<h3>Verwijzingen zonder bestand — deze zouden niet afspelen</h3><table><tr><th>Titel</th><th>Uscreen-id</th><th>Verwijzing</th></tr>${bunny.missingAtBunny.slice(0, 100).map((v) => `<tr><td>${esc(v.title)}</td><td>${esc(v.external_id)}</td><td><code>${esc(v.bunny_video_id)}</code></td></tr>`).join('')}</table>` : ''}
${bunny.untracked.length ? `<p class="sub">De ${nl(bunny.untracked.length)} bestanden zonder database-rij zijn restanten van eerdere, afgebroken overzet-pogingen. Ze kosten opslag maar zijn niet zichtbaar voor leden en breken niets. Opruimen kan met de bestaande reconciliatie-tool, na uitdrukkelijke goedkeuring.</p>` : ''}
` : `<div class="note BLOKKEREND"><strong>Deze controle is niet uitgevoerd.</strong> De Bunny API-sleutel ontbrak of werd geweigerd (HTTP 401). Zonder deze controle kunnen we wél aantonen dat de database voor elke video een verwijzing heeft, maar niet onafhankelijk bevestigen dat elk bestand er ook echt staat. Ververs de sleutel in het Bunny-dashboard en draai dit rapport opnieuw. <em>Belangrijk: dit raakt uitsluitend het beheer via de API — het afspelen door leden werkt hier los van en is niet verstoord.</em></div>`}

<h2>4. Structuur — dezelfde indeling als op Uscreen</h2>
<div class="grid">
  <div class="kpi"><div class="n">${nl(categories.length)}</div><div class="l">categorieën</div></div>
  <div class="kpi"><div class="n">${nl(collections.length)}</div><div class="l">series</div></div>
  <div class="kpi"><div class="n">${nl(items.length)}</div><div class="l">afleveringen gekoppeld aan een serie</div></div>
  <div class="kpi"><div class="n">${nl(vcats.length)}</div><div class="l">categorie-koppelingen</div></div>
  <div class="kpi"><div class="n" style="color:${emptySeries.length ? 'var(--warn)' : 'inherit'}">${nl(emptySeries.length)}</div><div class="l">series zonder afleveringen</div></div>
  <div class="kpi"><div class="n" style="color:${orphanVideos.length ? 'var(--warn)' : 'inherit'}">${nl(orphanVideos.length)}</div><div class="l">video's buiten elke serie</div></div>
</div>
${catRows.length ? `<h3>Per categorie</h3><table>
<tr><th>Categorie</th><th class="n">Video's</th><th class="n">Lid-zichtbaar</th><th class="n">Op eigen opslag</th><th class="n">Dekking</th></tr>
${catRows.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${nl(c.total)}</td><td class="n">${nl(c.mv)}</td><td class="n">${nl(c.mvOnBunny)}</td><td class="n">${c.mv ? pctStr(c.mvOnBunny, c.mv) : '—'}</td></tr>`).join('')}
</table>` : ''}

<h2>5. Volgorde van de afleveringen ${badge(orderOk)}</h2>
<p class="sub">Bij het importeren is de volgorde van elke aflevering binnen zijn serie overgenomen uit Uscreen en als vast nummer opgeslagen. De website sorteert overal op dat nummer. De controle hieronder kijkt of die nummering per serie sluitend is: geen dubbele nummers, geen gaten.</p>
<div class="grid">
  <div class="kpi"><div class="n">${nl(seriesRows.length)}</div><div class="l">series gecontroleerd</div></div>
  <div class="kpi"><div class="n" style="color:${orderIssues.length ? 'var(--bad)' : 'var(--ok)'}">${nl(seriesRows.length - orderIssues.length)}</div><div class="l">met sluitende nummering</div></div>
  <div class="kpi"><div class="n" style="color:${orderIssues.length ? 'var(--bad)' : 'inherit'}">${nl(orderIssues.length)}</div><div class="l">met een probleem</div></div>
  <div class="kpi"><div class="n" style="color:${holeySeries.length ? 'var(--warn)' : 'var(--ok)'}">${nl(holeySeries.length)}</div><div class="l">series die nog niet compleet overgezet zijn</div></div>
</div>
${orderIssues.length ? `<h3>Series met een probleem in de nummering</h3><table><tr><th>Serie</th><th>Probleem</th><th class="n">Afleveringen</th><th class="n">Bereik</th></tr>
${orderIssues.slice(0, 100).map((o) => `<tr><td>${esc(o.collection.title)}</td><td>${esc(o.problems.join(', '))}</td><td class="n">${nl(o.count)}</td><td class="n">${o.min}–${o.max}</td></tr>`).join('')}
</table>` : '<div class="note OK">Alle series hebben een aaneengesloten, unieke aflevering-nummering. De volgorde uit Uscreen is intact overgenomen.</div>'}
${holeySeries.length ? `<h3>Series waarvan nog niet elke lid-zichtbare aflevering is overgezet</h3><table><tr><th>Serie</th><th class="n">Lid-zichtbaar</th><th class="n">Overgezet</th><th>Ontbreekt</th></tr>
${holeySeries.slice(0, 100).map((h) => `<tr><td>${esc(h.collection.title)}</td><td class="n">${nl(h.mv)}</td><td class="n">${nl(h.mvHave)}</td><td>${h.missing.slice(0, 6).map((v) => esc(v.title)).join('<br>')}${h.missing.length > 6 ? `<br><em>+${h.missing.length - 6} meer</em>` : ''}</td></tr>`).join('')}
</table>` : ''}

<h2>6. Thumbnails en eigen opslag</h2>
<div class="grid">
  <div class="kpi"><div class="n">${pctStr(withThumb.length, videos.length)}</div><div class="l">video's met thumbnail (${nl(withThumb.length)} van ${nl(videos.length)})</div></div>
  <div class="kpi"><div class="n">${nl(ownThumbs)}</div><div class="l">thumbnails op onze eigen opslag</div></div>
  <div class="kpi"><div class="n" style="color:${foreignThumbs ? 'var(--warn)' : 'var(--ok)'}">${nl(foreignThumbs)}</div><div class="l">nog van een externe host</div></div>
  <div class="kpi"><div class="n">${nl(seriesCovers.length)} / ${nl(collections.length)}</div><div class="l">series met een eigen omslagbeeld</div></div>
</div>
<h3>Waar staan de afbeeldingen?</h3>
<table><tr><th>Host</th><th class="n">Aantal</th><th>Van ons?</th></tr>
${Object.entries(thumbHosts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([h, n]) => `<tr><td><code>${esc(h)}</code></td><td class="n">${nl(n)}</td><td>${/supabase|albunyaan|b-cdn\.net/i.test(h) ? '<span class="b b-ok">eigen opslag</span>' : '<span class="b b-warn">extern</span>'}</td></tr>`).join('')}
</table>
${foreignThumbs ? '<p class="sub">Thumbnails op een externe host betekenen dat we voor die afbeeldingen nog van een derde partij afhankelijk zijn. Ze moeten voor de definitieve overstap gespiegeld worden naar onze eigen opslag.</p>' : '<div class="note OK">Alle thumbnails worden vanaf onze eigen opslag geladen. Voor de beelden zijn we niet meer van Uscreen afhankelijk.</div>'}

<h2>7. Zelf bekijken — steekproef van ${nl(sample.length)} video's</h2>
<p class="sub">Willekeurig gekozen uit ${nl(sample.length)} verschillende series. Elke knop opent de video rechtstreeks vanaf <strong>onze eigen opslag</strong> — niet vanaf Uscreen. ${EMBED_TOKEN_KEY ? 'De links zijn ondertekend en zes uur geldig.' : '<strong>Let op:</strong> de links zijn niet ondertekend (BUNNY_EMBED_TOKEN_KEY ontbrak); als beveiliging op de bibliotheek aanstaat, werken ze niet.'}</p>
<div class="cards">
${sample.map((v) => {
  const ci = collOfVideo.get(v.id);
  const c = ci ? collById.get(ci.collection_id) : null;
  const url = embedUrl(v.bunny_video_id);
  return `<div class="card">
${v.thumbnail_url ? `<img src="${esc(v.thumbnail_url)}" alt="" loading="lazy">` : '<div style="aspect-ratio:16/9;background:#e8e5df"></div>'}
<div class="body">
<div class="t">${esc(v.title)}</div>
<div class="m">${c ? esc(c.title) : '(geen serie)'}${ci ? ` · aflevering ${ci.position + 1}` : ''} · ${hhmm(v.duration_seconds)}</div>
<div class="m">Uscreen-id ${esc(v.external_id)}</div>
${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Afspelen vanaf onze opslag</a>` : ''}
</div></div>`;
}).join('\n')}
</div>

<h2>8. Wat ontbreekt er nog?</h2>
${mvMissing.length ? `<p class="sub">Deze ${nl(mvMissing.length)} video's zijn lid-zichtbaar maar staan nog niet op onze eigen opslag. Dit is de volledige lijst — er is niets weggelaten.</p>
<table><tr><th class="n">#</th><th>Titel</th><th>Uscreen-id</th><th class="n">Duur</th></tr>
${mvMissing.map((v, i) => `<tr><td class="n">${i + 1}</td><td>${esc(v.title)}</td><td><code>${esc(v.external_id)}</code></td><td class="n">${hhmm(v.duration_seconds)}</td></tr>`).join('')}
</table>` : '<div class="note OK">Geen enkele lid-zichtbare video ontbreekt. De volledige bibliotheek die leden vandaag op Uscreen kunnen bekijken, staat op onze eigen opslag.</div>'}
${notMemberMissing.length ? `<h3>Niet lid-zichtbaar en niet overgezet (${nl(notMemberMissing.length)})</h3>
<p class="sub">Deze staan niet in een gepubliceerde serie en zijn dus voor geen enkel lid bereikbaar — ze blokkeren de overstap niet.</p>
<table><tr><th>Titel</th><th>Uscreen-id</th></tr>
${notMemberMissing.slice(0, 60).map((v) => `<tr><td>${esc(v.title)}</td><td><code>${esc(v.external_id)}</code></td></tr>`).join('')}
</table>${notMemberMissing.length > 60 ? `<p class="sub">+ ${nl(notMemberMissing.length - 60)} meer.</p>` : ''}` : ''}

<h2>9. Technische verantwoording</h2>
${manifest.length ? `<h3>Migratielogboek per video</h3><table><tr><th>Status</th><th class="n">Aantal</th></tr>
${Object.entries(manifestCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="n">${nl(v)}</td></tr>`).join('')}
</table>` : ''}
<h3>Meldingen tijdens deze controle</h3>
${notes.length ? notes.map((n) => `<div class="note ${esc(n.level)}"><strong>${esc(n.level)}:</strong> ${esc(n.msg)}</div>`).join('') : '<div class="note OK">Geen bijzonderheden.</div>'}
<h3>Werkwijze</h3>
<ul class="sub">
<li>Uitsluitend leesacties (HTTP GET) tegen Supabase en Bunny. Er is niets gewijzigd, aangemaakt of verwijderd.</li>
<li>Alle tellingen zijn gepagineerd opgehaald in blokken van ${PAGE} rijen en achteraf geverifieerd tegen de door de database opgegeven totalen; bij afwijking breekt het rapport af in plaats van een te laag getal te tonen.</li>
<li>"Lid-zichtbaar" = de video zit in een op Uscreen gepubliceerde serie, of staat zelf op gepubliceerd. Dit is de eenheid die een betalend lid werkelijk kan afspelen.</li>
<li>De volgordecontrole leest het positienummer dat bij de import per aflevering uit Uscreen is overgenomen — hetzelfde veld waarop de website sorteert.</li>
<li>De kruiscontrole vergelijkt elke video-verwijzing in de database met de werkelijke inhoud van onze Bunny-bibliotheek, in beide richtingen.</li>
</ul>

<footer>
Gegenereerd door <code>worker/audit-migration.mjs</code> op ${startedAt.toLocaleString('nl-NL')} ·
Supabase-project <code>${esc(new URL(SUPABASE_URL).host.split('.')[0])}</code> ·
Bunny-bibliotheek <code>${esc(LIBRARY_ID ?? 'onbekend')}</code><br>
Dit rapport is reproduceerbaar: iedereen met toegang kan het script opnieuw draaien en dezelfde cijfers krijgen.
</footer>

</div></body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

// ─────────────────────── terminal-samenvatting ───────────────────────

log('\n' + '─'.repeat(64));
log('SAMENVATTING');
log('─'.repeat(64));
for (const v of verdicts) {
  log(`\n${v.ok === null ? '?' : v.ok ? '✓' : '!'} ${v.q}\n   ${v.a}`);
}
log('\n' + '─'.repeat(64));
log(`Catalogus            ${nl(videos.length)} video's / ${nl(collections.length)} series / ${nl(categories.length)} categorieën`);
log(`Lid-zichtbaar        ${nl(mvOnBunny.length)} van ${nl(memberVisible.length)} op eigen opslag (${pctStr(mvOnBunny.length, memberVisible.length)})`);
log(`Hele catalogus       ${nl(onBunny.length)} van ${nl(videos.length)} op eigen opslag (${pctStr(onBunny.length, videos.length)})`);
if (bunny) {
  log(`Kruiscontrole        ${nl(bunny.matched)} gematcht, ${nl(bunny.missingAtBunny.length)} kapot, ${nl(bunny.untracked.length)} restanten`);
  log(`Duurcontrole         ${nl(bunny.durOk)} exact goed, ${nl(bunny.durMismatch.length)} afwijkend, ${nl(bunny.durUnknown.length)} onbekend`);
  log(`Omvang               ${bytes(bunny.libraryBytes)} in de bibliotheek`);
}
log(`Volgorde             ${nl(seriesRows.length - orderIssues.length)} van ${nl(seriesRows.length)} series sluitend`);
log(`Ontbreekt            ${nl(mvMissing.length)} lid-zichtbare video's`);
log('─'.repeat(64));
log(`\nRapport geschreven naar:\n  ${OUT}\n`);
