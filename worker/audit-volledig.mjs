/**
 * audit-volledig.mjs — 12-assige reconciliatie Uscreen <-> NAS-archief (2026-09-02).
 *
 * WAAROM DIT BESTAAT: we vonden drie keer op rij een gat dat de vorige controle
 * niet zag, omdat elke controle een andere VRAAG stelde:
 *   31-08  "staat elke video op de NAS?"          -> ja, 16.024 = 16.024
 *   01-09  "heeft elke collectie een map?"        -> nee, 17 misten er een
 *   02-09  "staat die map in de juiste categorie?"-> nee, 48 stonden fout
 * Elke meting klopte; de vraag was te smal. Dit script stelt ALLE vragen tegelijk
 * en is daarmee het enige audit-gereedschap. Nieuwe as erbij? Hier toevoegen,
 * niet ad hoc ernaast.
 *
 * ALLEEN LEZEN. Schrijft uitsluitend rapport + werklijst in ~/.albunyaan-cc/archief/audit/.
 *
 *   node audit-volledig.mjs                # alles vers ophalen en meten
 *   node audit-volledig.mjs --hergebruik   # Uscreen-oogst hergebruiken (NAS wel vers)
 *   node audit-volledig.mjs --snel         # assen 7/11/12 overslaan (die zijn duur)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT = path.join(CC, 'archief');
const AUD = path.join(OUT, 'audit');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const CDP = process.env.CHROME_CDP || '9333';
const HERGEBRUIK = process.argv.includes('--hergebruik');
const SNEL = process.argv.includes('--snel');

fs.mkdirSync(AUD, { recursive: true });
const ts = () => new Date().toISOString().slice(11, 19);
const log = (s) => console.log(`[${ts()}] ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJsonl = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];

function nas(cmd, label) {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=25', NAS, cmd],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, timeout: 45 * 60_000 });
  if (r.status !== 0) { console.error(`NAS ${label} mislukt: ${(r.stderr || '').slice(0, 300)}`); process.exit(1); }
  return r.stdout;
}

// ═══ verse oogst uit de Uscreen-admin ═══
async function oogst() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`).catch((e) => {
    console.error(`Chrome op :${CDP} niet bereikbaar: ${e.message}`); process.exit(4);
  });
  const ctx = browser.contexts()[0];
  let page = await ctx.newPage();
  await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const nieuwePagina = async () => {
    try { if (!page.isClosed()) await page.close(); } catch { /* al weg */ }
    page = await ctx.newPage();
    await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
  };
  const apiRuw = (pad, body) => page.evaluate(async ([pad, body]) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 45000);
    try {
      const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: ac.signal });
      return r.ok ? await r.json() : { __err: r.status };
    } catch (e) { return { __err: String(e.message || e).slice(0, 100) }; } finally { clearTimeout(t); }
  }, [pad, body]);
  const api = async (pad, body) => {
    for (let p = 1; ; p++) {
      try { return await apiRuw(pad, body); } catch (e) {
        if (p >= 3) throw e;
        log('  pagina kwijt — nieuwe tab'); await nieuwePagina();
      }
    }
  };

  const proef = await api('videos.index', { page: 1 });
  if (proef.__err || !(proef.videos ?? []).length) {
    console.error(`Uscreen-sessie ongeldig (${proef.__err ?? 'leeg antwoord'}) — founder moet inloggen.`);
    process.exit(2);
  }
  log('sessie OK');

  // video's
  const vOut = fs.createWriteStream(path.join(AUD, 'videos.jsonl'), { flags: 'w' });
  let nV = 0;
  for (let p = 1; p <= 3000; p++) {
    const j = p === 1 ? proef : await api('videos.index', { page: p });
    if (j.__err) throw new Error(`videos.index p${p}: ${j.__err}`);
    const rows = j.videos ?? [];
    for (const v of rows) {
      vOut.write(JSON.stringify({ id: String(v.id), title: v.title, release_stage: v.release_stage,
        created_at: v.created_at ?? null, transcoded: v.transcoded ?? null,
        collection_ids: (v.collection_ids ?? []).map(String),
        category_ids: (v.category_ids ?? []).map(String) }) + '\n');
      nV++;
    }
    if (p % 100 === 0) log(`  video's: ${nV}`);
    if (!rows.length || j.pagination?.is_last_page) break;
    await sleep(90);
  }
  vOut.end(); await new Promise((r) => vOut.on('finish', r));
  log(`VIDEO'S: ${nV}`);

  // categorieën + hun items
  const cj = await api('categories.index', { page: 1 });
  const cats = [];
  for (const c of (cj.categories ?? [])) {
    const items = [];
    for (let p = 1; p <= 100; p++) {
      const j = await api('categories.show', { id: Number(c.id), page: p });
      if (j.__err) throw new Error(`categories.show ${c.id} p${p}: ${j.__err}`);
      const rows = j.items ?? j.category_items ?? j.contents ?? [];
      for (const it of rows) items.push({ id: String(it.id ?? ''), position: it.position ?? null, title: it.title ?? null });
      if (!rows.length || j.pagination?.is_last_page) break;
      await sleep(70);
    }
    cats.push({ id: String(c.id), title: c.title, position: c.position, published: c.published, items });
    await sleep(100);
  }
  fs.writeFileSync(path.join(AUD, 'categorieen.json'), JSON.stringify(cats, null, 1));
  log(`CATEGORIEËN: ${cats.length}`);

  // collecties + leden
  const idx = [];
  for (let p = 1; p <= 200; p++) {
    const j = await api('contents_collections.index', { page: p, sort: 'created_at[desc]' });
    if (j.__err) throw new Error(`collections.index p${p}: ${j.__err}`);
    for (const c of (j.collections ?? [])) idx.push({ id: String(c.id), title: c.title, status: c.status });
    const tot = j.pagination?.total_pages;
    if (!(j.collections ?? []).length || (tot && p >= tot)) break;
    await sleep(80);
  }
  const cOut = fs.createWriteStream(path.join(AUD, 'collecties.jsonl'), { flags: 'w' });
  let n = 0;
  for (const c of idx) {
    const j = await api('contents_collections.details', { id: Number(c.id) });
    const k = j.collection;
    if (j.__err || !k) { cOut.write(JSON.stringify({ ...c, __err: j.__err ?? 'geen collection' }) + '\n'); }
    else {
      const items = k.playlist_items ?? [];
      cOut.write(JSON.stringify({ id: String(k.id), title: k.title, meta_title: k.meta_title,
        status: c.status, release_stage: k.release_stage,
        beschr: Boolean(String(k.description ?? '').replace(/<[^>]*>/g, '').trim()),
        cover: Boolean(k.big_horizontal_image_url), tags: (k.tags ?? []).length,
        // LET OP: subject_id is het video-id; `id` is het playlist-item-id.
        // chapter_type "divider" = sectiekopje, GEEN video.
        items: items.map((it) => ({ video_id: it.subject_id ? String(it.subject_id) : null,
          type: it.chapter_type, position: it.position, title: it.title })) }) + '\n');
    }
    if (++n % 150 === 0) log(`  collecties: ${n}/${idx.length}`);
    await sleep(130);
  }
  cOut.end(); await new Promise((r) => cOut.on('finish', r));
  log(`COLLECTIES: ${n}`);
  try { await page.close(); } catch { /* laat de laatste tab met rust */ }
}

// ═══ NAS-toestand ═══
function nasScan() {
  log('NAS: bestandslijst + stat ophalen…');
  const txt = nas(`cd ${JSON.stringify(BASE)} && find . -mindepth 1 \\( -type f -o -type d \\) -exec stat -c "%s|%Y|%i|%h|%F|%n" {} \\;`, 'scan');
  fs.writeFileSync(path.join(AUD, 'nas-scan.txt'), txt);
  const bestanden = [], mappen = [];
  for (const l of txt.split('\n')) {
    if (!l.trim()) continue;
    const d = l.split('|');
    if (d.length < 6) continue;
    const rec = { bytes: +d[0], mtime: +d[1], inode: +d[2], nlink: +d[3],
      dir: d[4] === 'directory', pad: d.slice(5).join('|').replace(/^\.\//, '') };
    (rec.dir ? mappen : bestanden).push(rec);
  }
  log(`NAS: ${bestanden.length} bestanden · ${mappen.length} mappen`);
  return { bestanden, mappen };
}
let manifestOnleesbaar = [];   // regelnummers die geen geldige JSON zijn (AS 11c)
function nasManifest() {
  const txt = nas(`cat ${JSON.stringify(BASE + '/manifest.jsonl')}`, 'manifest');
  fs.writeFileSync(path.join(AUD, 'manifest.jsonl'), txt);
  // readJsonl slikt onleesbare regels stil; hier tellen we ze, want sinds 2026-09-03
  // appenden de NAS-loop en de extras-ingest zonder gedeelde lock (zie archive-extras.mjs)
  manifestOnleesbaar = txt.split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim())
    .filter(([l]) => { try { JSON.parse(l); return false; } catch { return true; } }).map(([, i]) => i);
  return readJsonl(path.join(AUD, 'manifest.jsonl'));
}
function nasRechten() {
  const txt = nas(`cd ${JSON.stringify(BASE)} && for d in */; do a=$(/usr/syno/bin/synoacltool -get "$PWD/$d" 2>&1 | head -2 | tail -1); printf "%s|%s|%s\\n" "$(stat -c '%A %U:%G' "$d")" "$a" "\${d%/}"; done`, 'rechten');
  fs.writeFileSync(path.join(AUD, 'rechten.txt'), txt);
  return txt.split('\n').filter(Boolean).map((l) => {
    const d = l.split('|');
    return { mode: d[0], acl: (d[1] || '').trim(), map: d.slice(2).join('|') };
  });
}

// ═══════════════════ HOOFDLOOP ═══════════════════
if (!HERGEBRUIK) await oogst(); else log('oogst overgeslagen (--hergebruik)');

const videos = readJsonl(path.join(AUD, 'videos.jsonl'));
const cols = readJsonl(path.join(AUD, 'collecties.jsonl'));
const cats = JSON.parse(fs.readFileSync(path.join(AUD, 'categorieen.json'), 'utf8'));
const { bestanden, mappen } = nasScan();
const man = nasManifest();
const rechten = nasRechten();

const struct = readJsonl(path.join(OUT, 'structuur.jsonl'));
const series = readJsonl(path.join(OUT, 'structuur-series.jsonl'));
const bewustLeegPad = path.join(OUT, 'collecties-bewust-leeg.txt');
const bewustLeeg = new Set(fs.existsSync(bewustLeegPad)
  ? fs.readFileSync(bewustLeegPad, 'utf8').split('\n').map((s) => s.split('#')[0].trim()).filter(Boolean) : []);

const plek = new Map(struct.map((r) => [String(r.id), [r.dest, ...(r.ook_in ?? [])]]));
const serieVan = new Map(series.map((s) => [String(s.collection), s]));
const padSet = new Set(bestanden.map((b) => b.pad));
const bestaat = (p) => padSet.has(p) || padSet.has(p + '.mp4');
const uscVid = new Map(videos.map((v) => [v.id, v]));
const colVan = new Map(cols.map((c) => [String(c.id), c]));
const catVanCollectie = new Map();
for (const c of cats) for (const it of c.items) {
  if (!catVanCollectie.has(it.id)) catVanCollectie.set(it.id, []);
  catVanCollectie.get(it.id).push(c.position);
}
const topmapVanNr = new Map();
for (const m of mappen) if (!m.pad.includes('/')) {
  const mm = m.pad.match(/^(\d+) - /);
  if (mm) topmapVanNr.set(+mm[1], m.pad);
}
const R = [];
const p = (s = '') => { R.push(s); console.log(s); };
const werk = {};
const info = {};   // meldingen die géén openstaand punt zijn (worden wel in werklijst.json bewaard, onder "_info")

p('='.repeat(80));
p(`VOLLEDIGE ARCHIEF-AUDIT — ${new Date().toISOString()}`);
p('='.repeat(80));

// ── AS 1: elke Uscreen-video heeft een bestand ──
const nasIds = new Set(man.filter((r) => r.kind === 'video').map((r) => String(r.id)));
const as1 = videos.filter((v) => !nasIds.has(v.id) || !(plek.get(v.id) ?? []).some(bestaat));
werk.as1_video_zonder_bestand = as1.map((v) => ({ id: v.id, titel: v.title, stage: v.release_stage }));
p(`\nAS 1  video's Uscreen/NAS : ${videos.length} / ${nasIds.size} · ontbreekt: ${as1.length}`);

// ── AS 2: elke collectie heeft een archiefmap ──
const as2 = cols.filter((c) => {
  const ids = (c.items ?? []).filter((i) => i.video_id);
  return !serieVan.has(String(c.id)) && !bewustLeeg.has(String(c.id)) && ids.length > 0;
});
werk.as2_collectie_zonder_map = as2.map((c) => ({ id: c.id, titel: c.title, afl: (c.items ?? []).filter((i) => i.video_id).length }));
p(`AS 2  collecties zonder archiefmap : ${as2.length}  (bewust leeg: ${bewustLeeg.size})`);

// ── AS 3: elke aflevering in de map van haar collectie ──
const as3 = [];
for (const c of cols) {
  const s = serieVan.get(String(c.id)); if (!s) continue;
  for (const it of (c.items ?? [])) {
    if (!it.video_id) continue;
    const pl = plek.get(it.video_id) ?? [];
    if (!pl.some((x) => s.dirs.some((d) => x.startsWith(d + '/')) && bestaat(x))) as3.push({ col: c.id, vid: it.video_id, titel: it.title });
  }
}
werk.as3_aflevering_buiten_eigen_map = as3;
p(`AS 3  afleveringen buiten hun eigen seriemap : ${as3.length}`);

// ── AS 4: seriemap in ELKE categorie waar Uscreen de collectie toont ──
const as4 = [];
for (const c of cols) {
  const s = serieVan.get(String(c.id)); if (!s) continue;
  const nrs = new Set(s.dirs.map((d) => +d.split(' - ')[0]));
  const mist = (catVanCollectie.get(String(c.id)) ?? []).filter((pos) => !nrs.has(pos));
  if (mist.length) as4.push({ id: c.id, titel: c.title, afl: s.eps.length,
    mist_categorieen: mist.map((x) => topmapVanNr.get(x) ?? String(x)), huidige_dirs: s.dirs });
}
werk.as4_collectie_niet_in_categorie = as4;
p(`AS 4  collecties niet in élke Uscreen-categorie : ${as4.length}  (${as4.reduce((a, x) => a + x.afl, 0)} afl.)`);

// ── AS 5: losse categorie-video's in hun categoriemap ──
const as5 = [];
for (const c of cats) for (const it of c.items) {
  if (colVan.has(it.id)) continue;               // collectie, valt onder as 4
  const v = uscVid.get(it.id); if (!v) continue; // geen video
  const pl = plek.get(it.id) ?? [];
  const nr = String(c.position).padStart(2, '0');
  if (!pl.some((x) => x.startsWith(nr + ' - ') && bestaat(x)))
    as5.push({ vid: it.id, titel: v.title, stage: v.release_stage, categorie: c.title, staat_nu: pl[0] ?? 'GEEN' });
}
werk.as5_losse_video_verkeerd_geplaatst = as5;
p(`AS 5  losse categorie-video's verkeerd geplaatst : ${as5.length}`);

// ── AS 6: afleveringvolgorde volgt Uscreen ──
// Definitie (founder 2026-09-03, plan §5 B30): elke video ÉÉN keer, EERSTE voorkomen, aaneengesloten genummerd.
// Uscreen toont in sommige collecties dezelfde video op twee posities (eigen playlist_item-id per positie;
// gemeten 03-09: 1897232 14×, 1896296 19×). Die dubbelen zijn geen afwijking van het archief en worden
// hieronder ALTIJD gemeld (ook als het er 0 zijn), zodat ontdubbelen nooit stil gebeurt.
const as6 = []; const as6dub = [];
for (const c of cols) {
  const s = serieVan.get(String(c.id)); if (!s) continue;
  const arch = new Map(s.eps.map((e) => [String(e.id), e.bestand]));
  const gezien = new Set(); const volg = []; let dubbel = 0;
  for (const i of (c.items ?? [])) {
    if (!i.video_id) continue;                       // divider
    if (gezien.has(i.video_id)) { dubbel++; continue; } // tweede keer dezelfde video: telt niet mee
    gezien.add(i.video_id);
    if (!arch.has(i.video_id)) continue;             // niet in het archief: as 1/3, niet as 6
    const m = String(arch.get(i.video_id)).match(/^\s*(\d+)\s*-/); volg.push(m ? +m[1] : null);
  }
  if (dubbel) as6dub.push({ id: c.id, titel: c.title, dubbel });
  if (volg.length < 2 || volg.some((x) => x === null)) continue;
  const fout = volg.filter((x, i) => x !== i + 1).length;
  if (fout) as6.push({ id: c.id, titel: c.title, afl: volg.length, posities_anders: fout, dirs: s.dirs.length });
}
werk.as6_volgorde_wijkt_af = as6;
info.as6_ontdubbeld = as6dub;                      // informatief, GEEN openstaand punt
p(`AS 6  series met afwijkende volgorde : ${as6.length}  (gevolg van de append-only regel van 11-08)`);
p(`AS 6  ontdubbeld op video_id         : ${as6dub.length} series, ${as6dub.reduce((a, x) => a + x.dubbel, 0)} dubbel getoonde items`
  + (as6dub.length ? ' — ' + as6dub.map((x) => `${x.id}: ${x.dubbel}`).join(', ') : ''));

// ── AS 7 + 11 + 12: NAS-kant ──
if (SNEL) {
  p('\nAS 7/11/12 overgeslagen (--snel)');
} else {
  const manPaden = new Map();
  for (const r of man) {
    if (r.dest) manPaden.set(r.dest, r);
    for (const lk of String(r.links ?? '').split('|')) if (lk) manPaden.set(lk, r);
  }
  // Werk- en administratiemappen horen niet bij de archiefinhoud. Expliciet
  // benoemd i.p.v. stilzwijgend weggefilterd: het aantal genegeerde bestanden
  // wordt gerapporteerd, zodat "0 afwijkingen" nooit een verborgen filter verbergt.
  const NEGEER_MAP = ['done/', '_lock/', '_oud-logs/', '_partial/', '_queue/',
    '_staging-bijlagen/', 'beeld/', 'video/'];
  const buitenArchief = (pad) => NEGEER_MAP.some((m) => pad.startsWith(m)) || !pad.includes('/');
  const genegeerd = bestanden.filter((b) => buitenArchief(b.pad)).length;
  p(`      (${genegeerd} bestanden in werk-/administratiemappen buiten beschouwing: ${NEGEER_MAP.join(' ')}en losse bestanden in de wortel)`);
  const media = bestanden.filter((b) => /\.(mp4|m4v|mov|mkv)$/i.test(b.pad) && !buitenArchief(b.pad));
  const as7 = media.filter((b) => !manPaden.has(b.pad))
    .map((b) => ({ pad: b.pad, bytes: b.bytes, inode: b.inode, nlink: b.nlink }));
  werk.as7_bestand_onbekend_bij_uscreen = as7;
  p(`\nAS 7  mediabestanden op de NAS die in geen enkele administratie staan : ${as7.length}` +
    (as7.length ? ` (${(as7.reduce((a, x) => a + x.bytes, 0) / 1e9).toFixed(1)} GB)` : ''));
  for (const x of as7.slice(0, 15)) p(`        ${(x.bytes / 1e6).toFixed(0)} MB  ${x.pad}`);

  const as11a = [...manPaden.keys()].filter((x) => !padSet.has(x));
  const as11b = bestanden.filter((b) => !manPaden.has(b.pad) && !buitenArchief(b.pad)).map((b) => b.pad);
  werk.as11a_manifestpad_bestaat_niet = as11a;
  werk.as11b_bestand_niet_in_manifest = as11b;
  werk.as11c_manifestregel_onleesbaar = manifestOnleesbaar;
  p(`AS 11 manifest -> bestandssysteem : ${as11a.length} ontbrekend · bestandssysteem -> manifest : ${as11b.length} ongeregistreerd · onleesbare manifestregels : ${manifestOnleesbaar.length}`);

  const inodeVan = new Map(bestanden.map((b) => [b.pad, b]));
  const as12 = [];
  for (const r of man) {
    if (r.kind !== 'video' || !r.dest) continue;
    const plekken = [r.dest, ...String(r.links ?? '').split('|').filter(Boolean)];
    const st = plekken.map((x) => inodeVan.get(x)).filter(Boolean);
    if (st.length !== plekken.length) { as12.push({ id: r.id, reden: 'pad ontbreekt', plekken }); continue; }
    const inodes = new Set(st.map((x) => x.inode));
    if (inodes.size !== 1) as12.push({ id: r.id, reden: 'plekken delen niet dezelfde inode', plekken });
    else if (st[0].nlink !== plekken.length) as12.push({ id: r.id, reden: `nlink=${st[0].nlink} maar ${plekken.length} plekken`, plekken });
  }
  werk.as12_hardlink_afwijking = as12;
  p(`AS 12 hardlink-integriteit : ${as12.length} afwijkingen`);
}

// ── AS 8: serie-metadata ──
const as8 = [];
for (const c of cols) {
  const s = serieVan.get(String(c.id)); if (!s) continue;
  const heeft = (naam) => s.dirs.some((d) => padSet.has(`${d}/${naam}`));
  if (c.beschr && !heeft('beschrijving.txt')) as8.push({ id: c.id, titel: c.title, mist: 'beschrijving.txt' });
  if (c.tags && !heeft('zoekwoorden.txt')) as8.push({ id: c.id, titel: c.title, mist: 'zoekwoorden.txt' });
  // LET OP: covers staan er als .jpg, .png EN .jpeg (5 stuks). Alleen op .jpg/.png
  // toetsen meldde die 5 ten onrechte als ontbrekend — en leverde duplicaten op.
  const heeftCover = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'].some(heeft);
  if (c.cover && !heeftCover) as8.push({ id: c.id, titel: c.title, mist: 'cover' });
}
werk.as8_metadata_ontbreekt = as8;
p(`AS 8  serie-metadata die Uscreen wel heeft maar het archief niet : ${as8.length}`);

// ── AS 9: categoriemappen ──
const as9 = cats.filter((c) => !topmapVanNr.has(c.position)).map((c) => ({ pos: c.position, titel: c.title }));
werk.as9_categoriemap_ontbreekt = as9;
p(`AS 9  categoriemappen ontbrekend : ${as9.length} van ${cats.length}`);

// ── AS 10: zichtbaarheid/rechten ──
const as10 = rechten.filter((r) => /Linux mode/i.test(r.acl));
werk.as10_topmap_zonder_acl = as10.map((r) => ({ map: r.map, mode: r.mode }));
p(`AS 10 topmappen zonder Synology-ACL (onzichtbaar via SMB) : ${as10.length} van ${rechten.length}`);
for (const r of as10.slice(0, 30)) p(`        ${r.mode}  ${r.map}`);

// ── uitkomst ──
const tel = Object.fromEntries(Object.entries(werk).map(([k, v]) => [k, v.length]));
const totaal = Object.values(tel).reduce((a, b) => a + b, 0);
p('\n' + '='.repeat(80));
p(`TOTAAL OPENSTAANDE PUNTEN: ${totaal}`);
for (const [k, v] of Object.entries(tel)) if (v) p(`   ${String(v).padStart(6)}  ${k}`);
if (!totaal) p('   Alle assen nul — archief is compleet én correct.');
fs.writeFileSync(path.join(AUD, 'werklijst.json'), JSON.stringify({ ...werk, _info: info }, null, 1));
fs.writeFileSync(path.join(AUD, 'AUDIT-VOLLEDIG.txt'), R.join('\n') + '\n');
p(`\nwerklijst -> ${path.join(AUD, 'werklijst.json')}`);
p(`rapport   -> ${path.join(AUD, 'AUDIT-VOLLEDIG.txt')}`);
