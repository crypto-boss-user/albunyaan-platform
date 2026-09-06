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
 *    "dest":"01 - Categorie/03 - Serie/05 - Titel.mp4","links":"pad2.mp4|pad3.mp4",
 *    "expected_bytes":N,"requested_at":"...","ready_at":"..."}
 * dest = primaire archiefpad (teambesluit 2026-08-11) uit structuur.jsonl;
 * links = alle andere platform-plekken — de NAS maakt daar HARDLINKS
 * (teamfeedback 2026-08-11: elke categorie oogt volledig, opslag telt één
 * keer). filename = originele Uscreen-bestandsnaam (gaat als "orig" het
 * manifest in). dest/links zijn gesaneerd (geen aanhalingstekens of |-tekens
 * in de padnamen) zodat de sed-parser op de NAS ze aankan.
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
import { pad99 } from './lib/archief-plaatsing.mjs';

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
// Elke netwerkcall krijgt een harde bovengrens. Een fetch zonder timeout kan
// eeuwig blijven staan en dan hangt de HELE run zonder ooit te throwen
// (waargenomen 2026-08-16 én ~5 uur op 2026-08-15: na een korte
// netwerkstoring bleef één call hangen; archief-watchdog.sh moest drie keer
// killen en het herstartbudget van archief-run.sh raakte op → run stond stil).
// Ruime marges: een bullet_api-call is normaal ~100 ms, een HEAD ~1 s — deze
// grenzen raken alleen echt vastgelopen calls, nooit trage-maar-levende.
const API_TIMEOUT_MS = 60_000;   // in-page fetch naar de bullet_api
const EVAL_TIMEOUT_MS = 90_000;  // page.evaluate zelf (vastgelopen JS-context/CDP)
const HEAD_TIMEOUT_MS = 60_000;  // HEAD op de mezzanine-URL
// Hartslag: de poll-lus logt niets zolang geen enkele prep klaar is, dus vijf
// trage/dode preps maken het log minutenlang stil — niet te onderscheiden van
// een echte hang. archief-watchdog.sh killde daardoor op 15 min, terwijl het
// script 30 min (PREP_TIMEOUT_MS) nodig heeft om zo'n prep zelf fail-honest af
// te schrijven: elke herstart liep tegen dezelfde vijf ids aan (2026-08-16,
// ids 2665681/80/79/78/77). Met een hartslag is stilte weer een ECHT
// hang-signaal en mag de watchdogdrempel onder PREP_TIMEOUT_MS blijven.
const HEARTBEAT_MS = 5 * 60_000;

const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Harde bovengrens om een belofte die nooit settelt; timer wordt altijd
 * opgeruimd zodat een gewonnen race het proces niet alsnog openhoudt. */
function withTimeout(promise, ms, wat) {
  let t;
  const bel = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${wat}: geen antwoord binnen ${ms / 1000}s`)), ms); });
  return Promise.race([promise, bel]).finally(() => clearTimeout(t));
}
fs.mkdirSync(OUTDIR, { recursive: true });
const logErr = (msg) => { console.error(`[${ts()}] ${msg}`); fs.appendFileSync(ERRLOG, `${new Date().toISOString()} ${msg}\n`); };

/** Telegram naar de oprichter (afspraken volledige run 2026-08-11: melding bij
 * sessieverlies, elke 1.000 video's, niet-zelfherstellende fouten en afronding).
 * Mag de run zelf NOOIT breken — elke fout hier wordt ingeslikt. */
async function tg(text) {
  try {
    const env = fs.readFileSync(path.join(CC, 'telegram.env'), 'utf8');
    const tok = env.match(/TELEGRAM_BOT_TOKEN=(.*)/)?.[1]?.trim();
    const chat = env.match(/TELEGRAM_CHAT_ID=(.*)/)?.[1]?.trim();
    if (!tok || !chat) return;
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch { /* bewust stil */ }
}
const SESSIE_DOOD_MSG = '🔴 [archief] Uscreen-sessie verloren — de wachtrij-run is gestopt. '
  + 'Actie: log in de twin Chrome (poort 9333) opnieuw in bij Uscreen en start '
  + 'archive-request-links.mjs opnieuw; alles wat al in de wachtrij staat is veilig en wordt niet overgedaan.';

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
  if (!URL_ || !KEY) { console.log('let op: geen Supabase-env — member-first-volgorde overgeslagen'); return memberIdsUitCache(); }
  // NOOIT FATAAL (les 2026-08-16, 05:44–05:54): een netwerkstoring liet deze
  // fetch throwen vóór de eerste regel werk, dus élke herstart crashte binnen
  // seconden en de 10 herstarts van archief-run.sh waren in 10 minuten op —
  // 9 uur stilstand om een volgorde-optimalisatie. member_visible bepaalt
  // alleen de VOLGORDE van de wachtrij; zonder deze lijst archiveert de run
  // exact dezelfde video's, alleen niet member-first. Dus: 3 pogingen met
  // backoff, dan de cache van de vorige geslaagde run, dan gewoon door.
  const out = new Set();
  for (let poging = 1; poging <= 3; poging += 1) {
    out.clear();
    try {
      for (let from = 0; ; from += 1000) {
        const res = await fetch(`${URL_}/rest/v1/videos?member_visible=eq.true&select=external_id&order=external_id.asc`, {
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) { console.log(`let op: member_visible-query ${res.status} — member-first-volgorde overgeslagen`); return out.size ? out : memberIdsUitCache(); }
        const rows = await res.json();
        for (const r of rows) out.add(String(r.external_id));
        if (rows.length < 1000) break;
      }
      try {
        fs.writeFileSync(path.join(OUTDIR, 'member-visible-ids.json'), JSON.stringify([...out]));
      } catch { /* cache is een gemak, geen voorwaarde */ }
      return out;
    } catch (e) {
      console.log(`let op: member_visible-query mislukt (poging ${poging}/3): ${String(e?.message || e).slice(0, 120)}`);
      if (poging < 3) await new Promise((r) => setTimeout(r, poging * 10000));
    }
  }
  return memberIdsUitCache();
}
// laatste geslaagde member_visible-lijst; ontbreekt hij, dan draait de run
// gewoon door in bronvolgorde (fail-honest gelogd, nooit stoppen).
function memberIdsUitCache() {
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(OUTDIR, 'member-visible-ids.json'), 'utf8'));
    console.log(`let op: member_visible uit cache (${ids.length} ids) — Supabase was niet bereikbaar`);
    return new Set(ids.map(String));
  } catch {
    console.log('let op: geen member_visible-lijst en geen cache — run gaat door in bronvolgorde');
    return new Set();
  }
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
// Allowlist van VERVALLEN video's (bestaan bij Uscreen niet meer; prep geeft 404): één regel per id,
// "<id>  # reden". Die worden niet meer aangevraagd en tellen niet als fout. Alles wat níét op die
// lijst staat en faalt, maakt de run MISLUKT (exit 4) — nooit een stille 0 (founder 2026-09-04, T33).
const VERVALLEN_PAD = path.join(OUTDIR, 'vervallen-videos.txt');
const vervallen = new Set(fs.existsSync(VERVALLEN_PAD)
  ? fs.readFileSync(VERVALLEN_PAD, 'utf8').split('\n').map((l) => l.split('#')[0].trim()).filter(Boolean) : []);

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

const NEGEER_WACHTRIJ = process.argv.includes('--negeer-wachtrij') || process.env.ARCHIEF_NEGEER_WACHTRIJ === '1';
// ── al gedaan? done-markers van de NAS ophalen (hervatbaarheid) ──
function nasDoneSet() {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `ls ${NAS_DONE} 2>/dev/null`], { encoding: 'utf8' });
  if (r.status !== 0) {
    // Met --negeer-wachtrij is done/ de ENIGE rem: "leeg" zou dan de hele catalogus
    // opnieuw aanvragen (16.000+ preps). Fail-closed (2026-09-03): stoppen, niet raden.
    if (NEGEER_WACHTRIJ) { console.error(`[${ts()}] STOP: kon NAS done/ niet lezen (${(r.stderr || '').trim().slice(0, 80)}) en --negeer-wachtrij staat aan — niets aangevraagd`); process.exit(7); }
    console.log(`[${ts()}] let op: kon NAS done/ niet lezen (${(r.stderr || '').trim().slice(0, 80)}) — ga uit van leeg`); return new Set();
  }
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

// --cats "02,10": alleen video's die in deze categorieën TERECHTKOMEN — als
// vaste plek óf als hardlink (ook_in). Sinds het hardlink-besluit (teamfeedback
// 2026-08-11) hoort een video met vaste plek elders maar een link in een
// gekozen categorie er ook bij: de categorie moet volledig ogen.
const CATS_F = argVal('--cats', '').split(',').map((s) => s.trim()).filter(Boolean);
const inCats = (id) => {
  if (!CATS_F.length) return true;
  const st = STRUCT.get(String(id));
  if (!st) return false;
  const match = (p) => CATS_F.some((nn) => p.startsWith(`${nn} - `));
  return match(st.dest) || (st.ook_in ?? []).some(match);
};
const done = nasDoneSet();
// --negeer-wachtrij (of env ARCHIEF_NEGEER_WACHTRIJ=1): BIJVANGRONDE. Normaal
// slaat de run alles over wat ooit in een lokale wachtrij stond, ook als de NAS
// het nooit heeft afgerond — precies zo verdwenen 350 video's stil (zie de
// atomaire-overdracht-fix hierboven). Met deze vlag telt alleen de waarheid van
// de NAS (done-markers) en wordt de rest opnieuw aangeboden. Gebruik hem als de
// NAS-wachtrij LEEG is, anders bied je items aan die daar nog wachten.
const todoAlles = ordered.filter((id) => !done.has(id) && (NEGEER_WACHTRIJ || !queuedBefore.has(id)) && inCats(id));
const overgeslagenVervallen = todoAlles.filter((id) => vervallen.has(id));
const todo = todoAlles.filter((id) => !vervallen.has(id)).slice(0, LIMIT);
if (NEGEER_WACHTRIJ) console.log(`[${ts()}] BIJVANGRONDE: wachtrij-guard uitgeschakeld — alleen NAS-done-markers tellen`);
console.log(`[${ts()}] ${allIds.length} video's totaal · ${done.size} al op NAS · ${queuedBefore.size} al in wachtrij${CATS_F.length ? ` · filter cat ${CATS_F.join(',')}` : ''} · ${todo.length} te doen deze run` +
  (overgeslagenVervallen.length ? ` · ${overgeslagenVervallen.length} vervallen overgeslagen (allowlist ${path.basename(VERVALLEN_PAD)})` : ''));
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
if (page.url().includes('login')) { logErr('USCREEN SESSION DEAD — opnieuw inloggen in de twin Chrome en herstarten.'); await tg(SESSIE_DOOD_MSG); process.exit(2); }

/** bullet_api-call met retry + sessie-check (patroon uit harvest-video-extras.mjs). */
async function api(endpoint, body, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      // twee grenzen: AbortSignal in de pagina (blijft de fetch hangen) én een
      // race om de evaluate zelf (blijft de JS-context/CDP-brug hangen).
      return await withTimeout(page.evaluate(async ({ endpoint, body, timeoutMs }) => {
        const res = await fetch(`/bullet_api/v1/${endpoint}`, {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 401 || res.status === 403 || res.redirected) return { __auth: res.status };
        if (!res.ok) return { __err: res.status };
        return res.json();
      }, { endpoint, body, timeoutMs: API_TIMEOUT_MS }), EVAL_TIMEOUT_MS, `bullet_api ${endpoint}`);
    } catch (e) {
      if (attempt >= tries) { logErr(`API MISLUKT ${endpoint} na ${tries} pogingen: ${String(e?.message ?? e).slice(0, 160)}`); throw e; }
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
async function headOnce(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
      if (!res.ok) return null;
      const len = parseInt(res.headers.get('content-length') || '0', 10);
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      return { bytes: len || null, filename: m ? m[1] : null };
    } catch (e) {
      // een hangende HEAD legde vroeger de hele run stil; nu: kort opnieuw,
      // daarna eerlijk opgeven (de wachtrijregel valt terug op geen bytes).
      if (attempt >= tries) { logErr(`HEAD MISLUKT na ${tries} pogingen: ${String(e?.message ?? e).slice(0, 120)}`); return null; }
      await sleep(3000);
    }
  }
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
const stats = { ok: 0, fail: 0, prepMs: [], failIds: [], scpFail: 0 };
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
  // ATOMAIRE OVERDRACHT (fix 2026-08-22, incident: 300 video's stil verdwenen).
  // Eerst scp naar <naam>.tmp, daarna ssh mv naar <naam>.jsonl. archive-fetch.sh
  // pakt alleen *.jsonl op, dus de loop kan een half-geschreven wachtrij niet
  // meer zien. Wat er misging: scp schreef rechtstreeks in _queue/ terwijl de
  // loop draaide; die las het bestand op 0 regels ("0 ok, 0 fout"), verplaatste
  // het naar verwerkt/ en scp vulde daarna de verplaatste inode. Twaalf
  // wachtrijen (300 video's) verdwenen zo geruisloos — en omdat ze lokaal wél
  // in een queue-video-*.jsonl stonden, sloot de queuedBefore-guard ze voorgoed
  // uit van elke volgende run.
  const scp = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:${NAS_QUEUE}/${name}.tmp`], { encoding: 'utf8' });
  let verstuurd = scp.status === 0;
  if (verstuurd) {
    const mv = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS,
      `mv '${NAS_QUEUE}/${name}.tmp' '${NAS_QUEUE}/${name}'`], { encoding: 'utf8' });
    if (mv.status !== 0) { verstuurd = false; logErr(`MV OP NAS MISLUKT voor ${name}: ${(mv.stderr || '').trim().slice(0, 120)}`); }
  }
  if (verstuurd) {
    console.log(`[${ts()}] wachtrij ${name} (${queue.length} items) → NAS`);
  } else {
    // Lokaal bestand hernoemen zodat de queuedBefore-guard deze ids NIET als
    // "al in de wachtrij" telt: ze horen bij de volgende run gewoon terug te
    // komen. (Guard leest alleen queue-video-*.jsonl.)
    const bewaar = `${local}.niet-verzonden`;
    stats.scpFail++;
    try { fs.renameSync(local, bewaar); } catch { /* laat staan zoals het is */ }
    logErr(`SCP MISLUKT voor ${name}: ${(scp.stderr || '').trim().slice(0, 120)} — bewaard als ${path.basename(bewaar)}; de ids komen bij de volgende run terug`);
    void tg(`⚠️ [archief] SCP naar de NAS mislukt voor ${name} — ids komen bij de volgende run terug (bestand bewaard als .niet-verzonden). NAS-bereikbaarheid checken; run draait door.`);
  }
  queue = [];
  batchNr = Date.now();
}

// De wachtrij staat in het geheugen tot er BATCH items zijn. Zonder deze
// handler gooit ELKE kill (archief-watchdog.sh stuurt SIGTERM) tot BATCH-1 al
// klaargezette video's weg: de mezzanine-links zijn dan verloren en dezelfde
// video's moeten opnieuw geprept worden — 2026-08-16 gingen 2665685/84/82 zo
// drie keer door de molen. Nu wordt er eerst geflusht, dan pas afgesloten.
// Exit 143 = "crash" voor archief-run.sh, die dus gewoon herstart (gewenst).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try {
      if (queue.length) console.log(`[${ts()}] ${sig} ontvangen — ${queue.length} klaargezette video's nog wegschrijven`);
      flushQueue(true);
    } catch (e) {
      logErr(`FLUSH BIJ ${sig} MISLUKT: ${String(e?.message ?? e).slice(0, 120)} — wachtrij mogelijk verloren`);
    }
    process.exit(143);
  });
}

const pending = new Map(); // id -> { requestedAt }
let cursor = 0;
let lastBeat = Date.now();

while (cursor < todo.length || pending.size) {
  // vul aan tot PREP_AHEAD uitstaande preps
  while (pending.size < PREP_AHEAD && cursor < todo.length) {
    const id = todo[cursor++];
    const r = await api('videos.request_download', { id: Number(id) });
    await sleep(POLITENESS_MS);
    if (r?.__auth) { logErr('USCREEN SESSION DEAD — stop.'); flushQueue(true); await tg(SESSIE_DOOD_MSG); process.exit(2); }
    if (r?.ok) {
      pending.set(id, { requestedAt: Date.now() });
      console.log(`[${ts()}] prep aangevraagd: ${id} ${String(titles.get(id) ?? '').slice(0, 40)} (${pending.size} uitstaand, ${todo.length - cursor} te gaan)`);
    } else {
      stats.fail++; stats.failIds.push(id);
      logErr(`PREP GEWEIGERD ${id}: ${JSON.stringify(r).slice(0, 120)}`);
    }
  }

  // poll de uitstaande preps
  for (const [id, info] of [...pending]) {
    const d = await api('videos.details', { id: Number(id) });
    await sleep(POLITENESS_MS);
    if (d?.__auth) { logErr('USCREEN SESSION DEAD — stop.'); flushQueue(true); await tg(SESSIE_DOOD_MSG); process.exit(2); }
    // master_url doorloopt stadia: null -> letterlijk "preparing" -> echte URL
    // (live gezien 2026-08-10). Alleen een échte URL telt als klaar.
    const url = d?.video?.master_url;
    if (url && /^https?:/.test(url)) {
      const prepMs = Date.now() - info.requestedAt;
      const h = await headInfo(url).catch(() => null);
      if (!h?.bytes) logErr(`GEEN HEAD-INFO ${id} — wachtrijregel zonder expected_bytes (NAS kan de grootte niet vooraf toetsen; sha blijft de waarheid)`);
      const filename = h?.filename ?? `${id}.mp4`;
      // archiefpad: structuurbasis + échte extensie van het originele bestand
      const st = STRUCT.get(String(id));
      if (!st) logErr(`GEEN STRUCTUURPLEK voor ${id} — terugval op "99 - Buiten categorieën" (structuur.jsonl verouderd?)`);
      const ext = (filename.match(/\.[A-Za-z0-9]{2,5}$/) || ['.mp4'])[0];
      const destBase = st?.dest ?? pad99(sanFallback(titles.get(id)), id);   // losmap-vorm, één definitie met de wachter (B79 M-1, 2026-09-06)
      // links = alle andere platform-plekken, mét extensie, kale |-join
      // (hardlink-besluit; namen zijn gesaneerd en bevatten nooit | of ").
      // Met --cats blijven linkdoelen buiten de scope achterwege — die maakt
      // de volledige run of archive-links.mjs later (gedocumenteerd gedrag).
      const linkTo = (st?.ook_in ?? [])
        .filter((p) => !CATS_F.length || CATS_F.some((nn) => p.startsWith(`${nn} - `)));
      queue.push({
        kind: 'video', id, title: String(titles.get(id) ?? ''),
        url, filename, dest: `${destBase}${ext}`,
        links: linkTo.map((p) => `${p}${ext}`).join('|'),
        expected_bytes: h?.bytes ?? null,
        requested_at: new Date(info.requestedAt).toISOString(), ready_at: new Date().toISOString(),
      });
      pending.delete(id);
      stats.ok++; stats.prepMs.push(prepMs);
      console.log(`[${ts()}] KLAAR ${id}: ${h?.filename ?? '?'} ${h?.bytes ?? '?'} bytes (prep ${(prepMs / 60000).toFixed(1)} min) — ${stats.ok} gereed`);
      lastBeat = Date.now();
      if (stats.ok % 1000 === 0) void tg(`📦 [archief] ${stats.ok.toLocaleString('nl-NL')} video's in de wachtrij gezet (${todo.length - cursor} te gaan, ${stats.fail} fouten tot nu toe).`);
      flushQueue();
    } else if (Date.now() - info.requestedAt > PREP_TIMEOUT_MS) {
      pending.delete(id);
      stats.fail++; stats.failIds.push(id);
      logErr(`PREP TIMEOUT ${id}: na ${PREP_TIMEOUT_MS / 60000} min nog geen master_url`);
    }
  }
  if (pending.size) {
    if (Date.now() - lastBeat >= HEARTBEAT_MS) {
      const oudste = Math.max(...[...pending.values()].map((i) => Date.now() - i.requestedAt));
      console.log(`[${ts()}] wachtend op ${pending.size} preps (langste ${(oudste / 60000).toFixed(1)} min van max ${PREP_TIMEOUT_MS / 60000}, ${todo.length - cursor} te gaan)`);
      lastBeat = Date.now();
    }
    await sleep(POLL_EVERY_MS);
  }
}

flushQueue(true);
const med = stats.prepMs.length ? stats.prepMs.sort((a, b) => a - b)[Math.floor(stats.prepMs.length / 2)] : 0;
const avg = stats.prepMs.length ? stats.prepMs.reduce((a, b) => a + b, 0) / stats.prepMs.length : 0;
// Fail-honest op procesniveau (2026-09-04): fouten die niet op de allowlist staan, of een wachtrij
// die de NAS niet bereikte, maken de run MISLUKT (exit 4). De wachter zet dan OPHAAL-MISLUKT en
// probeert de volgende ronde opnieuw; de Telegram noemt de ids zodat ze beoordeeld kunnen worden.
const echtFout = stats.failIds.filter((id) => !vervallen.has(id));
const mislukt = echtFout.length > 0 || stats.scpFail > 0;
console.log(`\n[${ts()}] KLAAR: ${stats.ok} gereed, ${stats.fail} fout${echtFout.length ? ` (${echtFout.length} NIET op de allowlist: ${echtFout.slice(0, 10).join(', ')})` : ''}${stats.scpFail ? ` · ${stats.scpFail} wachtrij(en) niet verzonden` : ''}`);
console.log(`  prep-tijd: mediaan ${(med / 60000).toFixed(1)} min · gemiddeld ${(avg / 60000).toFixed(1)} min (bij ${PREP_AHEAD} tegelijk)`);
console.log(`  fouten (indien >0): ${ERRLOG}`);
await tg(`${mislukt ? '❌' : '✅'} [archief] Wachtrij-run ${mislukt ? 'MISLUKT' : 'afgerond'}: ${stats.ok.toLocaleString('nl-NL')} video's gereedgezet, ${stats.fail} fouten` +
  (echtFout.length ? ` — ${echtFout.length} niet op de allowlist (${echtFout.slice(0, 5).join(', ')}${echtFout.length > 5 ? ', …' : ''}): beoordelen en zo nodig in ${path.basename(VERVALLEN_PAD)} zetten` : '') +
  (stats.scpFail ? ` — ${stats.scpFail} wachtrij(en) niet naar de NAS (.niet-verzonden)` : '') +
  `${stats.fail && !mislukt ? ' (alle fouten = vervallen video\'s op de allowlist)' : ''}. De NAS werkt de wachtrij zelfstandig af.`);
if (mislukt) { console.error(`[${ts()}] MISLUKT: ${echtFout.length} echte fout(en), ${stats.scpFail} onverzonden wachtrij(en) — exit 4`); process.exit(4); }
// Zombie-CDP-les (battle 7): expliciet exiten, connectOverCDP houdt de loop anders eeuwig vast.
process.exit(0);
