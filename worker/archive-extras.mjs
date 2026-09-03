/**
 * archive-extras.mjs — metadata van het NAS-originelenarchief
 * (teambesluit 2026-08-11 v2 + teamfeedback 2026-08-11: hardlinks en
 * bijlagen-uit-originelen).
 *
 * PLAT (teambesluit v3, definitief): in een seriemap staat alles kaal naast
 * de afleveringen — cover, beschrijving.txt, zoekwoorden.txt en de bijlagen
 * zelf (geen thumbnails/- of bijlagen/-submappen). Losse video's krijgen
 * prefix-sidecars ("<nn> - <titel> - cover.jpg", "… - <bijlage>"), zodat ze
 * bij elkaar sorteren. Aflevering-thumbnails worden NIET gearchiveerd
 * (±16.000 automatisch gegenereerde bestanden); wél: serie-covers, losse-
 * video-covers en de 29 channel-covers ("01 - Channels Live 📡/"). Alles dat
 * op meerdere plekken hoort: ÉÉN fysieke kopie + HARDLINKS elders.
 *
 * Bronnen (geen Uscreen-admin-sessie nodig):
 *   - beschrijving: collections.description / videos.description (HTML → tekst)
 *   - zoekwoorden:  serie = Uscreen-SERIETAGS (uscreen-collection-details-live.jsonl,
 *                   geoogst door audit-serie-extras.mjs) + de tags van de
 *                   afleveringen; losse video = videos.tags
 *   - cover:        uscreen-collection-covers.jsonl, big_-prefix gestript =
 *                   origineel; terugval raw.cover_url (spiegel, gelogd)
 *   - thumbnails:   uscreen-videos-rich.jsonl (small_-prefix strippen);
 *                   terugval videos.thumbnail_url (spiegel, gelogd)
 *   - bijlagen:     ALTIJD de originele downloads in ~/.albunyaan-cc/resources/
 *                   (<id>__<naam>, 107 stuks, elk bestandstype, GEEN filter) —
 *                   teamfeedback 2026-08-11: de gespiegelde Supabase-subset
 *                   miste de 34 grote APK/XAPK-bestanden (>50MB-cap in
 *                   download-resources.mjs). Mac berekent sha256 vóór verzending;
 *                   de NAS verifieert na aankomst tegen díe sha (end-to-end).
 *   - ongekoppeld:  de resources zonder video-koppeling (file_resource_ids)
 *                   krijgen "99 - Bijlagen zonder video-koppeling (niet aan
 *                   content gekoppeld)/" + overzicht.txt (teambesluit punt 4).
 *
 * Drie stromen:
 *   1. tekstbestanden: lokaal genereren → tar → NAS → remote script: sha256 +
 *      manifest + done-marker + hardlinks naar secundaire mappen.
 *   2. covers/thumbnails: wachtrijregels kind cover/thumb met dest + links —
 *      archive-fetch.sh downloadt, verifieert en linkt.
 *   3. bijlagen (incl. ongekoppeld): rsync -a --partial van de originelen naar
 *      _staging-bijlagen/ op de NAS (per bestand hervatbaar, geen lokale
 *      tar-staging van GB's), daarna remote script: sha-verificatie tegen de
 *      Mac-sha → mv naar de primaire plek → hardlinks → manifest + marker.
 *      Bestaat de primaire plek al met de juiste sha → alleen links/manifest/
 *      marker (idempotent; zo worden ook de oude uit-de-spiegel-PDF's netjes
 *      geadopteerd of vervangen).
 *
 * Remote scripts nemen een EIGEN lock (_lock-extras), niet de _lock van
 * archive-fetch.sh. Die _lock is sinds 2026-08-24 permanent bezet omdat de
 * loop (archive-fetch.sh --loop) hem voor zijn hele levensduur houdt; delen
 * betekende dat de tekst-/bijlagen-ingest nooit meer kon draaien ("LOCK BEZET",
 * exit 1 — gemeten 2026-09-03). De gedeelde lock beschermde de manifest-append.
 * Eerlijk over het restrisico: een append (echo >> manifest.jsonl, O_APPEND) is
 * één write(2) zolang de regel in de stdio-buffer past (4 KB); bijlage-regels
 * met veel links zijn tot ~15 KB en gaan dan in 2-4 writes, dus een append van
 * de loop kan er in theorie tussen landen (venster: microseconden, alleen als
 * beide op hetzelfde moment schrijven). Zo'n kapotte regel is JSON-onleesbaar;
 * audit-volledig.mjs telt onleesbare manifestregels sinds 2026-09-03 expliciet
 * (AS 11c) en meldt het item als ongeregistreerd (AS 11b) — het valt dus op,
 * en de done-marker laat de volgende run het item opnieuw registreren.
 * _lock-extras sluit gelijktijdige extras-runs uit: wachten tot max. 10 minuten;
 * een verweesde lock (pid-bestand wijst naar een proces dat niet meer bestaat)
 * wordt opgeruimd; anders hardop falen — nooit stil overslaan. Handmatige
 * NAS-gereedschappen (archive-plat/-losmap/-restructure) kijken alleen naar
 * _lock — die niet draaien terwijl de wachter loopt (open punt, plan AS 7).
 * "Niets aanmaken dat niet bestaat" blijft gelden: lege beschrijvingen/
 * taglijsten worden overgeslagen.
 *
 * --cats "02,10": alleen items die (fysiek of als link) in die categorieën
 * landen; linkdoelen buíten de scope worden dan overgeslagen (de latere
 * volledige run of archive-links.mjs maakt ze alsnog — gedocumenteerd gedrag).
 *
 * Draaien (vanuit worker/):
 *   node archive-extras.mjs --cats "02,10"   # mini-run-scope
 *   node archive-extras.mjs                  # alles (volledige run)
 *   opties: --dry (alleen tellen, niets versturen)
 */
// spawnSync is hier OK: bewust sequentieel script (ssh/scp/rsync/tar wachten
// hoort); de spawnSync-regel uit 9623f97 gaat over parallelle transfercode.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const RESDIR = path.join(CC, 'resources');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const BUITEN_BIJLAGEN = '99 - Bijlagen zonder video-koppeling (niet aan content gekoppeld)';
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CATS = argVal('--cats', '').split(',').map((s) => s.trim()).filter(Boolean);
const DRY = args.includes('--dry');
const ERRLOG = path.join(OUTDIR, 'fouten-mac.log');
const logErr = (msg) => { console.error(msg); fs.appendFileSync(ERRLOG, `${new Date().toISOString()} ${msg}\n`); };

const inScope = (p) => !CATS.length || CATS.some((nn) => p.startsWith(`${nn} - `)) || p.startsWith(BUITEN_BIJLAGEN);
const linkFilter = (paths) => paths.filter((p) => inScope(p));

// ── env + data ──
for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Geen Supabase-env — stop.'); process.exit(1); }
async function sbAll(table, select, key = 'id') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${key}.asc`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    const page = await res.json(); rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}
const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

console.log('Gegevens ophalen…');
const videos = await sbAll('videos', 'id,external_id,title,description,tags,resources,thumbnail_url');
const collections = await sbAll('collections', 'id,external_id,title,description,raw');
const vByExt = new Map(videos.map((v) => [String(v.external_id), v]));
const cByExt = new Map(collections.map((c) => [String(c.external_id), c]));
const covers = new Map(readJsonl(path.join(CC, 'uscreen-collection-covers.jsonl'))
  .filter((r) => r.cover).map((r) => [String(r.id), r.cover]));
const rich = new Map(readJsonl(path.join(CC, 'uscreen-videos-rich.jsonl'))
  .filter((r) => r.thumb).map((r) => [String(r.id), r.thumb]));
// SERIE-tags uit de Uscreen-admin (audit-serie-extras.mjs schrijft dit bestand).
// Toegevoegd 2026-08-22 op verzoek van de founder: de afleveringstags in
// videos.tags zijn vrijwel leeg (15 van 684 series), terwijl Uscreen op
// COLLECTIE-niveau wél zoekwoorden voert (695 van 701 collecties). Zonder deze
// bron blijft zoekwoorden.txt voor bijna elke serie afwezig terwijl het
// platform ze wel heeft. Ontbreekt het bestand, dan valt de code terug op
// alleen afleveringstags (en meldt dat), zodat een oude checkout blijft werken.
const LIVE_COLL = path.join(CC, 'uscreen-collection-details-live.jsonl');
const liveDetails = new Map(readJsonl(LIVE_COLL).map((r) => [String(r.id), r]));
const serieTags = new Map(readJsonl(LIVE_COLL)
  .filter((r) => Array.isArray(r.tags) && r.tags.length).map((r) => [String(r.id), r.tags]));
if (!serieTags.size) console.log('let op: geen serietags (uscreen-collection-details-live.jsonl ontbreekt) — zoekwoorden.txt komt alleen uit afleveringstags');
const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
if (!struct.length || !series.length || series[0].dir) {
  console.error('structuur(.series).jsonl ontbreekt of is verouderd (pre-hardlinks) — draai eerst node archive-structure.mjs');
  process.exit(1);
}
// resource-indexen (teamfeedback: originelen zijn de bron)
const resLocal = new Map();   // rid → lokale bestandsnaam
for (const f of fs.existsSync(RESDIR) ? fs.readdirSync(RESDIR) : []) {
  const m = f.match(/^(\d+)__/); if (m) resLocal.set(m[1], f);
}
const resMeta = new Map(readJsonl(path.join(CC, 'uscreen-file-resources.jsonl')).map((r) => [String(r.id), r]));
const details = readJsonl(path.join(CC, 'uscreen-video-details.jsonl'));
const resVideos = new Map(); // rid → [video-ids]
for (const d of details) for (const rid of (d.file_resource_ids ?? [])) {
  const k = String(rid); if (!resVideos.has(k)) resVideos.set(k, []); resVideos.get(k).push(String(d.id));
}

// ── hulpen ──
const stripPrefix = (url) => url.replace(/\/(small|big)_([^/]+)$/, '/$2');
const urlExt = (url) => { const m = new URL(url).pathname.match(/\.[A-Za-z0-9]{2,5}$/); return m ? m[0].toLowerCase() : '.jpg'; };
const destHash = (dest) => createHash('sha256').update(dest, 'utf8').digest('hex').slice(0, 16);
const fileSha256 = (p) => new Promise((res, rej) => {
  const h = createHash('sha256'); const s = fs.createReadStream(p);
  s.on('data', (c) => h.update(c)); s.on('end', () => res(h.digest('hex'))); s.on('error', rej);
});
function htmlToText(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return lines.filter((l, i) => l || (i > 0 && lines[i - 1])).join('\n').trim();
}
const renames = [];
function san(name, ctx) {
  const orig = String(name ?? '').trim();
  let out = orig.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  if (!out) out = 'zonder titel';
  while (Buffer.byteLength(out, 'utf8') > 150) out = out.slice(0, -1).trimEnd();
  if (out !== orig) renames.push(`${ctx}: "${orig}" → "${out}"`);
  return out;
}
// ── al gedaan? (done-markers: <kind>-<id>-<sha16 van dest>) ──
function nasDone() {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `ls ${BASE}/done 2>/dev/null`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.log('let op: kon NAS done/ niet lezen — ga uit van leeg'); return new Set(); }
  return new Set(r.stdout.split('\n').filter(Boolean));
}
const done = DRY ? new Set() : nasDone();
const marker = (kind, id, dest) => `${kind}-${id}-${destHash(dest)}`;

// ── verzamelaars ──
const texts = [];     // {dest, kind, id, inhoud, links[]}
const queue = [];     // {kind, id, url, filename, dest, links, expected_bytes:null}
const bijlagen = [];  // {rid, local, dest, links[], titelnaam}
let nSpiegelCover = 0, nSpiegelThumb = 0, nGeenThumb = 0;

function addText(dest, kind, id, inhoud, links) {
  if (!inhoud) return;
  if (!inScope(dest) && !links.some(inScope)) return;
  if (done.has(marker(kind, id, dest))) return; // links van bestaande teksten: archive-links.mjs
  texts.push({ dest, kind, id, inhoud, links: linkFilter(links) });
}
function addDl(kind, id, url, filename, dest, links) {
  if (!inScope(dest) && !links.some(inScope)) return;
  if (done.has(marker(kind, id, dest))) return;
  queue.push({ kind, id, url, filename, dest, links: linkFilter(links).join('|'), expected_bytes: null });
}

// ── series: teksten, covers, thumbnails ──
let nSeries = 0;
for (const s of series) {
  if (!s.dirs.some(inScope)) continue;
  nSeries++;
  const primary = s.dirs[0];
  const rest = s.dirs.slice(1);
  const coll = cByExt.get(s.collection);
  // Terugval (2026-08-26): nieuwe series die de dagelijkse wachter toevoegt
  // staan nog niet in Supabase. Dan gelden de admin-gegevens uit
  // uscreen-collection-details-live.jsonl als bron voor beschrijving en cover.
  const liveColl = liveDetails.get(String(s.collection));
  const beschrijvingBron = coll?.description || liveColl?.description_html || '';
  const eps = s.eps.map((e) => ({ ...e, v: vByExt.get(e.id) })).filter((e) => e.v);
  addText(`${primary}/beschrijving.txt`, 'beschrijving', s.collection,
    htmlToText(beschrijvingBron), rest.map((d) => `${d}/beschrijving.txt`));
  // zoekwoorden: SERIE-tags eerst (Uscreen-admin), daarna de tags van de
  // afleveringen — dedup met behoud van volgorde, zodat het bestand stabiel is.
  const tags = [];
  for (const t of (serieTags.get(String(s.collection)) ?? [])) if (!tags.includes(t)) tags.push(t);
  for (const e of eps) for (const t of (e.v.tags ?? [])) if (!tags.includes(t)) tags.push(t);
  addText(`${primary}/zoekwoorden.txt`, 'zoekwoorden', s.collection,
    tags.join('\n'), rest.map((d) => `${d}/zoekwoorden.txt`));
  const cRaw = covers.get(s.collection);
  const liveCover = liveColl?.cover && !/fallback\//.test(liveColl.cover) ? liveColl.cover : null;
  const cUrl = cRaw ? stripPrefix(cRaw) : (liveCover ? stripPrefix(liveCover) : coll?.raw?.cover_url);
  if (cUrl) {
    if (!cRaw) { nSpiegelCover++; logErr(`COVER-SPIEGEL (geen origineel bekend): serie ${s.collection} ${primary}`); }
    const ext = urlExt(cUrl);
    addDl('cover', s.collection, cUrl, path.basename(new URL(cUrl).pathname),
      `${primary}/cover${ext}`, rest.map((d) => `${d}/cover${ext}`));
  }
}

// ── losse-video-covers + sidecar-teksten (correctie 1b, 2026-08-12: losse
// video mét extra's heeft een EIGEN map — cover/teksten/bijlagen staan er
// naakt in, net als bij een serie; kale losse video's hebben per definitie
// geen extra's) ──
const serieDirSet = new Set(series.flatMap((s) => s.dirs));
const isLoose = (l) => !serieDirSet.has(path.dirname(l));
let nLoose = 0;
for (const r of struct) {
  const locs = [r.dest, ...(r.ook_in ?? [])];
  const loose = locs.filter(isLoose);
  if (!loose.length || !locs.some(inScope)) continue;
  const v = vByExt.get(r.id);
  if (!v) continue; // niet-in-db (de 12 bewaarde) — geen extras-bronnen
  if (loose[0].split('/').length < 3) continue; // kaal = zonder extra's (per structuur-regel)
  nLoose++;
  const dirs = loose.map((l) => path.dirname(l));
  const tRaw = rich.get(r.id);
  const tUrl = tRaw ? stripPrefix(tRaw) : v.thumbnail_url;
  if (tUrl) {
    if (!tRaw) nSpiegelThumb++;
    const ext = urlExt(tUrl);
    if (ext !== '.jpg') logErr(`LOSSE COVER met afwijkende extensie ${ext}: ${r.id} ${dirs[0]}`);
    addDl('cover', r.id, tUrl, path.basename(new URL(tUrl).pathname),
      `${dirs[0]}/cover${ext}`, dirs.slice(1).map((d) => `${d}/cover${ext}`));
  } else nGeenThumb++;
  addText(`${dirs[0]}/beschrijving.txt`, 'beschrijving', r.id,
    htmlToText(v.description), dirs.slice(1).map((d) => `${d}/beschrijving.txt`));
  addText(`${dirs[0]}/zoekwoorden.txt`, 'zoekwoorden', r.id,
    (v.tags ?? []).join('\n'), dirs.slice(1).map((d) => `${d}/zoekwoorden.txt`));
}

// ── channels-covers (teambesluit v3.2c): 29 live-kanalen — de covers zijn de
// enige channel-artefacten die een Uscreen-opzegging overleven. Roster =
// category-order id 128768 (platform-positie 1 → map "01 - Channels Live 📡"),
// covers uit storefront-covers.json (querystring strippen = origineel),
// namen per PROGRAM-ID uit infra/live-relay/CHANNELS-INVENTORY.md ──
{
  const orderRow = readJsonl(path.join(CC, 'uscreen-category-order.jsonl')).find((r) => r.id === 128768);
  const sfPath = path.join(CC, 'storefront-covers.json');
  if (orderRow && fs.existsSync(sfPath)) {
    const covBySlug = new Map(JSON.parse(fs.readFileSync(sfPath, 'utf8'))
      .map((c) => [String(c.slug).split('?')[0], c.img]));
    const nameById = new Map();
    try {
      const inv = fs.readFileSync(new URL('../infra/live-relay/CHANNELS-INVENTORY.md', import.meta.url), 'utf8');
      for (const m of inv.matchAll(/^\|\s*(\d{6,})\s*\|\s*([^|]+?)\s*\|/gm)) nameById.set(m[1], m[2]);
    } catch { /* namen zijn nice-to-have; slug-terugval hieronder */ }
    const catDir = `01 - ${san(orderRow.title, 'channels-categorie')}`;
    const w = Math.max(2, String(orderRow.items.length).length);
    orderRow.items.forEach((slug, i) => {
      const img = covBySlug.get(slug);
      if (!img) { logErr(`CHANNEL ZONDER COVER in storefront-covers.json: ${slug}`); return; }
      const url = img.split('?')[0];
      const pid = url.match(/\/programs\/(\d+)\//)?.[1] ?? slug;
      const naam = san(nameById.get(pid) ?? slug, `channel ${pid}`);
      const ext = urlExt(url);
      addDl('cover', pid, url, path.basename(new URL(url).pathname),
        `${catDir}/${String(i + 1).padStart(w, '0')} - ${naam} - cover${ext}`, []);
    });
  } else if (!orderRow) logErr('CHANNELS: categorie 128768 niet gevonden in uscreen-category-order.jsonl');
}

// ── bijlagen: GLOBALE plekkenlijst per resource, dan scope-filter ──
// PLAT (teambesluit v3): in een seriemap staat de bijlage kaal naast de
// afleveringen (`<seriemap>/<naam>`); bij een losse video als prefix-sidecar
// (`<nn> - <titel> - <naam>`). Eerste plek (gesorteerd op archiefpad) =
// fysieke plek, de rest hardlinks. Prefixen eindigen op "/" (serie) of
// " - " (los) en worden direct aan de bijlage-naam geplakt.
const resFolders = new Map(); // rid → Set(prefixen)
const addResFolder = (rid, prefix) => {
  if (!resFolders.has(rid)) resFolders.set(rid, new Set());
  resFolders.get(rid).add(prefix);
};
for (const s of series) {
  for (const e of s.eps) {
    const v = vByExt.get(e.id);
    for (const res of (v?.resources ?? [])) {
      for (const d of s.dirs) addResFolder(String(res.id), `${d}/`);
    }
  }
}
for (const r of struct) {
  const v = vByExt.get(r.id);
  if (!v?.resources?.length) continue;
  for (const loc of [r.dest, ...(r.ook_in ?? [])]) {
    if (!isLoose(loc) || loc.split('/').length < 3) continue;
    // losmap: bijlage naakt in de eigen map van de video
    for (const res of v.resources) addResFolder(String(res.id), `${path.dirname(loc)}/`);
  }
}
// weergavenaam per resource (titel + echte extensie van het origineel);
// globale naamboksing → (rid) erbij, gelogd
const resName = new Map();
{
  const byName = new Map();
  for (const [rid, local] of resLocal) {
    const metaTitle = resMeta.get(rid)?.title
      ?? videos.flatMap((v) => v.resources ?? []).find((x) => String(x.id) === rid)?.title
      ?? local.replace(/^\d+__/, '');
    const ext = path.extname(local).toLowerCase();
    const titel = san(metaTitle, `bijlage ${rid}`);
    let naam = titel.toLowerCase().endsWith(ext) && ext ? titel : `${titel}${ext}`;
    // reserveringsguard platte structuur: nooit botsen met gegenereerde
    // bestanden of afleverings-nummering in dezelfde (serie)map
    if (/^cover\./i.test(naam) || /^(beschrijving|zoekwoorden)\.txt$/i.test(naam) || /^\d+ - /.test(naam)) {
      const e2 = path.extname(naam);
      naam = `${naam.slice(0, naam.length - e2.length)} (${rid})${e2}`;
      renames.push(`bijlage-reservering: ${rid} → "${naam}"`);
    }
    resName.set(rid, naam);
    if (!byName.has(naam.toLowerCase())) byName.set(naam.toLowerCase(), []);
    byName.get(naam.toLowerCase()).push(rid);
  }
  for (const [, rids] of byName) {
    if (rids.length < 2) continue;
    for (const rid of rids) {
      const naam = resName.get(rid);
      const ext = path.extname(naam);
      resName.set(rid, `${naam.slice(0, naam.length - ext.length)} (${rid})${ext}`);
      renames.push(`bijlage-naamboksing: ${rid} → "${resName.get(rid)}"`);
    }
  }
}
let nOngekoppeld = 0;
for (const [rid, local] of resLocal) {
  const naam = resName.get(rid);
  let places;
  if (resFolders.has(rid)) {
    places = [...resFolders.get(rid)].sort().map((p) => `${p}${naam}`);
  } else {
    nOngekoppeld++;
    const kaal = local.replace(/^\d+__/, '');
    places = [`${BUITEN_BIJLAGEN}/${kaal}`];
  }
  if (!places.some(inScope)) continue;
  const dest = places[0];
  if (done.has(marker('bijlage', rid, dest)) && !linkFilter(places.slice(1)).length) continue;
  bijlagen.push({ rid, local, dest, links: linkFilter(places.slice(1)) });
}

console.log(`\nBereik: ${nSeries} series + ${nLoose} losse plaatsingen${CATS.length ? ` (categorieën ${CATS.join(', ')} + ongekoppeld-map)` : ' (alles)'}`);
console.log(`  tekstbestanden: ${texts.length} · covers (serie/los/channel): ${queue.length} · bijlagen uit originelen: ${bijlagen.length} (waarvan ${nOngekoppeld} ongekoppeld → "${BUITEN_BIJLAGEN}")`);
console.log(`  spiegel-terugval: ${nSpiegelCover} serie-covers, ${nSpiegelThumb} losse covers · losse video zonder cover: ${nGeenThumb}`);
if (renames.length) {
  fs.appendFileSync(path.join(OUTDIR, 'structuur-hernoemd.log'), renames.join('\n') + '\n');
  console.log(`  ${renames.length} namen aangepast (gelogd)`);
}
if (DRY) process.exit(0);
if (!texts.length && !queue.length && !bijlagen.length) { console.log('Niets te doen.'); process.exit(0); }

// gedeeld remote-voorstuk: eigen lock (_lock-extras, wachten met timeout) + make_links
const REMOTE_PRELUDE = `set -e
cd ${BASE}
_w=0
until mkdir _lock-extras 2>/dev/null; do
  if [ ! -d _lock-extras ]; then echo "mkdir _lock-extras faalt om een andere reden dan bezet (rechten/schijf?)" >&2; exit 3; fi
  _lp=$(cat _lock-extras/pid 2>/dev/null)
  if [ -n "$_lp" ] && [ ! -d "/proc/$_lp" ]; then
    echo "verweesde lock-extras (pid $_lp bestaat niet meer) — opgeruimd"; rm -rf _lock-extras; continue
  fi
  _w=$((_w+1))
  if [ "$_w" -ge 20 ]; then
    echo "LOCK BEZET na 10 min wachten: draait er nog een archive-extras-ingest (pid \${_lp:-onbekend})? Zo nee -> rm -rf ${BASE}/_lock-extras (aangemaakt: $(stat -c %y _lock-extras 2>/dev/null))" >&2
    exit 3
  fi
  [ "$_w" -eq 1 ] && echo "lock-extras bezet (pid \${_lp:-onbekend}) — wachten (max 10 min)…"
  sleep 30
done
echo $$ > _lock-extras/pid
trap 'rm -rf _lock-extras 2>/dev/null' EXIT INT TERM HUP
TAB=$(printf '\\t')
make_links() { # $1=fysiek pad $2=|-gescheiden linkpaden
  [ -z "$2" ] && return 0
  _rc=0; _oldifs=$IFS; IFS='|'; set -f
  for _lp in $2; do
    [ -z "$_lp" ] && continue
    [ "$_lp" -ef "$1" ] && continue
    if ! { mkdir -p "$(dirname "$_lp")" && ln -f "$1" "$_lp"; }; then
      echo "LINK-FOUT: $_lp"; _rc=1
    fi
  done
  set +f; IFS=$_oldifs
  return $_rc
}
`;
function runRemote(scriptBody, okMark, label) {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, scriptBody], { encoding: 'utf8', timeout: 60 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0 || !r.stdout.includes(okMark)) {
    console.error(`${label} op NAS mislukt: ${(r.stderr || '').slice(0, 300)}`);
    process.exit(1);
  }
  return r.stdout;
}
const scpTo = (local, remote) => {
  // remote pad enkel-gequote: scp -O laat de NAS-shell het pad splitsen, en
  // archiefpaden bevatten spaties/haakjes (geen enkele quote — gesaneerd)
  const r = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:'${remote}'`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`scp ${path.basename(local)} mislukt: ${r.stderr}`); process.exit(1); }
};

// ── stroom 1: tekstbestanden ──
if (texts.length) {
  const staging = path.join(OUTDIR, 'tekst-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  const tsv = [];
  for (const t of texts) {
    const p = path.join(staging, t.dest);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, t.inhoud + '\n');
    tsv.push([t.dest, t.kind, t.id, t.links.join('|')].join('\t'));
  }
  fs.writeFileSync(path.join(staging, 'tekst-manifest.tsv'), tsv.join('\n') + '\n');
  const tarLocal = path.join(OUTDIR, 'tekst.tar');
  let r = spawnSync('tar', ['-cf', tarLocal, '-C', staging, '.'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`tar mislukt: ${r.stderr}`); process.exit(1); }
  scpTo(tarLocal, `${BASE}/tekst.tar`);
  runRemote(`${REMOTE_PRELUDE}
# tar mag modes van BESTAANDE mappen niet zetten wanneer het eigenaarschap
# door SMB-verwijderen/terugzetten is gewijzigd (wipe-incident 2026-08-12) —
# de bestanden zelf komen wel aan; niet-fataal maken. De per-bestand-checks
# (bestaat + sha256) hieronder blijven de echte waarheid (fail-honest).
tar -xf tekst.tar || echo "TAR-WAARSCHUWING: mode-fouten op bestaande mappen genegeerd (eigenaarschap)"
rm tekst.tar
while IFS="$TAB" read -r dest kind id lnks; do
  [ -z "$dest" ] && continue
  h=$(printf '%s' "$dest" | sha256sum | cut -c1-16)
  m="done/$kind-$id-$h"
  [ -f "$dest" ] || { echo "TEKST ONTBREEKT NA UITPAK: $dest" >> fouten.log; continue; }
  make_links "$dest" "$lnks" || { echo "TEKST-LINKS ONVOLLEDIG: $dest" >> fouten.log; continue; }
  [ -f "$m" ] && continue
  sha=$(sha256sum "$dest" | cut -d' ' -f1)
  bytes=$(stat -c %s "$dest")
  echo "{\\"kind\\":\\"$kind\\",\\"id\\":\\"$id\\",\\"dest\\":\\"$dest\\",\\"bytes\\":$bytes,\\"sha256\\":\\"$sha\\",\\"links\\":\\"$lnks\\",\\"done_at\\":\\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\\"}" >> manifest.jsonl
  touch "$m"
done < tekst-manifest.tsv
rm tekst-manifest.tsv
echo TEKST-OK`, 'TEKST-OK', 'tekst-ingest');
  console.log(`${texts.length} tekstbestanden op de NAS (incl. links) + manifest bijgewerkt.`);
}

// ── stroom 2: covers/thumbnails via de wachtrij ──
if (queue.length) {
  const name = `queue-extras-${Date.now()}.jsonl`;
  const local = path.join(OUTDIR, name);
  fs.writeFileSync(local, queue.map((q) => JSON.stringify(q)).join('\n') + '\n');
  scpTo(local, `${BASE}/_queue/${name}`);
  console.log(`wachtrij ${name} (${queue.length} covers/thumbs) → NAS _queue/`);
}

// ── stroom 3: bijlagen uit de originelen (rsync + remote ingest) ──
if (bijlagen.length) {
  console.log(`sha256 berekenen over ${bijlagen.length} originelen…`);
  // kolomscheiding = unit separator \037: TAB is IFS-whitespace en laat lege
  // kolommen (geen links) samenklappen, waardoor alle velden verschuiven —
  // live gezien 2026-08-11 (27 schijnbare sha-mismatches die de bytes-kolom
  // als sha lazen). \037 is geen whitespace en komt nooit in bestandsnamen voor.
  const rows = [];
  for (const b of bijlagen) {
    const p = path.join(RESDIR, b.local);
    const st = fs.statSync(p);
    const sha = await fileSha256(p);
    rows.push([b.local, b.rid, b.dest, b.links.join('|'), sha, st.size].join('\u001f'));
  }
  const listLocal = path.join(OUTDIR, 'bijlagen-lijst.txt');
  fs.writeFileSync(listLocal, bijlagen.map((b) => b.local).join('\n') + '\n');
  const tsvLocal = path.join(OUTDIR, 'bijlagen-ingest.tsv');
  fs.writeFileSync(tsvLocal, rows.join('\n') + '\n');
  console.log(`rsync van ${bijlagen.length} originelen naar de NAS (hervatbaar)…`);
  const rs = spawnSync('rsync', ['-a', '--partial', '--files-from=' + listLocal,
    '-e', `ssh -p ${NAS_PORT}`, RESDIR + '/', `${NAS}:${BASE}/_staging-bijlagen/`],
    { encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'], timeout: 4 * 60 * 60_000 });
  if (rs.status !== 0) {
    // Synology weigert rsync-over-ssh zolang de DSM-"rsync service" uit staat
    // ("Permission denied, please try again" — live gezien 2026-08-11).
    // Terugval: scp -O per bestand — zelfde bewezen transportpad als de
    // wachtrijen, hervatbaar op bestandsniveau (ingest slaat al-aanwezige
    // bestanden met kloppende sha over).
    console.log(`rsync geweigerd (${(rs.stderr || '').split('\n')[0]}) — terugval op scp per bestand…`);
    const mk = spawnSync('ssh', ['-p', NAS_PORT, NAS, `mkdir -p '${BASE}/_staging-bijlagen'`], { encoding: 'utf8' });
    if (mk.status !== 0) { console.error(`mkdir staging mislukt: ${mk.stderr}`); process.exit(1); }
    // hervatbaar: wat al compleet gestaged is (zelfde bytes) niet nog eens sturen
    const lsStage = spawnSync('ssh', ['-p', NAS_PORT, NAS,
      `cd '${BASE}/_staging-bijlagen' 2>/dev/null && stat -c '%s %n' * 2>/dev/null; true`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const staged = new Map();
    for (const l of (lsStage.stdout || '').split('\n').filter(Boolean)) {
      const sp = l.indexOf(' ');
      staged.set(l.slice(sp + 1), parseInt(l.slice(0, sp), 10));
    }
    for (const b of bijlagen) {
      const size = fs.statSync(path.join(RESDIR, b.local)).size;
      if (staged.get(b.local) === size) { process.stdout.write(`  al gestaged: ${b.local.slice(0, 55)}\n`); continue; }
      process.stdout.write(`  scp ${b.local.slice(0, 60)}…\n`);
      scpTo(path.join(RESDIR, b.local), `${BASE}/_staging-bijlagen/${b.local}`);
    }
  }
  scpTo(tsvLocal, `${BASE}/bijlagen-ingest.tsv`);
  const uit = runRemote(`${REMOTE_PRELUDE}
US=$(printf '\\037')
ok=0; fail=0
while IFS="$US" read -r local rid dest lnks macsha bytes; do
  [ -z "$local" ] && continue
  h=$(printf '%s' "$dest" | sha256sum | cut -c1-16)
  m="done/bijlage-$rid-$h"
  if [ -f "$dest" ] && [ "$(sha256sum "$dest" | cut -d' ' -f1)" = "$macsha" ]; then
    : # al op zijn plek met de juiste inhoud — alleen links/manifest/marker
  else
    s="_staging-bijlagen/$local"
    [ -f "$s" ] || { echo "FOUT $rid STAGING ONTBREEKT: $local"; fail=$((fail+1)); continue; }
    calc=$(sha256sum "$s" | cut -d' ' -f1)
    [ "$calc" = "$macsha" ] || { echo "FOUT $rid SHA-MISMATCH transport: $local kreeg=$calc verwacht=$macsha"; fail=$((fail+1)); continue; }
    mkdir -p "$(dirname "$dest")"
    mv -f "$s" "$dest"
  fi
  make_links "$dest" "$lnks" || { echo "FOUT $rid LINKS ONVOLLEDIG: $dest"; fail=$((fail+1)); continue; }
  if [ ! -f "$m" ]; then
    echo "{\\"kind\\":\\"bijlage\\",\\"id\\":\\"$rid\\",\\"dest\\":\\"$dest\\",\\"orig\\":\\"$local\\",\\"bytes\\":$bytes,\\"sha256\\":\\"$macsha\\",\\"links\\":\\"$lnks\\",\\"done_at\\":\\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\\"}" >> manifest.jsonl
    touch "$m"
  fi
  ok=$((ok+1))
done < bijlagen-ingest.tsv
rm bijlagen-ingest.tsv
rmdir _staging-bijlagen 2>/dev/null || true
echo "BIJLAGEN-KLAAR ok=$ok fail=$fail"`, 'BIJLAGEN-KLAAR ok=', 'bijlagen-ingest');
  // fail-closed: de OK-marker alleen is niet genoeg — fail>0 = run mislukt
  const failN = parseInt(uit.match(/BIJLAGEN-KLAAR ok=\d+ fail=(\d+)/)?.[1] ?? '999', 10);
  if (failN > 0) { console.error(`${failN} bijlage-fouten (zie hierboven) — run als MISLUKT beschouwen.`); process.exit(1); }
}

// ── overzicht.txt voor de ongekoppelde bijlagen (teambesluit punt 4) ──
const ongekoppeld = [...resLocal].filter(([rid]) => !resFolders.has(rid));
if (ongekoppeld.length) {
  const regels = [
    'Bijlagen zonder video-koppeling — overzicht',
    `Stand: ${new Date().toISOString().slice(0, 10)} · bron: Uscreen file_resources-catalogus + video-details-oogst`,
    'Deze bestanden bestonden op Uscreen als "file resources" maar hingen aan geen enkele video.',
    'Ze zijn integraal bewaard (origineel bestand, sha256 in manifest.jsonl).',
    '',
  ];
  for (const [rid, local] of ongekoppeld.sort((a, b) => a[1].localeCompare(b[1], 'nl'))) {
    const meta = resMeta.get(rid);
    regels.push(`• ${local.replace(/^\d+__/, '')}`);
    regels.push(`    resource-id: ${rid} · type: ${meta?.mime_type ?? path.extname(local).slice(1) ?? 'onbekend'} · grootte: ${meta?.size ?? '?'}`);
    if (meta?.title && meta.title !== local.replace(/^\d+__/, '')) regels.push(`    titel op Uscreen: ${meta.title}`);
    if (meta?.description?.trim()) regels.push(`    omschrijving: ${htmlToText(meta.description).replace(/\n/g, ' / ')}`);
  }
  const ovLocal = path.join(OUTDIR, 'overzicht-ongekoppeld.txt');
  fs.writeFileSync(ovLocal, regels.join('\n') + '\n');
  const r = spawnSync('ssh', ['-p', NAS_PORT, NAS, `mkdir -p "${BASE}/${BUITEN_BIJLAGEN}"`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`mkdir ongekoppeld-map mislukt: ${r.stderr}`); process.exit(1); }
  scpTo(ovLocal, `${BASE}/${BUITEN_BIJLAGEN}/overzicht.txt`);
  console.log(`overzicht.txt (${ongekoppeld.length} ongekoppelde bijlagen) → "${BUITEN_BIJLAGEN}/"`);
}
