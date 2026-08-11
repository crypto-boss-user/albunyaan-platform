/**
 * archive-request-links.mjs — Mac-kant van het NAS-originelenarchief
 * (teambesluit 2026-08-10; plan: ~/.claude/plans/groovy-hatching-patterson.md).
 *
 * Vraagt per video het ONAANGERAASTE bronbestand aan bij Uscreen ("Request
 * download") en bouwt wachtrijbestanden die de NAS afwerkt met archive-fetch.sh.
 * Alles loopt via de bullet_api in de twin Chrome (gesnifft 2026-08-10):
 *   1. POST /bullet_api/v1/videos.request_download {"id":N}  -> {"ok":true}
 *   2. poll POST /bullet_api/v1/videos.details {"id":N}      -> video.master_url
 *      (mezzanine.mux.com-link; prep duurt ~2-15 min, link 24 uur geldig)
 *   3. HEAD op master_url -> exacte bytes + originele bestandsnaam
 *
 * Pipelining: PREP_AHEAD preps staan tegelijk uit (de prep is server-side werk
 * bij Uscreen/Mux; het pollen zelf is een goedkope ~100ms-call). Sequentieel
 * mét politeness-delays — de hCaptcha-lessen van de harvest gelden onverkort.
 *
 * Wachtrijregel (JSONL, gelezen door archive-fetch.sh op de NAS):
 *   {"kind":"video","id":"...","title":"...","url":"...","filename":"...",
 *    "dest":"01 - Categorie/03 - Serie/05 - Titel.mp4","also_in":"…",
 *    "expected_bytes":N,"requested_at":"...","ready_at":"..."}
 * dest = het doorbladerbare archiefpad (teambesluit 2026-08-11) uit
 * structuur.jsonl; filename = de originele Uscreen-bestandsnaam (gaat als
 * "orig" het manifest in); also_in = andere platform-plekken van deze video
 * (dedup: één kopie, niets verliest informatie). dest/also_in zijn
 * gesaneerd (geen aanhalingstekens) zodat de sed-parser op de NAS ze aankan.
 *
 * Draaien (vanuit worker/):
 *   node archive-request-links.mjs --limit 20        # tempo-test
 *   node archive-request-links.mjs                   # volledige run (NA akkoord!)
 *   opties: --batch N (default 50: wachtrij-flush + scp naar NAS per N items)
 *
 * Hervatbaar: ids in het NAS-manifest (done/) of in een eerder wachtrijbestand
 * worden overgeslagen. Fail-honest: elke weigering/timeout met reden in
 * ~/.albunyaan-cc/archief/fouten-mac.log — nooit stilzwijgend overslaan.
 * Sessieverlies -> nette stop met "USCREEN SESSION DEAD" (zelfde contract als
 * harvest-video-extras.mjs).
 */
import { chromium } from 'playwright';
// spawnSync is hier OK: bewust sequentieel script zonder parallelle workers
// (de spawnSync-regel uit 9623f97 gaat over event-loop-blokkade in parallel
// transfercode; een blokkerende scp tussen batches is hier juist gewenst).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const ERRLOG = path.join(OUTDIR, 'fouten-mac.log');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const NAS_QUEUE = '/volume1/Albunyaan/archief-originelen/_queue';
const NAS_DONE = '/volume1/Albunyaan/archief-originelen/done';

const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = parseInt(argVal('--limit', '0'), 10) || Infinity;
const BATCH = parseInt(argVal('--batch', '50'), 10);
const PREP_AHEAD = 5;          // zoveel preps tegelijk uitstaand
const POLL_EVERY_MS = 20_000;  // per uitstaande prep 1 details-poll per rondje
const POLITENESS_MS = 1_800;   // tussen alle admin-API-calls (hCaptcha-les)
const PREP_TIMEOUT_MS = 30 * 60_000; // prep die na 30 min niet klaar is = fout

const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUTDIR, { recursive: true });
const logErr = (msg) => { console.error(`[${ts()}] ${msg}`); fs.appendFileSync(ERRLOG, `${new Date().toISOString()} ${msg}\n`); };

// ── bronlijst: alle video-ids, member-first (zelfde prioriteit als transfers) ──
function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
// member_visible leeft in Supabase (migratie 0012), niet in de jsonl-oogst.
// Gepagineerd ophalen (REST clampt op 1000 rijen, SILENTLY — vaste les).
async function memberVisibleIds() {
  for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) { console.log('let op: geen Supabase-env — member-first-volgorde overgeslagen'); return new Set(); }
  const out = new Set();
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_}/rest/v1/videos?member_visible=eq.true&select=external_id&order=external_id.asc`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) { console.log(`let op: member_visible-query ${res.status} — member-first-volgorde overgeslagen`); return out; }
    const rows = await res.json();
    for (const r of rows) out.add(String(r.external_id));
    if (rows.length < 1000) break;
  }
  return out;
}
const memberIds = await memberVisibleIds();
// VOLLEDIGE enumeratie = uscreen-video-details.jsonl (15.972 rijen, de
// extras-harvest). uscreen-video-ids.jsonl is een deel-oogst (1.944, alleen de
// na-juli-enumeratie) — te weinig als bronlijst (live ondervonden 2026-08-10).
const idSet = new Set();
for (const r of readJsonl(path.join(CC, 'uscreen-video-details.jsonl'))) idSet.add(String(r.id));
for (const r of readJsonl(path.join(CC, 'uscreen-video-ids.jsonl'))) idSet.add(String(r.id));
const allIds = [...idSet];
const titles = new Map(readJsonl(path.join(CC, 'uscreen-videos-rich.jsonl')).map((r) => [String(r.id), r.title ?? '']));

// ── archiefstructuur (teambesluit 2026-08-11): elke video krijgt een menselijk
// doorbladerbaar pad (categorie/serie/titel, platform-volgorde) uit
// structuur.jsonl, gegenereerd door archive-structure.mjs. Zonder die toewijzing
// draaien zou alles in het oude technische schema (video/<id>/) zetten — hard stoppen.
const STRUCT = new Map();
for (const r of readJsonl(path.join(OUTDIR, 'structuur.jsonl'))) STRUCT.set(String(r.id), r);
if (!STRUCT.size) {
  console.error('structuur.jsonl ontbreekt in ~/.albunyaan-cc/archief/ — draai eerst: node archive-structure.mjs');
  process.exit(1);
}
// minimale naam-hygiëne voor de zeldzame terugval (id niet in structuur.jsonl)
const sanFallback = (s) => (String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '') || 'zonder titel');
const ordered = [
  ...allIds.filter((id) => memberIds.has(id)),
  ...allIds.filter((id) => !memberIds.has(id)),
];

// ── al gedaan? done-markers van de NAS ophalen (hervatbaarheid) ──
function nasDoneSet() {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `ls ${NAS_DONE} 2>/dev/null`], { encoding: 'utf8' });
  if (r.status !== 0) { console.log(`[${ts()}] let op: kon NAS done/ niet lezen (${(r.stderr || '').trim().slice(0, 80)}) — ga uit van leeg`); return new Set(); }
  const s = new Set();
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^video-(\d+)-/);
    if (m) s.add(m[1]);
  }
  return s;
}
// plus: ids die al in een eerder lokaal wachtrijbestand zitten
const queuedBefore = new Set();
for (const f of fs.existsSync(OUTDIR) ? fs.readdirSync(OUTDIR) : []) {
  if (!f.startsWith('queue-video-') || !f.endsWith('.jsonl')) continue;
  for (const r of readJsonl(path.join(OUTDIR, f))) queuedBefore.add(String(r.id));
}

const done = nasDoneSet();
const todo = ordered.filter((id) => !done.has(id) && !queuedBefore.has(id)).slice(0, LIMIT);
console.log(`[${ts()}] ${allIds.length} video's totaal · ${done.size} al op NAS · ${queuedBefore.size} al in wachtrij · ${todo.length} te doen deze run`);
if (!todo.length) { console.log('Niets te doen.'); process.exit(0); }

// ── browser ──
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url() === 'about:blank')
  ?? ctx.pages().find((p) => p.url().includes('app.uscreen.tv'))
  ?? (await ctx.newPage());
if (!page.url().includes('app.uscreen.tv')) {
  await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
}
if (page.url().includes('login')) { logErr('USCREEN SESSION DEAD — opnieuw inloggen in de twin Chrome en herstarten.'); process.exit(2); }

/** bullet_api-call met retry + sessie-check (patroon uit harvest-video-extras.mjs). */
async function api(endpoint, body, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await page.evaluate(async ({ endpoint, body }) => {
        const res = await fetch(`/bullet_api/v1/${endpoint}`, {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401 || res.status === 403 || res.redirected) return { __auth: res.status };
        if (!res.ok) return { __err: res.status };
        return res.json();
      }, { endpoint, body });
    } catch (e) {
      if (attempt >= tries) throw e;
      await sleep(2000);
      if (!page.url().includes('app.uscreen.tv')) {
        await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        if (page.url().includes('login')) throw new Error('USCREEN SESSION DEAD');
      }
    }
  }
}

/** HEAD op de mezzanine-URL: exacte bytes + bestandsnaam uit Content-Disposition.
 * TWEE keer, 15 s uit elkaar, en pas akkoord als de lengte gelijk blijft: bij
 * snel-geprepte video's groeit het bronbestand nog even ná het verschijnen van
 * de URL (2026-08-10: eerste HEAD zei 114 MB, werkelijk werd het 125 MB). */
async function headOnce(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) return null;
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename="([^"]+)"/);
  return { bytes: len || null, filename: m ? m[1] : null };
}
async function headInfo(url) {
  const a = await headOnce(url);
  if (!a?.bytes) return a;
  await sleep(15_000);
  const b = await headOnce(url);
  if (b?.bytes === a.bytes) return b;
  // nog aan het groeien: derde meting na een langere pauze als eindoordeel
  await sleep(30_000);
  return await headOnce(url) ?? b ?? a;
}

// ── hoofdlus: PREP_AHEAD uitstaande preps, poll, schrijf wachtrij ──
const stats = { ok: 0, fail: 0, prepMs: [] };
let queue = [];
let batchNr = Date.now();

function flushQueue(force = false) {
  if (!queue.length || (!force && queue.length < BATCH)) return;
  const name = `queue-video-${batchNr}.jsonl`;
  const local = path.join(OUTDIR, name);
  fs.writeFileSync(local, queue.map((r) => JSON.stringify(r)).join('\n') + '\n');
  // -O = legacy scp-protocol: Synology's SFTP-subsysteem ziet een ander
  // padstelsel (chroot) waardoor moderne scp "No such file or directory" geeft
  // op paden die via ssh gewoon bestaan — ondervonden 2026-08-10.
  const scp = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:${NAS_QUEUE}/${name}`], { encoding: 'utf8' });
  if (scp.status === 0) {
    console.log(`[${ts()}] wachtrij ${name} (${queue.length} items) → NAS`);
  } else {
    logErr(`SCP MISLUKT voor ${name}: ${(scp.stderr || '').trim().slice(0, 120)} — bestand staat lokaal klaar, handmatig kopiëren of script herstarten`);
  }
  queue = [];
  batchNr = Date.now();
}

const pending = new Map(); // id -> { requestedAt }
let cursor = 0;

while (cursor < todo.length || pending.size) {
  // vul aan tot PREP_AHEAD uitstaande preps
  while (pending.size < PREP_AHEAD && cursor < todo.length) {
    const id = todo[cursor++];
    const r = await api('videos.request_download', { id: Number(id) });
    await sleep(POLITENESS_MS);
    if (r?.__auth) { logErr('USCREEN SESSION DEAD — stop.'); flushQueue(true); process.exit(2); }
    if (r?.ok) {
      pending.set(id, { requestedAt: Date.now() });
      console.log(`[${ts()}] prep aangevraagd: ${id} ${String(titles.get(id) ?? '').slice(0, 40)} (${pending.size} uitstaand, ${todo.length - cursor} te gaan)`);
    } else {
      stats.fail++;
      logErr(`PREP GEWEIGERD ${id}: ${JSON.stringify(r).slice(0, 120)}`);
    }
  }

  // poll de uitstaande preps
  for (const [id, info] of [...pending]) {
    const d = await api('videos.details', { id: Number(id) });
    await sleep(POLITENESS_MS);
    if (d?.__auth) { logErr('USCREEN SESSION DEAD — stop.'); flushQueue(true); process.exit(2); }
    // master_url doorloopt stadia: null -> letterlijk "preparing" -> echte URL
    // (live gezien 2026-08-10). Alleen een échte URL telt als klaar.
    const url = d?.video?.master_url;
    if (url && /^https?:/.test(url)) {
      const prepMs = Date.now() - info.requestedAt;
      const h = await headInfo(url).catch(() => null);
      const filename = h?.filename ?? `${id}.mp4`;
      // archiefpad: structuurbasis + échte extensie van het originele bestand
      const st = STRUCT.get(String(id));
      if (!st) logErr(`GEEN STRUCTUURPLEK voor ${id} — terugval op "99 - Buiten categorieën" (structuur.jsonl verouderd?)`);
      const ext = (filename.match(/\.[A-Za-z0-9]{2,5}$/) || ['.mp4'])[0];
      const destBase = st?.dest ?? `99 - Buiten categorieën/${sanFallback(titles.get(id))} (${id})`;
      queue.push({
        kind: 'video', id, title: String(titles.get(id) ?? ''),
        url, filename, dest: `${destBase}${ext}`, also_in: (st?.ook_in ?? []).join(' | '),
        expected_bytes: h?.bytes ?? null,
        requested_at: new Date(info.requestedAt).toISOString(), ready_at: new Date().toISOString(),
      });
      pending.delete(id);
      stats.ok++; stats.prepMs.push(prepMs);
      console.log(`[${ts()}] KLAAR ${id}: ${h?.filename ?? '?'} ${h?.bytes ?? '?'} bytes (prep ${(prepMs / 60000).toFixed(1)} min) — ${stats.ok} gereed`);
      flushQueue();
    } else if (Date.now() - info.requestedAt > PREP_TIMEOUT_MS) {
      pending.delete(id);
      stats.fail++;
      logErr(`PREP TIMEOUT ${id}: na ${PREP_TIMEOUT_MS / 60000} min nog geen master_url`);
    }
  }
  if (pending.size) await sleep(POLL_EVERY_MS);
}

flushQueue(true);
const med = stats.prepMs.length ? stats.prepMs.sort((a, b) => a - b)[Math.floor(stats.prepMs.length / 2)] : 0;
const avg = stats.prepMs.length ? stats.prepMs.reduce((a, b) => a + b, 0) / stats.prepMs.length : 0;
console.log(`\n[${ts()}] KLAAR: ${stats.ok} gereed, ${stats.fail} fout`);
console.log(`  prep-tijd: mediaan ${(med / 60000).toFixed(1)} min · gemiddeld ${(avg / 60000).toFixed(1)} min (bij ${PREP_AHEAD} tegelijk)`);
console.log(`  fouten (indien >0): ${ERRLOG}`);
// Zombie-CDP-les (battle 7): expliciet exiten, connectOverCDP houdt de loop anders eeuwig vast.
process.exit(0);
