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
 *
 * Tempo (C7, RV 1 → founder-ja 2026-09-04, T2): minimaal 1.800 ms tussen twee Uscreen-calls,
 * afgedwongen in api() zelf (de losse sleeps in de lussen zijn extra marge, pre-existing, geen
 * verdubbeling: api() wacht alleen het restant). De waarde is de harvest-politeness uit CLAUDE.md
 * (migrate-videos.ts: 1,8 s ná een volledige admin-paginalaad) — hier zijn het losse XHR-calls, dus
 * dit is een bovengrens, bewust conservatief; op 2026-09-03 gaf Uscreen 500 en 429 na een dag vol
 * audit- en wachterrondes op 70–130 ms. Gevolg: een verse oogst duurt ≈ 45–60 min (≈ 1.450 calls).
 *   → altijd in de achtergrond draaien met logbestand (een voorgrond-aanroep vanuit Claude Code
 *     sterft op de 10-min-limiet): nohup node audit-volledig.mjs > ~/.albunyaan-cc/archief/audit/run.log 2>&1 &
 *   → niet starten tussen 03:30 en 04:45 (wachter) en niet terwijl iemand in de twin Chrome werkt.
 * 429 = tempo-limiet, GEEN sessieverlies: 90 s wachten en dezelfde call herhalen (max 3 keer per
 * run); daarna Stop429 → één uitgang: streams dicht, tijdelijke oogstbestanden weg, exit 3 (bewust
 * gestopt, niet "founder moet inloggen"). 5xx en netwerkfouten (abort/Failed to fetch): twee
 * herkansingen (5 s, 10 s), daarna de harde stop — óók voor een collectie-detail: een oogst met
 * één foutrij krijgt géén marker. Retry-After van Uscreen wordt gelogd (B60: meten), niet gevolgd.
 * Oogst is atomair (C1): *.tmp + rename + marker audit/oogst-klaar.json (met tellingen); de oude
 * marker gaat weg vóór de renames. --hergebruik en as6-plan.mjs weigeren zonder marker én als de
 * tellingen in de marker niet met de bestanden kloppen — een afgebroken of gemengde oogst kan dus
 * nooit stil als meting gelden.
 * Exitcodes: 0 klaar · 1 NAS-/oogstfout (ook 5xx op de proef-call) of oogst-marker ontbreekt/klopt niet ·
 * 2 Uscreen-sessie ongeldig (401/403/leeg op de proef-call) · 3 Uscreen 429 blijft (bewust gestopt) ·
 * 4 Chrome onbereikbaar.
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
const POLITENESS_MS = 1800;   // C7 (zie kop)
const WACHT_429_MS = 90_000;  // C7 (zie kop)
const MAX_429 = 3;            // C7: wachtbeurten per run; daarna Stop429
const MAX_5XX = 2;            // C7: herkansingen per call bij 5xx / netwerkfout (5 s, 10 s)
const MAX_TABS = 3;           // pre-existing: pogingen bij tabverlies
const MARKER = path.join(AUD, 'oogst-klaar.json');   // C1: alleen aanwezig als de oogst compleet is
const OOGST = ['videos.jsonl', 'categorieen.json', 'collecties.jsonl'];   // C1: de drie oogstbestanden
class Stop429 extends Error {}

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
    // C2: eerst de nieuwe tab, dán de oude sluiten — nooit de laatste pagina van de gedeelde Chrome sluiten
    const oude = page;
    page = await ctx.newPage();
    try { if (!oude.isClosed()) await oude.close(); } catch { /* al weg */ }
    await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
  };
  const apiRuw = (pad, body) => page.evaluate(async ([pad, body]) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 45000);
    try {
      const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: ac.signal });
      return r.ok ? await r.json() : { __err: r.status, ra: r.headers.get('retry-after') };
    } catch (e) { return { __err: String(e.message || e).slice(0, 100) }; } finally { clearTimeout(t); }
  }, [pad, body]);
  // Tempo en herkansingen zitten hier, in de enige weg naar Uscreen (C7):
  //  - minimaal POLITENESS_MS sinds de vorige call, ook over faseovergangen heen;
  //  - tabverlies: nieuwe tab en opnieuw (max 3);  429: wachten en opnieuw (max MAX_429 per run);
  //    5xx: 5 s / 10 s en opnieuw (max 2). Alles via `continue`, zodat elke herhaling weer
  //    door dezelfde try/catch loopt (de tab kan in het 90 s-venster door TAB-GC weg zijn).
  // 5xx en netwerkfouten (45 s-abort, 'Failed to fetch') zijn tijdelijk; 4xx en parse-fouten niet.
  const tijdelijk = (st) => /^5\d\d$/.test(st) || /aborted|Failed to fetch|NetworkError|Load failed/i.test(st);
  let laatste = 0; let n429 = 0;
  const api = async (pad, body) => {
    let tabs = 0; let n5xx = 0;
    for (;;) {
      const w = laatste + POLITENESS_MS - Date.now();
      if (w > 0) await sleep(w);
      let r;
      try { r = await apiRuw(pad, body); } catch (e) {
        if (++tabs >= MAX_TABS) throw e;
        log('  pagina kwijt — nieuwe tab'); await nieuwePagina(); continue;
      } finally { laatste = Date.now(); }
      const st = String(r.__err ?? '');
      if (st === '429') {
        if (++n429 > MAX_429) throw new Stop429(`Uscreen 429 blijft na ${MAX_429} wachtbeurten (${pad} ${JSON.stringify(body)})`);
        log(`  Uscreen 429 (tempo-limiet) op ${pad} ${JSON.stringify(body)} — Retry-After=${r.ra ?? '-'} — ${WACHT_429_MS / 1000} s wachten (beurt ${n429}/${MAX_429})`);
        await sleep(WACHT_429_MS); continue;
      }
      if (tijdelijk(st) && n5xx < MAX_5XX) {
        n5xx++;
        log(`  Uscreen ${st.slice(0, 60)} op ${pad} ${JSON.stringify(body)} — herkansing ${n5xx}/${MAX_5XX} na ${n5xx * 5} s`);
        await sleep(n5xx * 5000); continue;
      }
      return r;
    }
  };

  // C1: alles eerst naar *.tmp; pas na een complete oogst rename + marker. Een afgebroken run
  // laat de vorige oogst (en haar marker) intact.
  const tmp = (naam) => path.join(AUD, naam + '.tmp');
  const geopend = [];
  const sluitTab = async () => { try { if (ctx.pages().length > 1) await page.close(); } catch { /* laat de laatste tab met rust */ } };
  const start = Date.now();
  try {
  const proef = await api('videos.index', { page: 1 });
  if (proef.__err && tijdelijk(String(proef.__err))) throw new Error(`videos.index p1: ${proef.__err} (Uscreen-/netwerkfout, geen sessieprobleem)`);
  if (proef.__err || !(proef.videos ?? []).length) {
    await sluitTab();
    console.error(`Uscreen-sessie ongeldig (${proef.__err ?? 'leeg antwoord'}) — founder moet inloggen.`);
    process.exit(2);
  }
  log('sessie OK');

  // video's
  const vOut = fs.createWriteStream(tmp('videos.jsonl'), { flags: 'w' }); geopend.push(vOut);
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
    await sleep(POLITENESS_MS);
  }
  vOut.end(); await new Promise((r) => vOut.on('finish', r));
  log(`VIDEO'S: ${nV}`);

  // categorieën + hun items
  const cj = await api('categories.index', { page: 1 });
  if (cj.__err) throw new Error(`categories.index: ${cj.__err}`);
  const cats = [];
  for (const c of (cj.categories ?? [])) {
    const items = [];
    for (let p = 1; p <= 100; p++) {
      const j = await api('categories.show', { id: Number(c.id), page: p });
      if (j.__err) throw new Error(`categories.show ${c.id} p${p}: ${j.__err}`);
      const rows = j.items ?? j.category_items ?? j.contents ?? [];
      for (const it of rows) items.push({ id: String(it.id ?? ''), position: it.position ?? null, title: it.title ?? null });
      if (!rows.length || j.pagination?.is_last_page) break;
      await sleep(POLITENESS_MS);
    }
    cats.push({ id: String(c.id), title: c.title, position: c.position, published: c.published, items });
    await sleep(POLITENESS_MS);
  }
  fs.writeFileSync(tmp('categorieen.json'), JSON.stringify(cats, null, 1));
  log(`CATEGORIEËN: ${cats.length}`);

  // collecties + leden
  const idx = [];
  for (let p = 1; p <= 200; p++) {
    const j = await api('contents_collections.index', { page: p, sort: 'created_at[desc]' });
    if (j.__err) throw new Error(`collections.index p${p}: ${j.__err}`);
    for (const c of (j.collections ?? [])) idx.push({ id: String(c.id), title: c.title, status: c.status });
    const tot = j.pagination?.total_pages;
    if (!(j.collections ?? []).length || (tot && p >= tot)) break;
    await sleep(POLITENESS_MS);
  }
  const cOut = fs.createWriteStream(tmp('collecties.jsonl'), { flags: 'w' }); geopend.push(cOut);
  let n = 0; let nFout = 0;
  for (const c of idx) {
    const j = await api('contents_collections.details', { id: Number(c.id) });
    const k = j.collection;
    if (j.__err || !k) { nFout++; cOut.write(JSON.stringify({ ...c, __err: j.__err ?? 'geen collection' }) + '\n'); }
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
    await sleep(POLITENESS_MS);
  }
  cOut.end(); await new Promise((r) => cOut.on('finish', r));
  log(`COLLECTIES: ${n}`);
  // compleet = foutloos: één collectie zonder details is geen meting (drempel 0, aanname — aanpasbaar)
  if (nFout || !cats.length) throw new Error(`oogst onvolledig: ${nFout} collectie(s) met fout, ${cats.length} categorieën — geen marker`);
  // tmp → definitief, dan de marker (C1). Oude marker eerst weg: een kill halverwege de renames laat
  // dan een oogst zónder marker achter (weigering), nooit een gemengde oogst mét marker.
  fs.rmSync(MARKER, { force: true });
  for (const naam of OOGST) fs.renameSync(tmp(naam), path.join(AUD, naam));
  fs.writeFileSync(MARKER, JSON.stringify({ klaar_op: new Date().toISOString(), duur_s: Math.round((Date.now() - start) / 1000),
    videos: nV, categorieen: cats.length, collecties: n, collecties_fout: nFout, politeness_ms: POLITENESS_MS, wachtbeurten_429: n429 }, null, 1));
  log(`oogst compleet in ${Math.round((Date.now() - start) / 60000)} min — marker geschreven`);
  await sluitTab();
  } catch (e) {
    // Eén uitgang voor elke afbreking in de oogst: streams dicht, tijdelijke bestanden weg, tab dicht.
    // De vorige oogst + marker blijven staan; --hergebruik meet dus nooit op een halve oogst.
    for (const s of geopend) { try { s.destroy(); } catch { /* al dicht */ } }
    for (const naam of OOGST) fs.rmSync(tmp(naam), { force: true });
    await sluitTab();
    if (e instanceof Stop429) { console.error(`[${ts()}] ${e.message} — audit bewust gestopt (exit 3); vorige oogst intact, later opnieuw`); process.exit(3); }
    console.error(`[${ts()}] oogst afgebroken: ${String(e.message || e).slice(0, 200)} — vorige oogst intact (exit 1)`); process.exit(1);
  }
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
if (!fs.existsSync(MARKER)) {
  console.error(`oogst-marker ontbreekt (${MARKER}) — de vorige oogst was onvolledig of is nooit gemaakt; draai zonder --hergebruik`);
  process.exit(1);
}
const oogstInfo = JSON.parse(fs.readFileSync(MARKER, 'utf8'));

const videos = readJsonl(path.join(AUD, 'videos.jsonl'));
const cols = readJsonl(path.join(AUD, 'collecties.jsonl'));
const cats = JSON.parse(fs.readFileSync(path.join(AUD, 'categorieen.json'), 'utf8'));
if (videos.length !== oogstInfo.videos || cols.length !== oogstInfo.collecties || cats.length !== oogstInfo.categorieen || oogstInfo.collecties_fout) {
  console.error(`oogst-bestanden ≠ marker (video's ${videos.length}/${oogstInfo.videos} · collecties ${cols.length}/${oogstInfo.collecties} · categorieën ${cats.length}/${oogstInfo.categorieen} · foutrijen ${oogstInfo.collecties_fout ?? '?'}) — gemengde of beschadigde oogst; draai zonder --hergebruik`);
  process.exit(1);
}
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
p(`Uscreen-oogst van ${oogstInfo.klaar_op} (${oogstInfo.videos} video's · ${oogstInfo.categorieen} categorieën · ${oogstInfo.collecties} collecties${HERGEBRUIK ? ' — HERGEBRUIKT' : ''})`);
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
