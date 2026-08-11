/**
 * archive-extras.mjs — metadata van het NAS-originelenarchief
 * (teambesluit 2026-08-11 v2: elke seriemap krijgt beschrijving.txt,
 * zoekwoorden.txt, cover, thumbnails/ en bijlagen/; losse video's krijgen
 * dezelfde extras als sidecars naast het videobestand).
 *
 * Bronnen (geen Uscreen-admin-sessie nodig):
 *   - beschrijving: collections.description / videos.description (HTML → tekst)
 *   - zoekwoorden:  videos.tags (serie = unie van alle afleveringstags)
 *   - cover:        uscreen-collection-covers.jsonl, big_-prefix gestript =
 *                   origineel (bewezen 2026-08-09/10); terugval = raw.cover_url
 *                   (Supabase-spiegel, wordt gelogd — geen origineel)
 *   - thumbnails:   uscreen-videos-rich.jsonl (small_-prefix strippen);
 *                   terugval videos.thumbnail_url (spiegel, gelogd)
 *   - bijlagen:     videos.resources — al gespiegeld naar publieke Supabase
 *                   storage; naam = <platform-titel>.<ext> (origineel vastgelegd
 *                   in het manifest). Bijlage bij meerdere series/video's →
 *                   in ELKE map een kopie (teambesluit: zelfdragendheid > dedupe).
 *
 * Twee stromen:
 *   1. tekstbestanden: lokaal genereren → tar → NAS → uitpakken → remote script
 *      berekent sha256/bytes en schrijft manifestregels (kind beschrijving/
 *      zoekwoorden) + done-markers. Niets aanmaken dat niet bestaat: lege
 *      beschrijvingen/taglijsten slaan we over.
 *   2. downloads: wachtrijregels kind cover/thumb/bijlage met dest —
 *      archive-fetch.sh haalt ze binnen zoals video's (sha256 in manifest).
 *
 * Idempotent: NAS-done-markers (kind-id-<sha16 van dest>) worden vooraf
 * gelezen; bestaande items niet opnieuw in de wachtrij.
 *
 * Draaien (vanuit worker/):
 *   node archive-extras.mjs --cats "02,10"   # alleen deze categorieën (mini-run)
 *   node archive-extras.mjs                  # alles (volledige run)
 *   opties: --dry (alleen tellen, niets versturen)
 */
// spawnSync is hier OK: bewust sequentieel script (ssh/scp/tar wachten hoort);
// de spawnSync-regel uit 9623f97 gaat over parallelle transfercode.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const args = process.argv.slice(2);
const argVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CATS = argVal('--cats', '').split(',').map((s) => s.trim()).filter(Boolean); // bv ["02","10"]
const DRY = args.includes('--dry');
const ERRLOG = path.join(OUTDIR, 'fouten-mac.log');
const logErr = (msg) => { console.error(msg); fs.appendFileSync(ERRLOG, `${new Date().toISOString()} ${msg}\n`); };

const inCats = (dest) => !CATS.length || CATS.some((nn) => dest.startsWith(`${nn} - `));

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
const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
if (!struct.length || !series.length) { console.error('structuur(.series).jsonl ontbreekt — draai eerst node archive-structure.mjs'); process.exit(1); }

// ── hulpen ──
const stripPrefix = (url) => url.replace(/\/(small|big)_([^/]+)$/, '/$2'); // origineel beeld
const urlExt = (url) => { const m = new URL(url).pathname.match(/\.[A-Za-z0-9]{2,5}$/); return m ? m[0].toLowerCase() : '.jpg'; };
const destHash = (dest) => createHash('sha256').update(dest, 'utf8').digest('hex').slice(0, 16);
function htmlToText(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return lines.filter((l, i) => l || (i > 0 && lines[i - 1])).join('\n').trim();
}
// zelfde naam-hygiëne als archive-structure.mjs (bijlage-namen komen uit resource-titels)
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

// ── al gedaan? (done-markers voor extras: <kind>-<id>-<sha16 van dest>) ──
function nasDone() {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `ls ${BASE}/done 2>/dev/null`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.log('let op: kon NAS done/ niet lezen — ga uit van leeg'); return new Set(); }
  return new Set(r.stdout.split('\n').filter(Boolean));
}
const done = DRY ? new Set() : nasDone();
const marker = (kind, id, dest) => `${kind}-${id}-${destHash(dest)}`;

// ── verzamelaars ──
const texts = [];  // {dest, kind, id, inhoud}
const queue = [];  // {kind, id, url, filename, dest, expected_bytes:null}
let nSpiegelCover = 0, nSpiegelThumb = 0, nGeenThumb = 0;

function addText(dest, kind, id, inhoud) {
  if (!inhoud) return;
  if (done.has(marker(kind, id, dest))) return;
  texts.push({ dest, kind, id, inhoud });
}
function addDl(kind, id, url, filename, dest) {
  if (done.has(marker(kind, id, dest))) return;
  queue.push({ kind, id, url, filename, dest, expected_bytes: null });
}
function addBijlagen(resList, dirOrBase, perFolderSeen, ctx) {
  for (const r of resList) {
    if (!r?.url || perFolderSeen.has(String(r.id))) continue;
    perFolderSeen.add(String(r.id));
    const ext = r.extension ? `.${String(r.extension).toLowerCase()}` : urlExt(r.url);
    const titel = san(r.title ?? `bestand ${r.id}`, `bijlage ${r.id} (${ctx})`);
    // resource-titels eindigen soms zelf al op de extensie (".pdf") — niet dubbelen
    let name = titel.toLowerCase().endsWith(ext) ? titel : `${titel}${ext}`;
    if ([...perFolderSeen].filter((x) => x !== String(r.id)).length && queue.some((q) => q.dest === `${dirOrBase}/${name}`)) {
      name = `${san(r.title ?? '', '')} (${r.id})${ext}`; // naamboksing binnen map
    }
    addDl('bijlage', String(r.id), r.url, `${r.title ?? r.id}${ext}`, `${dirOrBase}/${name}`);
  }
}

// ── series ──
let nSeries = 0;
for (const s of series) {
  if (!inCats(s.dir)) continue;
  nSeries++;
  const coll = cByExt.get(s.collection);
  const eps = s.eps.map((e) => ({ ...e, v: vByExt.get(e.id) })).filter((e) => e.v);
  // beschrijving.txt
  const beschr = htmlToText(coll?.description);
  addText(`${s.dir}/beschrijving.txt`, 'beschrijving', s.collection, beschr);
  // zoekwoorden.txt: unieke tags van serie-afleveringen, volgorde van eerste voorkomen
  const tags = [];
  for (const e of eps) for (const t of (e.v.tags ?? [])) if (!tags.includes(t)) tags.push(t);
  addText(`${s.dir}/zoekwoorden.txt`, 'zoekwoorden', s.collection, tags.join('\n'));
  // cover (origineel via covers-jsonl; spiegel-terugval wordt geteld en gelogd)
  const cRaw = covers.get(s.collection);
  const cUrl = cRaw ? stripPrefix(cRaw) : coll?.raw?.cover_url;
  if (cUrl) {
    if (!cRaw) { nSpiegelCover++; logErr(`COVER-SPIEGEL (geen origineel bekend): serie ${s.collection} ${s.dir}`); }
    addDl('cover', s.collection, cUrl, path.basename(new URL(cUrl).pathname), `${s.dir}/cover${urlExt(cUrl)}`);
  }
  // thumbnails/<zelfde naam als de video>.<ext>
  for (const e of eps) {
    const tRaw = rich.get(e.id);
    const tUrl = tRaw ? stripPrefix(tRaw) : e.v.thumbnail_url;
    if (!tUrl) { nGeenThumb++; continue; }
    if (!tRaw) nSpiegelThumb++;
    addDl('thumb', e.id, tUrl, path.basename(new URL(tUrl).pathname), `${s.dir}/thumbnails/${e.bestand}${urlExt(tUrl)}`);
  }
  // bijlagen/ — unie over de afleveringen, één kopie per seriemap
  const seen = new Set();
  for (const e of eps) addBijlagen(e.v.resources ?? [], `${s.dir}/bijlagen`, seen, `serie ${s.collection}`);
}

// ── losse video's (dest-diepte 2 = direct in een categoriemap) ──
let nLoose = 0;
for (const r of struct) {
  if (r.dest.split('/').length !== 2 || !inCats(r.dest)) continue;
  const v = vByExt.get(r.id);
  if (!v) continue;
  nLoose++;
  addText(`${r.dest} - beschrijving.txt`, 'beschrijving', r.id, htmlToText(v.description));
  addText(`${r.dest} - zoekwoorden.txt`, 'zoekwoorden', r.id, (v.tags ?? []).join('\n'));
  const tRaw = rich.get(r.id);
  const tUrl = tRaw ? stripPrefix(tRaw) : v.thumbnail_url;
  if (tUrl) {
    if (!tRaw) nSpiegelThumb++;
    addDl('thumb', r.id, tUrl, path.basename(new URL(tUrl).pathname), `${r.dest}${urlExt(tUrl)}`);
  } else nGeenThumb++;
  const seen = new Set();
  addBijlagen(v.resources ?? [], `${r.dest} - bijlagen`, seen, `losse video ${r.id}`);
}

console.log(`\nBereik: ${nSeries} seriemappen + ${nLoose} losse video's${CATS.length ? ` (categorieën ${CATS.join(', ')})` : ' (alles)'}`);
console.log(`  tekstbestanden: ${texts.length} (beschrijving/zoekwoorden; lege overgeslagen — niets aanmaken dat niet bestaat)`);
console.log(`  downloads: ${queue.length} (covers/thumbnails/bijlagen)`);
console.log(`  spiegel-terugval: ${nSpiegelCover} covers, ${nSpiegelThumb} thumbnails · zonder thumbnail: ${nGeenThumb}`);
if (renames.length) {
  fs.appendFileSync(path.join(OUTDIR, 'structuur-hernoemd.log'), renames.join('\n') + '\n');
  console.log(`  ${renames.length} bijlage-namen aangepast (gelogd)`);
}
if (DRY) process.exit(0);
if (!texts.length && !queue.length) { console.log('Niets te doen.'); process.exit(0); }

// ── stroom 1: tekstbestanden → tar → NAS → sha/manifest remote ──
if (texts.length) {
  const staging = path.join(OUTDIR, 'tekst-staging');
  fs.rmSync(staging, { recursive: true, force: true });
  const tsv = [];
  for (const t of texts) {
    const p = path.join(staging, t.dest);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, t.inhoud + '\n');
    tsv.push(`${t.dest}\t${t.kind}\t${t.id}`);
  }
  fs.writeFileSync(path.join(staging, 'tekst-manifest.tsv'), tsv.join('\n') + '\n');
  const tarLocal = path.join(OUTDIR, 'tekst.tar');
  let r = spawnSync('tar', ['-cf', tarLocal, '-C', staging, '.'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`tar mislukt: ${r.stderr}`); process.exit(1); }
  r = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', tarLocal, `${NAS}:${BASE}/tekst.tar`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`scp tekst.tar mislukt: ${r.stderr}`); process.exit(1); }
  // remote: uitpakken, per tekstbestand sha256+bytes → manifest + done-marker
  const remote = `set -e
cd ${BASE}
tar -xf tekst.tar
rm tekst.tar
TAB=$(printf '\\t')
while IFS="$TAB" read -r dest kind id; do
  [ -z "$dest" ] && continue
  h=$(printf '%s' "$dest" | sha256sum | cut -c1-16)
  m="done/$kind-$id-$h"
  [ -f "$m" ] && continue
  [ -f "$dest" ] || { echo "TEKST ONTBREEKT NA UITPAK: $dest" >> fouten.log; continue; }
  sha=$(sha256sum "$dest" | cut -d' ' -f1)
  bytes=$(stat -c %s "$dest")
  echo "{\\"kind\\":\\"$kind\\",\\"id\\":\\"$id\\",\\"dest\\":\\"$dest\\",\\"bytes\\":$bytes,\\"sha256\\":\\"$sha\\",\\"done_at\\":\\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\\"}" >> manifest.jsonl
  touch "$m"
done < tekst-manifest.tsv
rm tekst-manifest.tsv
echo TEKST-OK`;
  r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, remote], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0 || !/TEKST-OK/.test(r.stdout)) { console.error(`tekst-ingest op NAS mislukt: ${(r.stderr || '').slice(0, 300)}`); process.exit(1); }
  console.log(`${texts.length} tekstbestanden op de NAS + manifest bijgewerkt.`);
}

// ── stroom 2: downloadwachtrij → _queue/ (archive-fetch.sh werkt hem af) ──
if (queue.length) {
  const name = `queue-extras-${Date.now()}.jsonl`;
  const local = path.join(OUTDIR, name);
  fs.writeFileSync(local, queue.map((q) => JSON.stringify(q)).join('\n') + '\n');
  const r = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:${BASE}/_queue/${name}`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`scp wachtrij mislukt: ${r.stderr} — staat lokaal: ${local}`); process.exit(1); }
  console.log(`wachtrij ${name} (${queue.length} items) → NAS _queue/ — start daar archive-fetch.sh`);
}
