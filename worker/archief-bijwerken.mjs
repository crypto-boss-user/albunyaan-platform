/**
 * archief-bijwerken.mjs — nieuwe Uscreen-content automatisch bijzetten in het
 * NAS-archief (2026-08-26, op verzoek van de founder).
 *
 * Probleem dat dit oplost: `structuur.jsonl` is de BEVROREN toewijzing van
 * augustus. Alles wat Uscreen daarna publiceert (op 2026-08-24 al ~50 video's
 * en 18 collecties) heeft geen archiefplek en wordt door de pijplijn dus nooit
 * opgehaald. Deze wachter draait dagelijks en vult dat gat.
 *
 * NUMMERREGEL — ACHTERAAN TOEVOEGEN (bewuste keuze):
 * een nieuwe serie krijgt het eerstvolgende vrije nummer in haar categorie, een
 * nieuwe aflevering het eerstvolgende nummer in haar serie. Bestaande mappen
 * verschuiven NOOIT. Gevolg dat je moet weten: nieuwe items staan achteraan en
 * volgen dus niet de volgorde van het platform. Het alternatief (platformvolgorde
 * exact volgen) zou periodiek hernummeren = bestaande mappen hernoemen betekenen,
 * en dat is precies wat het teambesluit van 11-08 verbiedt.
 *
 * BLINDE VLEK, GEDICHT 2026-09-01: stap 2 hieronder leidde alles af uit NIEUWE
 * VIDEO'S. Een collectie die bij Uscreen uit BESTAANDE video's wordt
 * samengesteld raakt die filter nooit — er is niets nieuw — en kreeg dus nooit
 * een map, cover of beschrijving. Zo stonden er op 2026-09-01 17 collecties
 * zonder archiefmap en 121 afleveringen los in "99 - Buiten categorieën",
 * terwijl elk videobestand wél op de NAS stond. Stap 1b controleert daarom nu
 * ELKE ronde de dekking op COLLECTIENIVEAU, ook als er nul nieuwe video's zijn.
 * De wachter repareert dat niet zelf: verplaatsen raakt de nummering, en dat is
 * een teambesluit. Hij meldt het (log + Telegram + DEKKING-<datum>.txt).
 * Bewust lege collecties staan in archief/collecties-bewust-leeg.txt.
 *
 * Wat het doet:
 *   1. verse oogst uit de Uscreen-admin (videos.index, categories.index/show,
 *      contents_collections.details voor nieuwe series);
 *   1b. dekkingscontrole: heeft ELKE live collectie een archiefmap?
 *   2. bepaalt wat nieuw is t.o.v. structuur.jsonl;
 *   3. wijst paden toe (achteraan) en breidt structuur.jsonl +
 *      structuur-series.jsonl uit — append-only, met gedateerde backup;
 *   4. zet de nieuwe id's in uscreen-video-ids.jsonl (bronlijst die
 *      archive-request-links.mjs al meeleest);
 *   5. draait archive-request-links.mjs (video's) en archive-extras.mjs
 *      (covers/teksten) — beide idempotent;
 *   6. Telegram-bericht met wat erbij kwam, of met de storing.
 *
 * Fail-honest: bij een verlopen Uscreen-sessie of onbereikbare NAS stopt hij en
 * meldt hij dat; hij verzint nooit een plek en hernoemt nooit iets bestaands.
 * Exitcodes: 0 klaar · 1 structuur ontbreekt · 2 Uscreen-sessie verlopen ·
 * 4 browser intern stuk · 6 ophaalronde MISLUKT (kind niet gestart of niet met
 * exit 0 geëindigd — stap 5; sinds 2026-09-03, zie "4/5. ophalen").
 *
 * Draaien (vanuit worker/):
 *   node archief-bijwerken.mjs --dry              # alleen tonen
 *   node archief-bijwerken.mjs                    # echt bijwerken
 *   node archief-bijwerken.mjs --alleen-structuur # stap 1-4, niets ophalen
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const WORKER = path.dirname(new URL(import.meta.url).pathname);
const DRY = process.argv.includes('--dry');
const ALLEEN_STRUCTUUR = process.argv.includes('--alleen-structuur');
const ts = () => new Date().toISOString().slice(11, 19);
const stempel = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJsonl = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const log = (s) => console.log(`[${ts()}] ${s}`);

async function tg(bericht) {
  try {
    const env = fs.readFileSync(path.join(CC, 'telegram.env'), 'utf8');
    const tok = (env.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m) ?? [])[1];
    const chat = (env.match(/^TELEGRAM_CHAT_ID=(.*)$/m) ?? [])[1];
    if (!tok || !chat) return;
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: bericht }),
    });
  } catch { /* een melding mag de run nooit breken */ }
}

// naamhygiëne — identiek aan archive-structure.mjs (Windows/SMB-regels)
const hernoemd = [];
function san(naam, waar) {
  const orig = String(naam ?? '').trim();
  let uit = orig.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  if (!uit) uit = 'zonder titel';
  while (Buffer.byteLength(uit, 'utf8') > 150) uit = uit.slice(0, -1).trimEnd();
  if (uit !== orig) hernoemd.push(`${waar}: "${orig}" -> "${uit}"`);
  return uit;
}

// ── 1. verse oogst ──
// Twee heel verschillende storingen, die je niet mag verwarren (les 2026-08-29,
// toen de wachter een kapotte browser als "login verlopen" meldde):
//  exit 2 = de UscreenSESSIE is verlopen        -> de founder moet inloggen;
//  exit 4 = de BROWSER is intern stuk           -> Chrome herstarten met dezelfde
//           --user-data-dir; de login overleeft dat (bewezen 08-13 en 08-29).
// De tweede herkennen we aan "Browser context management is not supported" of
// een CDP-poort die helemaal niet antwoordt.
// De poort is instelbaar (CHROME_CDP, default 9333). Reden: Chrome for Testing
// 146 crasht op app.uscreen.tv ("Network service crashed", exit 133) terwijl de
// gewone Chrome 150 van de founder de admin prima laadt — met CHROME_CDP=9222
// kan een ronde dan toch draaien. Zie de twin-Chrome-notitie in het geheugen.
const CDP_POORT = process.env.CHROME_CDP || '9333';
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_POORT}`).catch(async (e) => {
  const stuk = /context management is not supported|ECONNREFUSED|connect ECONNREFUSED|Timeout/i.test(String(e.message));
  const uitleg = stuk
    ? `de Chrome op :${CDP_POORT} is intern stuk of niet gestart — herstarten met hetzelfde profiel lost dit op (login blijft behouden)`
    : `Chrome op :${CDP_POORT} niet bereikbaar: ${e.message}`;
  await tg(`[archief-wachter] ${uitleg}. Er is niets bijgewerkt.`);
  console.error(uitleg);
  process.exit(stuk ? 4 : 2);
});
// Een net gestarte Chrome antwoordt op /json/version vóórdat hij een bruikbare
// context heeft: op 02-09-2026 gooide ctx.newPage() 3 s na een geslaagde start
// nog een uncaught exception. Daarom hier kort wachten en opnieuw proberen.
let ctx = browser.contexts()[0];
let page = null;
for (let poging = 1; poging <= 6; poging++) {
  try {
    ctx = browser.contexts()[0] ?? ctx;
    if (!ctx) throw new Error('nog geen browsercontext');
    page = await ctx.newPage();
    break;
  } catch (e) {
    if (poging === 6) {
      const uitleg = `browser op :${CDP_POORT} kwam niet klaar: ${String(e.message).slice(0, 120)}`;
      await tg(`[archief-wachter] ${uitleg}. Er is niets bijgewerkt.`);
      console.error(uitleg);
      process.exit(4);
    }
    log(`  browser nog niet klaar (${poging}/6) — 5 s wachten`);
    await sleep(5000);
  }
}
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
      body: JSON.stringify(body), signal: ac.signal,
    });
    return r.ok ? await r.json() : { __err: r.status };
  } catch (e) { return { __err: String(e.message || e).slice(0, 100) }; } finally { clearTimeout(t); }
}, [pad, body]);
const api = async (pad, body) => {
  for (let poging = 1; ; poging++) {
    try { return await apiRuw(pad, body); } catch (e) {
      if (poging >= 3) throw e;
      log(`  pagina kwijt — nieuwe tab (poging ${poging + 1})`);
      await nieuwePagina();
    }
  }
};

const proef = await api('videos.index', { page: 1 });
if (proef.__err) {
  await tg(`[archief-wachter] Uscreen-sessie werkt niet (${proef.__err}). Inloggen in de twin Chrome nodig; er is niets bijgewerkt.`);
  console.error(`Uscreen antwoordt niet (${proef.__err}) — sessie verlopen?`);
  process.exit(2);
}

log('video-lijst ophalen…');
const liveVideos = [];
for (let p = 1; p <= 2000; p++) {
  const j = p === 1 ? proef : await api('videos.index', { page: p });
  if (j.__err) throw new Error(`videos.index p${p}: ${j.__err}`);
  for (const v of (j.videos ?? [])) {
    liveVideos.push({
      id: String(v.id), title: v.title,
      collection_ids: (v.collection_ids ?? []).map(String),
      category_ids: (v.category_ids ?? []).map(String),
      release_stage: v.release_stage,
    });
  }
  if (!(j.videos ?? []).length || j.pagination?.is_last_page) break;
  await sleep(100);
}
log(`Uscreen heeft ${liveVideos.length} video's`);

const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
if (!struct.length || !series.length) { console.error('structuur(.series).jsonl ontbreekt'); process.exit(1); }
const bekend = new Set(struct.map((r) => String(r.id)));
const nieuweVideos = liveVideos.filter((v) => !bekend.has(v.id));
log(`nieuw sinds de laatste ronde: ${nieuweVideos.length} video's`);

// ── 1b. DEKKINGSCONTROLE OP COLLECTIENIVEAU ──────────────────────────────
// Blinde vlek t/m 2026-09-01: alles hieronder werd afgeleid uit NIEUWE VIDEO'S.
// Een collectie die bij Uscreen uit BESTAANDE video's wordt samengesteld raakt
// die filter nooit — geen nieuwe video, dus geen map, cover of beschrijving.
// Zo ontstonden 17 collecties zonder archiefmap en 121 losse afleveringen in
// "99 - Buiten categorieën" (hercontrole 2026-09-01). Daarom wordt de dekking
// nu ELKE ronde gecontroleerd, ook als er nul nieuwe video's zijn.
const bewustLeegPad = path.join(OUTDIR, 'collecties-bewust-leeg.txt');
const bewustLeeg = new Set(fs.existsSync(bewustLeegPad)
  ? fs.readFileSync(bewustLeegPad, 'utf8').split('\n').map((s) => s.split('#')[0].trim()).filter(Boolean)
  : []);
const serieVanCollectieNu = new Set(series.map((s) => String(s.collection)));
const liveCollecties = [];
for (let p = 1; p <= 200; p++) {
  const j = await api('contents_collections.index', { page: p, sort: 'created_at[desc]' });
  if (j.__err) { log(`  dekkingscontrole: collections.index p${p} gaf ${j.__err} — overgeslagen`); break; }
  for (const c of (j.collections ?? [])) liveCollecties.push({ id: String(c.id), titel: c.title, status: c.status });
  const tot = j.pagination?.total_pages;
  if (!(j.collections ?? []).length || (tot && p >= tot)) break;
  await sleep(80);
}
const zonderMap = liveCollecties.filter((c) => !serieVanCollectieNu.has(c.id) && !bewustLeeg.has(c.id));
log(`dekking: ${liveCollecties.length} collecties live · ${zonderMap.length} zonder archiefmap · ${bewustLeeg.size} bewust leeg`);
if (zonderMap.length) {
  const rap = path.join(OUTDIR, `DEKKING-${stempel()}.txt`);
  const regels = zonderMap.map((c) => {
    const eigen = liveVideos.filter((v) => (v.collection_ids ?? []).includes(c.id));
    const losIn99 = eigen.filter((v) => {
      const r = struct.find((x) => String(x.id) === v.id);
      return r && String(r.dest).startsWith('99 - ');
    }).length;
    return `${c.id}\t${c.status}\t${eigen.length} afl.\t${losIn99} los in 99-map\t${c.titel}`;
  });
  fs.writeFileSync(rap, `Collecties zonder archiefmap — ${new Date().toISOString()}\n` +
    'Zet een id in collecties-bewust-leeg.txt als hij bewust geen map krijgt.\n\n' + regels.join('\n') + '\n');
  for (const r of regels.slice(0, 10)) log(`  ZONDER MAP: ${r.replace(/\t/g, ' · ')}`);
  if (!DRY) await tg(`[archief-wachter] ${zonderMap.length} collectie(s) zonder archiefmap — zie ${path.basename(rap)}. ` +
    'Dit repareert de wachter NIET zelf (verplaatsen raakt de nummering); vraag de assistent om de verhuizing.');
}

if (!nieuweVideos.length) {
  log('geen nieuwe video\'s.');
  if (!DRY) await tg(zonderMap.length
    ? `[archief-wachter] Geen nieuwe video's, maar ${zonderMap.length} collectie(s) missen een archiefmap.`
    : '[archief-wachter] Niets nieuws bij Uscreen — het archief is bij (dekking 100%).');
  await page.close();
  process.exit(0);
}

// categorieën + hun inhoud (voor de plaatsing van NIEUWE series)
const cj = await api('categories.index', { page: 1 });
const cats = (cj.categories ?? []).map((c) => ({ id: String(c.id), titel: c.title, positie: c.position }));
const catNr = new Map(cats.map((c) => [c.id, String(c.positie).padStart(2, '0')]));
const catVanItem = new Map();
for (const c of cats) {
  for (let p = 1; p <= 40; p++) {
    const j = await api('categories.show', { id: Number(c.id), page: p });
    if (j.__err) break;
    for (const it of (j.contents ?? [])) {
      const k = String(it.id ?? it.subject_id);
      if (!catVanItem.has(k)) catVanItem.set(k, []);
      if (!catVanItem.get(k).includes(catNr.get(c.id))) catVanItem.get(k).push(catNr.get(c.id));
    }
    if (!(j.contents ?? []).length || j.pagination?.is_last_page) break;
    await sleep(120);
  }
}
log(`${cats.length} categorieën ingelezen`);

// ── 2/3. plaatsing bepalen ──
const catDirNaam = new Map();     // "06" -> "06 - العمر - Age 2-4"
const serieNummers = new Map();   // "06" -> hoogste serienummer
const serieBreedte = new Map();   // "06" -> cijferbreedte
for (const r of struct) {
  for (const pad of [r.dest, ...(r.ook_in ?? [])]) {
    const d = pad.split('/');
    if (d.length < 2) continue;
    const nr = d[0].slice(0, 2);
    catDirNaam.set(nr, d[0]);
    const m = d[1].match(/^(\d+) - /);
    if (m) {
      serieNummers.set(nr, Math.max(serieNummers.get(nr) ?? 0, parseInt(m[1], 10)));
      serieBreedte.set(nr, Math.max(serieBreedte.get(nr) ?? 0, m[1].length));
    }
  }
}
for (const c of cats) {
  const nr = catNr.get(c.id);
  if (!catDirNaam.has(nr)) catDirNaam.set(nr, `${nr} - ${san(c.titel, `categorie ${c.id}`)}`);
}
const serieVanCollectie = new Map(series.map((s) => [String(s.collection), s]));
const epNummer = new Map();
const epBreedte = new Map();
for (const s of series) {
  const cid = String(s.collection);
  for (const e of s.eps) {
    const m = String(e.bestand).match(/^(\d+) - /);
    if (m) {
      epNummer.set(cid, Math.max(epNummer.get(cid) ?? 0, parseInt(m[1], 10)));
      epBreedte.set(cid, Math.max(epBreedte.get(cid) ?? 0, m[1].length));
    }
  }
}
const volgendeSerieNr = (nr) => {
  const n = (serieNummers.get(nr) ?? 0) + 1;
  serieNummers.set(nr, n);
  return String(n).padStart(serieBreedte.get(nr) ?? 2, '0');
};

// titels + volgorde van nieuwe collecties ophalen
// details van ELKE geraakte collectie: titel + afspeelvolgorde. Die volgorde
// bepaalt in welke volgorde de nieuwe afleveringen genummerd worden — anders
// krijgen ze de volgorde waarin videos.index ze teruggeeft (aanmaakdatum
// aflopend), en dan staat aflevering 5 vóór aflevering 1 in de map.
const geraakteCollecties = [...new Set(nieuweVideos.flatMap((v) => v.collection_ids))];
const collectieInfo = new Map();
const liveRegels = new Map();
for (const cid of geraakteCollecties) {
  const j = await api('contents_collections.details', { id: Number(cid) });
  const k = j.collection;
  if (k) {
    collectieInfo.set(cid, {
      titel: k.meta_title || k.title,
      volgorde: (k.playlist_items ?? []).map((i) => String(i.subject_id)),
    });
    // Nieuwe series staan niet in Supabase, terwijl archive-extras.mjs daar zijn
    // beschrijving en zoekwoorden haalt. We schrijven de admin-gegevens weg in
    // uscreen-collection-details-live.jsonl; archive-extras valt daarop terug
    // wanneer de DB geen rij heeft, zodat een nieuwe serie óók beschrijving,
    // zoekwoorden en cover krijgt in plaats van alleen videobestanden.
    liveRegels.set(cid, {
      id: String(k.id), title: k.title, meta_title: k.meta_title, permalink: k.permalink,
      status: k.release_stage, release_stage: k.release_stage, description_html: k.description ?? '',
      tags: k.tags ?? [], cover: k.big_horizontal_image_url ?? null, updated_at: k.updated_at,
      n_items: (k.playlist_items ?? []).length,
    });
  }
  await sleep(150);
}
const nieuweCollecties = geraakteCollecties.filter((cid) => !serieVanCollectie.has(cid));
log(`${geraakteCollecties.length} geraakte collecties, waarvan ${nieuweCollecties.length} nieuw`);
// nieuwe video's in afspeelvolgorde zetten (onbekende posities achteraan)
const positieVan = (v) => {
  let beste = Number.MAX_SAFE_INTEGER;
  for (const cid of v.collection_ids) {
    const i = collectieInfo.get(cid)?.volgorde?.indexOf(v.id) ?? -1;
    if (i >= 0) beste = Math.min(beste, i);
  }
  return beste;
};
nieuweVideos.sort((a, b) => positieVan(a) - positieVan(b) || Number(a.id) - Number(b.id));

const nieuweRijen = [];
const geraakteSeries = new Map();
const losseVideos = [];
for (const v of nieuweVideos) {
  const cids = v.collection_ids.filter((c) => serieVanCollectie.has(c) || collectieInfo.has(c));
  if (!cids.length) { losseVideos.push(v); continue; }
  const gesorteerd = cids.slice().sort((a, b) => {
    const na = (catVanItem.get(a) ?? ['99'])[0] ?? '99';
    const nb = (catVanItem.get(b) ?? ['99'])[0] ?? '99';
    return na.localeCompare(nb);
  });
  const paden = [];
  for (const cid of gesorteerd) {
    let s = serieVanCollectie.get(cid);
    if (!s) {
      const nrs = catVanItem.get(cid) ?? ['99'];
      const naam = san(collectieInfo.get(cid)?.titel ?? `collectie ${cid}`, `serie ${cid}`);
      const dirs = nrs.map((nr) => `${catDirNaam.get(nr) ?? '99 - Buiten categorieën'}/${volgendeSerieNr(nr)} - ${naam}`);
      s = { collection: cid, dirs, eps: [] };
      serieVanCollectie.set(cid, s);
      geraakteSeries.set(cid, { nieuw: true, serie: s });
      epNummer.set(cid, 0);
      epBreedte.set(cid, 2);
    } else if (!geraakteSeries.has(cid)) {
      geraakteSeries.set(cid, { nieuw: false, serie: s });
    }
    const n = (epNummer.get(cid) ?? 0) + 1;
    epNummer.set(cid, n);
    const bestand = `${String(n).padStart(epBreedte.get(cid) ?? 2, '0')} - ${san(v.title, `video ${v.id}`)}`;
    s.eps.push({ id: v.id, bestand });
    for (const d of s.dirs) paden.push(`${d}/${bestand}`);
  }
  nieuweRijen.push({ id: v.id, dest: paden[0], ook_in: paden.slice(1) });
}
for (const v of losseVideos) {
  const nrs = (v.category_ids ?? []).map((c) => catNr.get(c)).filter(Boolean).sort();
  const doel = nrs[0] ?? '99';
  const naam = san(v.title, `losse video ${v.id}`);
  const pad = doel === '99'
    ? `99 - Buiten categorieën/${naam} (${v.id})`
    : `${catDirNaam.get(doel)}/${volgendeSerieNr(doel)} - ${naam}`;
  nieuweRijen.push({ id: v.id, dest: pad, ook_in: [] });
}

const aantalNieuweSeries = [...geraakteSeries.values()].filter((x) => x.nieuw).length;
log(`toewijzing: ${nieuweRijen.length} video's · ${aantalNieuweSeries} nieuwe series · ${losseVideos.length} losse video's`);
for (const r of nieuweRijen.slice(0, 25)) log(`   ${r.id}  ${r.dest}${r.ook_in.length ? `  (+${r.ook_in.length} plek)` : ''}`);
if (nieuweRijen.length > 25) log(`   … en nog ${nieuweRijen.length - 25}`);
if (hernoemd.length) log(`${hernoemd.length} namen aangepast (gelogd)`);

if (DRY) { log('[DRY] niets weggeschreven'); await page.close(); process.exit(0); }

// ── 3b. wegschrijven, met backup ──
const stamp = stempel();
fs.copyFileSync(path.join(OUTDIR, 'structuur.jsonl'), path.join(OUTDIR, `structuur.jsonl.bak-${stamp}`));
fs.copyFileSync(path.join(OUTDIR, 'structuur-series.jsonl'), path.join(OUTDIR, `structuur-series.jsonl.bak-${stamp}`));
fs.appendFileSync(path.join(OUTDIR, 'structuur.jsonl'), nieuweRijen.map((r) => JSON.stringify(r)).join('\n') + '\n');
const alleSeries = new Map(series.map((s) => [String(s.collection), s]));
for (const x of geraakteSeries.values()) alleSeries.set(String(x.serie.collection), x.serie);
fs.writeFileSync(path.join(OUTDIR, 'structuur-series.jsonl'),
  [...alleSeries.values()].map((s) => JSON.stringify(s)).join('\n') + '\n');
if (hernoemd.length) fs.appendFileSync(path.join(OUTDIR, 'structuur-hernoemd.log'), hernoemd.join('\n') + '\n');
fs.appendFileSync(path.join(CC, 'uscreen-video-ids.jsonl'),
  nieuweVideos.map((v) => JSON.stringify({ id: v.id, title: v.title })).join('\n') + '\n');
// live-collectiegegevens bijwerken (laatste regel per id wint bij het inlezen)
if (liveRegels.size) {
  const LIVE = path.join(CC, 'uscreen-collection-details-live.jsonl');
  const bestaand = readJsonl(LIVE).filter((r) => !liveRegels.has(String(r.id)));
  fs.writeFileSync(LIVE, [...bestaand, ...liveRegels.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
  log(`${liveRegels.size} collectieregels bijgewerkt in uscreen-collection-details-live.jsonl`);
}
log(`structuur bijgewerkt (backups: structuur*.jsonl.bak-${stamp})`);

await page.close();
if (ALLEEN_STRUCTUUR) process.exit(0);

// ── 4/5. ophalen ──
// Les 2026-09-03: de eerste nachtelijke ronde met een nieuwe video (4333088) meldde
// "klaar (exit null)" en de video kwam nooit op de NAS. Oorzaak: spawnSync('node')
// met een kaal 'node' — launchd geeft alleen /usr/bin:/bin:/usr/sbin:/sbin mee,
// dus ENOENT, status null, en dat werd als "klaar" gelogd. Daarom nu:
//  - process.execPath (het node-binary van déze run) i.p.v. 'node';
//  - r.error en r.signal worden gelogd; status === null is MISLUKT, nooit "klaar";
//  - een mislukte ophaalronde eindigt met exit 6 + Telegram, niet met "klaar".
// Async spawn met await (change-control regel 2): de twee kinderen draaien bewust
// NA elkaar (ze delen de Uscreen-sessie en de NAS-wachtrij), maar zonder het
// event-loop-blok van spawnSync, zodat de timeout en signalen wél gezien worden.
const draai = (script, args = []) => new Promise((resolve) => {
  log(`start ${script} ${args.join(' ')}`);
  let klaar = false;
  const af = (r) => { if (!klaar) { klaar = true; resolve(r); } };
  const kind = spawn(process.execPath, [path.join(WORKER, script), ...args],
    { stdio: 'inherit', timeout: 8 * 60 * 60_000 });
  kind.on('error', (e) => {
    // Zonder pid is het kind nooit gestart (ENOENT/EACCES): meteen afronden. Mét pid
    // (bv. kill() faalde bij de timeout) alleen loggen; 'close' rondt dan af.
    log(`${script} MISLUKT: ${kind.pid ? 'fout tijdens de run' : 'kon niet starten'} (${e.code ?? e.message})`);
    if (!kind.pid) af({ status: null, signal: null, error: e.code ?? String(e.message) });
  });
  kind.on('close', (status, signal) => {
    if (klaar) return;                               // al gemeld via 'error' (Node geeft dan close(-2))
    if (status === null) log(`${script} MISLUKT: beëindigd door signaal ${signal ?? 'onbekend'} (geen exitcode)`);
    else if (status !== 0) log(`${script} MISLUKT: exit ${status}`);
    else log(`${script} klaar (exit 0)`);
    af({ status, signal, error: null });
  });
});
const uitleg = (r) => r.status === 0 ? 'OK'
  : r.status === null ? `MISLUKT (${r.error ?? `signaal ${r.signal}`})` : `MISLUKT (exit ${r.status})`;
const rVideos = await draai('archive-request-links.mjs', ['--batch', '10', '--negeer-wachtrij']);
const rExtras = await draai('archive-extras.mjs');
const mislukt = rVideos.status !== 0 || rExtras.status !== 0;

await tg([
  `[archief-wachter] ${nieuweRijen.length} nieuwe video's bijgezet`,
  `${aantalNieuweSeries} nieuwe series`,
  `video-ronde ${uitleg(rVideos)}`,
  `covers/teksten ${uitleg(rExtras)}`,
  mislukt ? 'OPHAALRONDE MISLUKT — logboek nakijken' : '',
].filter(Boolean).join(' · '));
if (mislukt) { log('MISLUKT: ophaalronde niet compleet — logboek nakijken'); process.exit(6); }
log('klaar');
process.exit(0);
