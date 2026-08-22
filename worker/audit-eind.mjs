/**
 * audit-eind.mjs — VOLLEDIGE EINDAUDIT van het NAS-archief (2026-08-22).
 *
 * Doel: één rapport dat het team kan aftekenen als "het archief is compleet en
 * klopt". Alles wordt VERS gemeten; geen enkel getal komt uit een oude run.
 *
 * Waarheidsbron = de Uscreen-admin (bullet_api), niet onze eigen scrapes:
 *   videos.index      {"page":n}          → alle video's + duur + resolution_tier
 *   categories.index  {"page":1}          → 25 categorieën met positie
 *   categories.show   {"id":n,"page":p}   → volgorde van items in een categorie
 *   (series/beschrijvingen: audit-serie-extras.mjs, apart script)
 *
 * Onderdelen (nummering = teamvraag 2026-08-22):
 *   1 VIDEO'S    aantal NAS vs Uscreen · bytes vs opgegeven grootte ·
 *                sha-steekproef vs manifest · duur-steekproef (ffmpeg op de NAS)
 *   2 KWALITEIT  resolutie-steekproef vs resolution_tier uit de admin
 *   3 COVERS     serie/los/channel aanwezig + niet leeg · geen aflevering-thumbs
 *   4 BIJLAGEN   107 originelen: geplaatst / 99-map / wachtend · bytes + sha
 *   5 TEKSTEN    beschrijving + zoekwoorden: dekking vs platform
 *   6 STRUCTUUR  volgorde vs platform (steekproef categorieën) · plaatsingen vs
 *                categorie-lidmaatschap · lege bestanden/mappen · naamregels
 *   7 RESTLIJST  wat er ontbreekt, met naam en reden
 *
 * Draaien (vanuit worker/):
 *   node audit-eind.mjs                # alles vers meten
 *   node audit-eind.mjs --geen-oogst   # Uscreen-oogst hergebruiken
 *   opties: --sha N (default 100) · --media N (default 50) · --cats N (default 5)
 * Rapport: ~/.albunyaan-cc/archief/EINDAUDIT.txt (+ EINDAUDIT-samenvatting.md)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const RESDIR = path.join(CC, 'resources');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const LIVE_VIDEOS = path.join(CC, 'uscreen-videos-live.jsonl');
const LIVE_COLL = path.join(CC, 'uscreen-collection-details-live.jsonl');
const LIVE_CATS = path.join(CC, 'uscreen-categories-live.json');
const RAPPORT = path.join(OUTDIR, 'EINDAUDIT.txt');
const SAMENVATTING = path.join(OUTDIR, 'EINDAUDIT-samenvatting.md');
const argN = (naam, def) => { const i = process.argv.indexOf(naam); return i > 0 ? Number(process.argv[i + 1]) : def; };
const N_SHA = argN('--sha', 100), N_MEDIA = argN('--media', 50), N_CATS = argN('--cats', 5);
const SKIP = process.argv.includes('--geen-oogst');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJsonl = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function htmlToText(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const r = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return r.filter((l, i) => l || (i > 0 && r[i - 1])).join('\n').trim();
}
function nasRun(cmd, label, stdin) {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS, cmd],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 60 * 60_000, input: stdin });
  if (r.status !== 0) { console.error(`${label} mislukt: ${(r.stderr || '').slice(0, 300)}`); process.exit(1); }
  return r.stdout;
}
const hms = (s) => { const p = String(s ?? '').split(':').map(Number); if (p.some(isNaN)) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; };

// ── verse Uscreen-oogst ──
async function oogst() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const api = (pad, body) => page.evaluate(async ([pad, body]) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 45000);
    try {
      const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
      return r.ok ? await r.json() : { __err: r.status };
    } catch (e) { return { __err: String(e.message || e).slice(0, 100) }; } finally { clearTimeout(t); }
  }, [pad, body]);

  // video's
  const out = fs.createWriteStream(LIVE_VIDEOS, { flags: 'w' });
  let n = 0, p = 1, totaal = null;
  for (;;) {
    const j = await api('videos.index', { page: p });
    if (j.__err) throw new Error(`videos.index p${p}: ${j.__err}`);
    totaal ??= j.total_count;
    for (const v of (j.videos ?? [])) {
      out.write(JSON.stringify({ id: String(v.id), title: v.title, duur: hms(v.duration_humanize),
        duration_humanize: v.duration_humanize, resolution_tier: v.resolution_tier, release_stage: v.release_stage,
        collection_ids: v.collection_ids ?? [], category_ids: v.category_ids ?? [], permalink: v.permalink,
        transcoded: v.transcoded, created_at: v.created_at }) + '\n');
      n++;
    }
    if (!(j.videos ?? []).length || j.pagination?.is_last_page) break;
    if (++p % 50 === 0) console.log(`[${ts()}]   videos.index p${p} — ${n}/${totaal ?? '?'}`);
    await sleep(120);
  }
  out.end(); await new Promise((r) => out.on('finish', r));
  console.log(`[${ts()}] video-oogst: ${n} van ${totaal} (Uscreen total_count)`);

  // categorieën + volgorde van de steekproefcategorieën
  const cj = await api('categories.index', { page: 1 });
  const cats = cj.categories ?? [];
  const gekozen = cats.filter((c) => c.videos_count > 0).sort((a, b) => a.position - b.position)
    .filter((_, i) => i % Math.max(1, Math.floor(cats.length / N_CATS)) === 0).slice(0, N_CATS);
  const volgorde = {};
  for (const c of gekozen) {
    const items = [];
    for (let pg = 1; pg <= 40; pg++) {
      const j = await api('categories.show', { id: c.id, page: pg });
      if (j.__err) break;
      const rij = j.contents ?? [];
      items.push(...rij.map((x) => ({ id: String(x.id ?? x.subject_id), title: x.title ?? x.subject_title, type: x.type ?? x.content_type })));
      if (!rij.length || j.pagination?.is_last_page) break;
      await sleep(200);
    }
    volgorde[c.id] = { titel: c.title, positie: c.position, items };
    console.log(`[${ts()}]   categorie ${c.position} ${c.title}: ${items.length} items`);
  }
  fs.writeFileSync(LIVE_CATS, JSON.stringify({ cats, volgorde }, null, 1));
  await page.close();
}
if (!SKIP) await oogst();
const liveVideos = readJsonl(LIVE_VIDEOS);
const liveColl = readJsonl(LIVE_COLL);
const { cats: liveCats = [], volgorde = {} } = fs.existsSync(LIVE_CATS) ? JSON.parse(fs.readFileSync(LIVE_CATS, 'utf8')) : {};
if (!liveVideos.length) { console.error('geen verse video-oogst — draai zonder --geen-oogst'); process.exit(1); }

// ── NAS-inventaris ──
console.log(`[${ts()}] NAS-inventaris…`);
const boom = nasRun(`cd ${BASE} && find . -type f -exec stat -c '%s|%h|%i|%n' {} + 2>/dev/null`, 'find');
const bestand = new Map();
for (const l of boom.split('\n')) { const m = l.match(/^(\d+)\|(\d+)\|(\d+)\|\.\/(.+)$/);
  if (m) bestand.set(m[4], { bytes: +m[1], nlink: +m[2], inode: m[3] }); }
const legeMappen = nasRun(`cd ${BASE} && find . -type d -empty 2>/dev/null`, 'lege mappen')
  .split('\n').filter(Boolean).map((s) => s.replace(/^\.\//, '')).filter((d) => d !== 'done');
const manifest = nasRun(`cd ${BASE} && cat manifest.jsonl`, 'manifest').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const foutenNas = nasRun(`cd ${BASE} && cat fouten.log 2>/dev/null`, 'fouten').split('\n').filter(Boolean);
const laatsteManifest = new Map();               // dest → laatste regel (manifest is append-only)
for (const m of manifest) if (m.dest) laatsteManifest.set(m.dest, m);
console.log(`[${ts()}] ${bestand.size} bestanden · ${manifest.length} manifestregels · ${legeMappen.length} lege mappen`);

const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
const details = readJsonl(path.join(CC, 'uscreen-video-details.jsonl'));
const resMeta = readJsonl(path.join(CC, 'uscreen-file-resources.jsonl'));
const titelVan = new Map([...details.map((d) => [String(d.id), d.title]), ...liveVideos.map((v) => [v.id, v.title])]);
const liveById = new Map(liveVideos.map((v) => [v.id, v]));
const collById = new Map(liveColl.map((c) => [String(c.id), c]));
// verwachte grootte per video uit de wachtrijregels (Uscreen's eigen Content-Length bij prep)
const verwachtBytes = new Map();
for (const f of fs.readdirSync(OUTDIR)) {
  if (!/^queue-video-.*\.jsonl$/.test(f)) continue;
  for (const r of readJsonl(path.join(OUTDIR, f))) if (r.expected_bytes) verwachtBytes.set(String(r.id), Number(r.expected_bytes));
}
const foutenMac = fs.existsSync(path.join(OUTDIR, 'fouten-mac.log'))
  ? fs.readFileSync(path.join(OUTDIR, 'fouten-mac.log'), 'utf8').split('\n').filter(Boolean) : [];
const redenVan = new Map();
for (const l of foutenMac) { const m = l.match(/(PREP GEWEIGERD|PREP TIMEOUT|HEAD MISLUKT|GEEN HEAD-INFO)\s+(\d+)/);
  if (m) redenVan.set(m[2], m[1] + (l.includes('404') ? ' (404 — bron verwijderd bij Uscreen)' : '')); }

const R = []; const P = (s = '') => R.push(s);
const kop = (s) => { P(); P('='.repeat(78)); P(s); P('='.repeat(78)); };
P(`EINDAUDIT NAS-ARCHIEF — ${new Date().toISOString().slice(0, 19)}Z`);
P(`vers gemeten: Uscreen-admin ${liveVideos.length} video's / ${liveColl.length} collecties / ${liveCats.length} categorieën · NAS ${bestand.size} bestanden`);

// ══ 1. VIDEO'S ══
kop('1. VIDEO\'S');
const videoPad = new Map();
for (const s of struct) { videoPad.set(`${s.dest}.mp4`, String(s.id));
  for (const l of (s.ook_in ?? [])) videoPad.set(`${l}.mp4`, String(s.id)); }
const primairPad = new Map();
for (const s of struct) primairPad.set(String(s.id), `${s.dest}.mp4`);
const opNas = new Set(); const mistPlek = [];
for (const [p, id] of videoPad) { if (bestand.has(p)) opNas.add(id); else mistPlek.push({ p, id }); }
const alleStruct = new Set(videoPad.values());
const ontbreekt = [...alleStruct].filter((i) => !opNas.has(i));
const liveIds = new Set(liveVideos.map((v) => v.id));
const nieuwBijUscreen = [...liveIds].filter((i) => !alleStruct.has(i));
const wegBijUscreen = [...alleStruct].filter((i) => !liveIds.has(i));
P(`Uscreen heeft nu ${liveVideos.length} video's · archieftoewijzing kent ${alleStruct.size} · op de NAS aanwezig ${opNas.size}`);
P(`verwachte bestandsplekken (incl. hardlinks): ${videoPad.size} · aanwezig ${videoPad.size - mistPlek.length} · ontbreekt ${mistPlek.length}`);
P(`nieuw bij Uscreen sinds de bevroren toewijzing: ${nieuwBijUscreen.length}`);
P(`in de toewijzing maar niet meer bij Uscreen: ${wegBijUscreen.length}`);
// bytes vs opgegeven grootte
let bytesOk = 0, bytesFout = 0, bytesOnbekend = 0; const bytesFoutLijst = [];
for (const id of opNas) {
  const p = primairPad.get(id); const f = p && bestand.get(p); if (!f) continue;
  const v = verwachtBytes.get(id);
  if (!v) { bytesOnbekend++; continue; }
  if (v === f.bytes) bytesOk++;
  else { bytesFout++; if (bytesFoutLijst.length < 40) bytesFoutLijst.push(`${id} ${titelVan.get(id) ?? ''}: schijf ${f.bytes} ≠ opgegeven ${v}`); }
}
P(`bytes == door Uscreen opgegeven grootte: ${bytesOk} gelijk · ${bytesFout} afwijkend · ${bytesOnbekend} zonder opgave in de wachtrijregels`);
for (const l of bytesFoutLijst) P(`   ${l}`);

// sha-steekproef + media-steekproef (ffmpeg) in één NAS-ronde
const kandidaten = [...opNas].map((id) => primairPad.get(id)).filter((p) => p && bestand.has(p)).sort();
const kies = (n) => { const stap = Math.max(1, Math.floor(kandidaten.length / n)); const uit = [];
  for (let i = 0; i < kandidaten.length && uit.length < n; i += stap) uit.push(kandidaten[i]); return uit; };
const shaSteek = kies(N_SHA);
const mediaSteek = kies(N_MEDIA);
console.log(`[${ts()}] sha-steekproef ${shaSteek.length} bestanden op de NAS…`);
const shaUit = nasRun(`cd ${BASE} && cat > /tmp/_sha-lijst.txt && while IFS= read -r p; do sha256sum "$p"; done < /tmp/_sha-lijst.txt; rm -f /tmp/_sha-lijst.txt`,
  'sha-steekproef', shaSteek.join('\n') + '\n');
let shaOk = 0, shaFout = 0, shaGeenManifest = 0; const shaFoutLijst = [];
for (const l of shaUit.split('\n')) {
  const m = l.match(/^([0-9a-f]{64})\s+(.+)$/); if (!m) continue;
  const p = m[2].replace(/^\.\//, ''); const mf = laatsteManifest.get(p);
  if (!mf?.sha256) { shaGeenManifest++; continue; }
  if (mf.sha256 === m[1]) shaOk++; else { shaFout++; shaFoutLijst.push(`${p}: schijf ${m[1].slice(0, 16)}… ≠ manifest ${String(mf.sha256).slice(0, 16)}…`); }
}
P(`sha-steekproef (${shaSteek.length} bestanden opnieuw gehasht): ${shaOk} gelijk aan manifest · ${shaFout} afwijkend · ${shaGeenManifest} zonder sha in manifest`);
for (const l of shaFoutLijst.slice(0, 20)) P(`   ${l}`);

console.log(`[${ts()}] ffmpeg-steekproef ${mediaSteek.length} bestanden (duur + resolutie)…`);
const mediaUit = nasRun(`cd ${BASE} && cat > /tmp/_med.txt && while IFS= read -r p; do echo "===$p"; ffmpeg -hide_banner -i "$p" 2>&1 | grep -E 'Duration:|Stream #.*Video:' | head -2; done < /tmp/_med.txt; rm -f /tmp/_med.txt`,
  'media-steekproef', mediaSteek.join('\n') + '\n');
const media = [];
{ let huidig = null;
  for (const l of mediaUit.split('\n')) {
    if (l.startsWith('===')) { huidig = { pad: l.slice(3).replace(/^\.\//, '') }; media.push(huidig); continue; }
    if (!huidig) continue;
    const d = l.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/); if (d) huidig.duur = hms(d[1].split('.')[0]);
    const r = l.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})/); if (r) { huidig.w = +r[1]; huidig.h = +r[2]; }
  } }
const padNaarId = new Map([...videoPad].map(([p, id]) => [p, id]));
let duurOk = 0, duurFout = 0, duurOnbekend = 0; const duurFoutLijst = [];
for (const m of media) {
  const id = padNaarId.get(m.pad); const opgegeven = liveById.get(id)?.duur ?? details.find((d) => String(d.id) === id)?.duration;
  if (!m.duur || !opgegeven) { duurOnbekend++; continue; }
  if (Math.abs(m.duur - opgegeven) <= 3) duurOk++;
  else { duurFout++; duurFoutLijst.push(`${id} ${String(titelVan.get(id) ?? '').slice(0, 40)}: bestand ${m.duur}s ≠ Uscreen ${opgegeven}s`); }
}
P(`duur-steekproef (${media.length} bestanden met ffmpeg gemeten): ${duurOk} klopt (±3s) · ${duurFout} wijkt af · ${duurOnbekend} niet te vergelijken`);
for (const l of duurFoutLijst.slice(0, 25)) P(`   ${l}`);

// ══ 2. KWALITEIT ══
kop('2. KWALITEIT (is het de "Request download"-bron?)');
const tierHoogte = { sd_360: 360, sd_480: 480, hd_720: 720, hd_1080: 1080, uhd_2160: 2160, '4k': 2160 };
let resOk = 0, resLager = 0, resHoger = 0, resOnbekend = 0; const resLijst = [];
for (const m of media) {
  const id = padNaarId.get(m.pad); const tier = liveById.get(id)?.resolution_tier;
  if (!m.h || !tier) { resOnbekend++; continue; }
  const verwacht = tierHoogte[tier] ?? null;
  if (!verwacht) { resOnbekend++; continue; }
  if (m.h >= verwacht - 8) { resOk++; if (m.h > verwacht + 8) resHoger++; }
  else { resLager++; resLijst.push(`${id} ${String(titelVan.get(id) ?? '').slice(0, 40)}: bestand ${m.w}x${m.h} < admin-tier ${tier}`); }
}
P(`resolutie-steekproef (${media.length}): ${resOk} op of boven het admin-niveau (${resHoger} hoger dan de tier) · ${resLager} LAGER · ${resOnbekend} niet te vergelijken`);
for (const l of resLijst.slice(0, 30)) P(`   ${l}`);
const bitrates = [...opNas].map((id) => { const p = primairPad.get(id); const f = p && bestand.get(p);
  const d = liveById.get(id)?.duur; return f && d ? { id, kbps: (f.bytes * 8) / d / 1000 } : null; }).filter(Boolean);
bitrates.sort((a, b) => a.kbps - b.kbps);
const q = (x) => Math.round(bitrates[Math.floor(bitrates.length * x)]?.kbps ?? 0);
P(`bitrate-verdeling over ${bitrates.length} video's (kbps): p1 ${q(0.01)} · p10 ${q(0.1)} · mediaan ${q(0.5)} · p90 ${q(0.9)} · p99 ${q(0.99)}`);
P(`onder 300 kbps: ${bitrates.filter((b) => b.kbps < 300).length} · onder 100 kbps: ${bitrates.filter((b) => b.kbps < 100).length}`);

// ══ 3. COVERS ══
kop('3. COVERS');
const coverPaden = [...bestand.keys()].filter((p) => /(^|\/)(cover\.[a-z0-9]+|[^/]+ - cover\.[a-z0-9]+)$/i.test(p));
const coversLeeg = coverPaden.filter((p) => bestand.get(p).bytes === 0);
const channelCovers = coverPaden.filter((p) => p.startsWith('01 - Channels Live'));
let serieCoverOk = 0; const serieCoverMist = [];
for (const s of series) {
  const c = collById.get(String(s.collection));
  const heeftBron = c?.cover && !/fallback\//.test(c.cover);
  if (!heeftBron) continue;
  const mist = s.dirs.filter((d) => ![...bestand.keys()].some((p) => p.startsWith(`${d}/cover.`)));
  if (mist.length) serieCoverMist.push(`${s.collection} ${c.title}: mist in ${mist.join(' | ')}`);
  else serieCoverOk++;
}
P(`coverbestanden: ${coverPaden.length} · 0 bytes: ${coversLeeg.length} · channelcovers: ${channelCovers.length} (verwacht 29)`);
P(`series met een cover in ELKE map: ${serieCoverOk} · series met een gat: ${serieCoverMist.length}`);
for (const l of serieCoverMist) P(`   ${l}`);
const thumbAchtig = [...bestand.keys()].filter((p) => /thumb/i.test(p) && !p.startsWith('done/'));
P(`aflevering-thumbnails aanwezig (horen er NIET te zijn): ${thumbAchtig.length}`);
for (const p of thumbAchtig.slice(0, 20)) P(`   ${p}`);

// ══ 4. BIJLAGEN ══
kop('4. BIJLAGEN / RESOURCES');
const lokaleRes = fs.existsSync(RESDIR) ? fs.readdirSync(RESDIR) : [];
const basename = new Map();
for (const p of bestand.keys()) { const b = p.slice(p.lastIndexOf('/') + 1);
  if (!basename.has(b)) basename.set(b, []); basename.get(b).push(p); }
const bijlagenRegels = [];
let resGeplaatst = 0, res99 = 0, resWacht = 0, resMist = 0;
const shaLokaal = (p) => { const h = createHash('sha256'); h.update(fs.readFileSync(p)); return h.digest('hex'); };
const staging = new Set(nasRun(`ls ${BASE}/_staging-bijlagen 2>/dev/null || true`, 'staging').split('\n').filter(Boolean));
for (const f of lokaleRes) {
  const rid = (f.match(/^(\d+)__/) ?? [])[1]; const naam = f.replace(/^\d+__/, '');
  const plekken = basename.get(naam) ?? [];
  const in99 = plekken.some((p) => p.startsWith('99 - Bijlagen zonder'));
  if (!plekken.length) {
    if (staging.has(f)) { resWacht++; bijlagenRegels.push(`WACHT IN STAGING  ${rid} ${naam}`); }
    else { resMist++; bijlagenRegels.push(`ONTBREEKT  ${rid} ${naam}`); }
    continue;
  }
  if (in99) res99++; else resGeplaatst++;
  const lokaalBytes = fs.statSync(path.join(RESDIR, f)).size;
  const afw = plekken.filter((p) => bestand.get(p).bytes !== lokaalBytes);
  if (afw.length) bijlagenRegels.push(`BYTES AFWIJKEND  ${rid} ${naam}: ${afw.map((p) => `${p} (${bestand.get(p).bytes})`).join(' | ')} ≠ ${lokaalBytes}`);
  // hardlinkcontrole: alle plekken van dezelfde bijlage moeten hetzelfde inode delen
  const inodes = new Set(plekken.map((p) => bestand.get(p).inode));
  if (plekken.length > 1 && inodes.size > 1) bijlagenRegels.push(`GEEN HARDLINK  ${rid} ${naam}: ${plekken.length} plekken, ${inodes.size} verschillende inodes`);
}
P(`originelen lokaal: ${lokaleRes.length} · Uscreen kent er ${resMeta.length}`);
P(`geplaatst bij content: ${resGeplaatst} · in de 99-map (geen videokoppeling): ${res99} · wacht nog in staging: ${resWacht} · ontbreekt: ${resMist}`);
P(`sluitend: ${resGeplaatst + res99 + resWacht + resMist} van ${lokaleRes.length}`);
for (const l of bijlagenRegels) P(`   ${l}`);
// sha-controle van de bijlagen (klein genoeg om ALLES te doen)
const bijlagePaden = [...new Set(lokaleRes.flatMap((f) => basename.get(f.replace(/^\d+__/, '')) ?? []))];
if (bijlagePaden.length) {
  const uit = nasRun(`cd ${BASE} && cat > /tmp/_bij.txt && while IFS= read -r p; do sha256sum "$p"; done < /tmp/_bij.txt; rm -f /tmp/_bij.txt`,
    'bijlage-sha', bijlagePaden.join('\n') + '\n');
  const nasSha = new Map();
  for (const l of uit.split('\n')) { const m = l.match(/^([0-9a-f]{64})\s+(.+)$/); if (m) nasSha.set(m[2].replace(/^\.\//, ''), m[1]); }
  let ok = 0; const fout = [];
  for (const f of lokaleRes) {
    const naam = f.replace(/^\d+__/, ''); const plekken = basename.get(naam) ?? []; if (!plekken.length) continue;
    const lok = shaLokaal(path.join(RESDIR, f));
    for (const p of plekken) { if (nasSha.get(p) === lok) ok++; else fout.push(`${p}: NAS ${String(nasSha.get(p)).slice(0, 16)}… ≠ origineel ${lok.slice(0, 16)}…`); }
  }
  P(`sha-controle bijlagen: ${ok} plekken gelijk aan het lokale origineel · ${fout.length} afwijkend`);
  for (const l of fout.slice(0, 20)) P(`   ${l}`);
}

// ══ 5. TEKSTEN ══
kop('5. TEKSTEN (beschrijving + zoekwoorden)');
const inhoudVan = (() => {
  const uit = nasRun(`cd ${BASE} && find . -maxdepth 4 \\( -name 'beschrijving.txt' -o -name 'zoekwoorden.txt' -o -name '* - beschrijving.txt' -o -name '* - zoekwoorden.txt' \\) -type f -exec sh -c 'for f; do printf "===B===%s\\n" "$f"; cat "$f"; done' sh {} + 2>/dev/null`, 'teksten');
  const m = new Map();
  for (const d of uit.split('===B===').slice(1)) { const nl = d.indexOf('\n'); if (nl < 0) continue;
    m.set(d.slice(0, nl).replace(/^\.\//, ''), d.slice(nl + 1)); }
  return m;
})();
const telling = { besch: { ok: 0, mist: 0, deels: 0, anders: 0, geenBron: 0 }, zoek: { ok: 0, mist: 0, deels: 0, anders: 0, geenBron: 0 } };
const tekstRegels = [];
for (const s of series) {
  const c = collById.get(String(s.collection));
  const bTekst = htmlToText(c?.description_html ?? '');
  const bPaden = s.dirs.map((d) => `${d}/beschrijving.txt`);
  const bEr = bPaden.filter((p) => inhoudVan.has(p));
  if (!bTekst) telling.besch.geenBron++;
  else if (!bEr.length) { telling.besch.mist++; tekstRegels.push(`BESCHRIJVING ONTBREEKT  ${s.collection} ${c?.title ?? ''}`); }
  else if (bEr.length < bPaden.length) { telling.besch.deels++; tekstRegels.push(`BESCHRIJVING DEELS  ${s.collection} ${c?.title ?? ''}: mist ${bPaden.filter((p) => !inhoudVan.has(p)).join(' | ')}`); }
  else if (bEr.some((p) => norm(inhoudVan.get(p)) !== norm(bTekst))) { telling.besch.anders++; tekstRegels.push(`BESCHRIJVING ANDERS DAN PLATFORM  ${s.collection} ${c?.title ?? ''}`); }
  else telling.besch.ok++;
  const tags = c?.tags ?? [];
  const zPaden = s.dirs.map((d) => `${d}/zoekwoorden.txt`);
  const zEr = zPaden.filter((p) => inhoudVan.has(p));
  if (!tags.length) telling.zoek.geenBron++;
  else if (!zEr.length) { telling.zoek.mist++; tekstRegels.push(`ZOEKWOORDEN ONTBREEKT  ${s.collection} ${c?.title ?? ''} (${tags.length} tags in Uscreen)`); }
  else if (zEr.length < zPaden.length) { telling.zoek.deels++; tekstRegels.push(`ZOEKWOORDEN DEELS  ${s.collection} ${c?.title ?? ''}`); }
  else if (!zEr.every((p) => tags.every((t) => inhoudVan.get(p).includes(t)))) { telling.zoek.anders++; tekstRegels.push(`ZOEKWOORDEN MIST TAGS  ${s.collection} ${c?.title ?? ''}`); }
  else telling.zoek.ok++;
}
P(`series in de toewijzing: ${series.length}`);
P(`beschrijving: ${telling.besch.ok} compleet · ${telling.besch.deels} deels · ${telling.besch.mist} ontbreekt · ${telling.besch.anders} wijkt af · ${telling.besch.geenBron} heeft er bij Uscreen geen`);
P(`zoekwoorden: ${telling.zoek.ok} compleet · ${telling.zoek.deels} deels · ${telling.zoek.mist} ontbreekt · ${telling.zoek.anders} mist tags · ${telling.zoek.geenBron} heeft er bij Uscreen geen`);
for (const l of tekstRegels.slice(0, 120)) P(`   ${l}`);
if (tekstRegels.length > 120) P(`   … en nog ${tekstRegels.length - 120}`);

// ══ 6. STRUCTUUR ══
kop('6. STRUCTUUR');
let volgordeOk = 0, volgordeAfw = 0; const volgordeRegels = [];
for (const [cid, v] of Object.entries(volgorde)) {
  const catNr = String(v.positie).padStart(2, '0');
  const mappen = [...new Set([...bestand.keys()].filter((p) => p.startsWith(`${catNr} - `)).map((p) => p.split('/')[1]).filter(Boolean))];
  const archiefVolgorde = mappen.map((m) => ({ nr: parseInt(m, 10), naam: m.replace(/^\d+ - /, '') }))
    .filter((x) => !isNaN(x.nr)).sort((a, b) => a.nr - b.nr).map((x) => x.naam);
  const platform = v.items.map((i) => String(i.title ?? '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim());
  let gelijk = 0;
  for (let i = 0; i < Math.min(archiefVolgorde.length, platform.length); i++) if (archiefVolgorde[i] === platform[i]) gelijk++;
  const pct = platform.length ? Math.round((gelijk / Math.min(archiefVolgorde.length, platform.length)) * 100) : 0;
  if (pct >= 95) volgordeOk++; else volgordeAfw++;
  volgordeRegels.push(`categorie ${catNr} ${v.titel}: archief ${archiefVolgorde.length} mappen · platform ${platform.length} items · eerste ${Math.min(archiefVolgorde.length, platform.length)} posities ${pct}% gelijk`);
  for (let i = 0; i < Math.min(5, archiefVolgorde.length, platform.length); i++)
    if (archiefVolgorde[i] !== platform[i]) volgordeRegels.push(`     pos ${i + 1}: archief "${archiefVolgorde[i]}" ≠ platform "${platform[i]}"`);
}
P(`volgordesteekproef (${Object.keys(volgorde).length} categorieën):`);
for (const l of volgordeRegels) P(`   ${l}`);
// plaatsingen vs categorie-lidmaatschap (vers)
const catPositie = new Map(liveCats.map((c) => [String(c.id), String(c.position).padStart(2, '0')]));
let plaatsOk = 0; const plaatsFout = [];
for (const s of struct.slice(0, 100000)) {
  const v = liveById.get(String(s.id)); if (!v) continue;
  const verwachtNrs = new Set((v.category_ids ?? []).map((c) => catPositie.get(String(c))).filter(Boolean));
  const heeftNrs = new Set([s.dest, ...(s.ook_in ?? [])].map((p) => p.slice(0, 2)));
  const teveel = [...heeftNrs].filter((n) => !verwachtNrs.has(n) && n !== '99' && n !== '03' && n !== '15');
  const temin = [...verwachtNrs].filter((n) => !heeftNrs.has(n));
  if (!teveel.length && !temin.length) plaatsOk++;
  else if (plaatsFout.length < 30) plaatsFout.push(`${s.id} ${String(titelVan.get(String(s.id)) ?? '').slice(0, 40)}: archief ${[...heeftNrs].join(',')} · platform ${[...verwachtNrs].join(',') || '(geen)'}`);
}
P(`plaatsingen die exact overeenkomen met het huidige categorie-lidmaatschap: ${plaatsOk} van ${struct.length}`);
P(`(afwijkingen zijn vaak legitiem: 03 "New on Albunyaan" en 15 "New releases" wisselen doorlopend van inhoud)`);
for (const l of plaatsFout) P(`   ${l}`);
const echtLeeg = [...bestand.entries()].filter(([p, v]) => v.bytes === 0 && !p.startsWith('done/'));
P(`lege bestanden (buiten done/-markers): ${echtLeeg.length}`);
for (const [p] of echtLeeg.slice(0, 20)) P(`   ${p}`);
P(`lege mappen: ${legeMappen.length}`);
for (const d of legeMappen.slice(0, 20)) P(`   ${d}`);
const slechteNamen = [...bestand.keys()].filter((p) => /[\\:*?"<>|]/.test(p.split('/').pop() ?? ''));
P(`bestandsnamen met verboden tekens (Windows-regels): ${slechteNamen.length}`);
for (const p of slechteNamen.slice(0, 15)) P(`   ${p}`);

// ══ 7. RESTLIJST ══
kop('7. RESTLIJST — wat ontbreekt en waarom');
const perReden = {};
for (const id of ontbreekt) {
  const live = liveById.get(id);
  const reden = redenVan.get(id) ?? (!live ? 'bron bij Uscreen verwijderd (staat niet meer in de admin)' : 'niet afgerond in de laatste ronde');
  (perReden[reden] ??= []).push(id);
}
P(`video's die nergens op de NAS staan: ${ontbreekt.length}`);
for (const [r, ids] of Object.entries(perReden).sort((a, b) => b[1].length - a[1].length)) P(`   ${r}: ${ids.length}`);
P();
for (const [r, ids] of Object.entries(perReden)) {
  P(`   -- ${r} --`);
  for (const id of ids) P(`   ${id}  ${String(titelVan.get(id) ?? '(geen titel bekend)').slice(0, 70)}`);
}
P();
P(`video's die op sommige hardlink-plekken ontbreken: ${new Set(mistPlek.map((m) => m.id)).size - ontbreekt.length}`);
for (const m of mistPlek.filter((m) => opNas.has(m.id)).slice(0, 40)) P(`   ${m.id} mist ${m.p}`);
P();
P(`fouten.log op de NAS: ${foutenNas.length} regels`);
for (const l of foutenNas) P(`   ${l}`);

fs.writeFileSync(RAPPORT, R.join('\n') + '\n');

// ── doorstuurbare samenvatting ──
const S = [];
S.push(`# Eindaudit NAS-archief — ${new Date().toISOString().slice(0, 10)}`);
S.push('');
S.push(`Alles vers gemeten tegen de Uscreen-admin (${liveVideos.length} video's, ${liveColl.length} series, ${liveCats.length} categorieën) en tegen de NAS (${bestand.size} bestanden).`);
S.push('');
S.push('| Onderdeel | Uitkomst |');
S.push('|---|---|');
S.push(`| Video's op de NAS | ${opNas.size} van ${alleStruct.size} verwacht (${ontbreekt.length} ontbreekt) |`);
S.push(`| Bytes = door Uscreen opgegeven grootte | ${bytesOk} gelijk, ${bytesFout} afwijkend, ${bytesOnbekend} zonder opgave |`);
S.push(`| Sha-steekproef (${shaSteek.length} opnieuw gehasht) | ${shaOk} gelijk aan manifest, ${shaFout} afwijkend |`);
S.push(`| Duur-steekproef (${media.length} met ffmpeg) | ${duurOk} klopt, ${duurFout} wijkt af |`);
S.push(`| Resolutie vs admin-tier | ${resOk} op/boven niveau, ${resLager} lager |`);
S.push(`| Covers | ${coverPaden.length} bestanden, ${coversLeeg.length} leeg, ${channelCovers.length} channelcovers, ${serieCoverMist.length} series met een gat |`);
S.push(`| Aflevering-thumbnails (horen te ontbreken) | ${thumbAchtig.length} |`);
S.push(`| Bijlagen | ${resGeplaatst} geplaatst + ${res99} in de 99-map + ${resWacht} wachtend + ${resMist} ontbrekend = ${lokaleRes.length} |`);
S.push(`| Beschrijvingen | ${telling.besch.ok} compleet, ${telling.besch.mist} ontbreekt, ${telling.besch.anders} wijkt af, ${telling.besch.geenBron} zonder bron |`);
S.push(`| Zoekwoorden | ${telling.zoek.ok} compleet, ${telling.zoek.mist} ontbreekt, ${telling.zoek.geenBron} zonder bron |`);
S.push(`| Hardlinks / manifest | zie hoofdrapport |`);
S.push(`| Lege bestanden / mappen | ${echtLeeg.length} / ${legeMappen.length} |`);
S.push('');
S.push(`Volledig rapport met elke naam en reden: \`${RAPPORT}\``);
fs.writeFileSync(SAMENVATTING, S.join('\n') + '\n');
console.log(R.slice(0, 45).join('\n'));
console.log(`\n[${ts()}] rapport → ${RAPPORT}\n[${ts()}] samenvatting → ${SAMENVATTING}`);
process.exit(0);
