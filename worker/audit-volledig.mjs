/**
 * audit-volledig.mjs — reconciliatie Uscreen <-> NAS-archief op 12 assen (+ 1b/1c/2b/10b sinds 05-09) (2026-09-02).
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
 *   node audit-volledig.mjs --snel         # assen 7/11a/11b/12 NIET meten (historisch; de NAS-scan draait altijd, dus het
 *                                          # bespaart vrijwel niets — B60: vlag blijft); rapport zegt het luid, geen compleetheidsuitspraak
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
 * Samenloop (C8): weigert te starten (exit 5) als de wachter (ook zijn wrapper), een ingest-/manifest-script of een
 * andere audit draait — zelfde twin Chrome (TAB-GC van de migration-watchdog sluit alle uscreen-tabs zodra er twee
 * zijn) en hetzelfde manifest (`cat` tijdens een append = halve regel). Kan de guard niet meten (pgrep/ps-fout) →
 * ook exit 5, nooit stil doorgaan. Chrome (C20): verbinden in een lus (net gestart = nog geen context); valt de
 * verbinding tijdens de oogst weg (4 sep: clamshell-slaap), dan opnieuw verbinden met dezelfde ingelogde twin (per
 * tabverlies, binnen MAX_TABS per call; elke herverbinding krijgt MAX_VERBIND pogingen; de oude verbinding wordt
 * eerst gesloten); lukt het niet → harde stop (exit 4, tmp opgeruimd, marker ongemoeid).
 * NAS-scan (C13/C29): één `find -printf` met NUL-scheiding (GNU findutils 4.4.2 op de NAS), dus een newline in een naam
 * splitst geen record; een leesfout tijdens de traversal = find exit 1 → audit exit 1 [gemeten 05-09 met een
 * onleesbare map] — nooit stil een regel minder.
 * Exitcodes: 0 klaar · 1 NAS-/oogstfout (ook 5xx op de proef-call) of oogst-marker ontbreekt/klopt niet ·
 * 2 Uscreen-sessie ongeldig (401/403/leeg op de proef-call) · 3 Uscreen 429 blijft (bewust gestopt) ·
 * 4 Chrome onbereikbaar/onbruikbaar · 5 samenloop (wachter/ingest/andere audit draait).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT = path.join(CC, 'archief');
const AUD = path.join(OUT, 'audit');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';   // C23: staat via JSON.stringify in ssh-commando's — dat escapet " en \, niet $ of backtick; werkt omdat dit pad die niet bevat. Wordt BASE ooit instelbaar: single-quote-escape.
const CDP = process.env.CHROME_CDP || '9333';
const HERGEBRUIK = process.argv.includes('--hergebruik');
const SNEL = process.argv.includes('--snel');
const POLITENESS_MS = 1800;   // C7 (zie kop)
const WACHT_429_MS = 90_000;  // C7 (zie kop)
const MAX_429 = 3;            // C7: wachtbeurten per run; daarna Stop429
const MAX_5XX = 2;            // C7: herkansingen per call bij 5xx / netwerkfout (5 s, 10 s)
const MAX_TABS = 3;           // pre-existing: pogingen bij tabverlies
const MAX_VERBIND = 6;        // C20: verbindpogingen à 5 s (wachter-precedent: 6× 5 s)
const MARKER = path.join(AUD, 'oogst-klaar.json');   // C1: alleen aanwezig als de oogst compleet is
const OOGST = ['videos.jsonl', 'categorieen.json', 'collecties.jsonl'];   // C1: de drie oogstbestanden
class Stop429 extends Error {}
class ChromeWeg extends Error {}   // C20: Chrome niet (meer) bruikbaar → exit 4 via de ene uitgang

fs.mkdirSync(AUD, { recursive: true });
const ts = () => new Date().toISOString().slice(11, 19);
const log = (s) => console.log(`[${ts()}] ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const verworpen = {};   // C3: onleesbare JSONL-regels per bestand — gemeld, nooit stil geslikt
const verworpenRegels = {};   // regelnummers ervan (AS 11c gebruikt die voor manifest.jsonl — één parse, één telling)
const readJsonl = (p) => {
  if (!fs.existsSync(p)) return [];
  const slecht = [];
  const uit = fs.readFileSync(p, 'utf8').split('\n').map((l, i) => [l, i + 1]).filter(([l]) => l.trim())
    .map(([l, nr]) => { try { return JSON.parse(l); } catch { slecht.push(nr); return null; } }).filter(Boolean);
  if (slecht.length) { verworpen[path.basename(p)] = slecht.length; verworpenRegels[path.basename(p)] = slecht; }
  return uit;
};
const MEDIA_EXT = ['.mp4', '.m4v', '.mov', '.mkv'];   // C16: één mediadefinitie voor AS 1/3/5/7
// Werk- en administratiemappen in de archiefwortel: geen archiefinhoud. Eén lijst voor AS 7/11 (bestanden eronder
// buiten beschouwing, geteld) én AS 10 (rechten apart gemeld). `_lock-extras` is de tijdelijke lock van archive-extras.mjs.
const WERKMAPPEN = new Set(['done', '_lock', '_lock-extras', '_oud-logs', '_partial', '_queue', '_staging-bijlagen', 'beeld', 'video']);
const NEGEER_MAP = [...WERKMAPPEN].map((m) => m + '/');
const isMedia = (pad) => MEDIA_EXT.some((e) => pad.toLowerCase().endsWith(e));

function nas(cmd, label) {
  // spawnSync pre-existing en bewust: strikt sequentieel, geen parallelle workers (B56/C27 — regel ter keuring)
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=25', NAS, cmd],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, timeout: 45 * 60_000 });
  if (r.status !== 0) {
    // C19: de reden benoemen — bij timeout/ENOBUFS/signaal is status null en stderr leeg, dus anders onzichtbaar
    const reden = r.error ? `${r.error.code ?? 'fout'}: ${r.error.message}` : r.signal ? `signaal ${r.signal}` : `exit ${r.status}`;
    console.error(`NAS ${label} mislukt (${reden}): ${(r.stderr || '').slice(0, 300)}`); process.exit(1);
  }
  return r.stdout;
}

// ═══ verse oogst uit de Uscreen-admin ═══
async function oogst() {
  // C20: Chrome kan net gestart zijn (wachter-precedent: contexts() leeg, newPage gooit 3 s na de start) of de
  // verbinding kan wegvallen (4 sep 18:22: clamshell-slaap). Verbinden gebeurt daarom in een lus; bij een verloren
  // context midden in de oogst wordt opnieuw verbonden met dezelfde ingelogde twin. Faalt dat MAX_VERBIND keer → ChromeWeg.
  let browser, ctx, page;
  const verbind = async () => {
    for (let k = 1; ; k++) {
      try {
        try { await browser?.close(); } catch { /* al weg */ }   // vorige CDP-client dicht, anders houdt die socket het proces open (C11)
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
        ctx = browser.contexts()[0];
        if (!ctx) throw new Error('nog geen browsercontext');
        page = await ctx.newPage();
        return;
      } catch (e) {
        const kort = String(e.message).split('\n')[0].slice(0, 120);   // Playwright plakt een meerregelig 'Call log' aan
        if (k >= MAX_VERBIND) throw new ChromeWeg(`Chrome op :${CDP} niet bruikbaar na ${k} pogingen: ${kort}`);
        log(`  Chrome :${CDP}: ${kort} — opnieuw over 5 s (${k}/${MAX_VERBIND})`);
        await sleep(5000);
      }
    }
  };
  const naarAdmin = async () => {
    await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
  };
  const nieuwePagina = async () => {
    // C2: eerst de nieuwe tab, dán de oude sluiten — nooit de laatste pagina van de gedeelde Chrome sluiten
    const oude = page;
    try { page = await ctx.newPage(); } catch (e) {
      // C20: context/verbinding weg → opnieuw verbinden. De oude tab kan als wees in Chrome achterblijven; die wordt
      // gemeld (TAB-GC ruimt hem binnen 5 min op, wat één extra 'pagina kwijt'-herkansing kost — bewust niet zelf sluiten:
      // een tab van iemand anders in de twin herkennen we niet met zekerheid).
      log(`  browsercontext weg (${String(e.message).split('\n')[0].slice(0, 60)}) — opnieuw verbinden`);
      await verbind();
      const wezen = ctx.pages().filter((q) => q !== page && /app\.uscreen\.tv/.test(q.url())).length;
      if (wezen) log(`  let op: ${wezen} andere app.uscreen.tv-tab(s) in de twin (wees van vóór de herverbinding?)`);
    }
    try { if (!oude.isClosed()) await oude.close(); } catch { /* al weg */ }
    await naarAdmin();
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
  await verbind(); await naarAdmin();
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
  let nV = 0; let nVdubbel = 0; const vGezien = new Set();
  const MAX_P_VIDEOS = 3000;
  // C14: Uscreen's eigen totaal staat op topniveau als `total_count` (zelfde bron als audit-eind.mjs:114) — de laatst
  // bezochte pagina telt (stand aan het eind van de oogst). Ontbreekt het veld → luid gemeld, null in de marker.
  let serverTotaal = null;
  for (let p = 1; ; p++) {
    if (p > MAX_P_VIDEOS) throw new Error(`videos.index: pagina-plafond ${MAX_P_VIDEOS} bereikt zonder is_last_page — oogst niet te vertrouwen`);
    const j = p === 1 ? proef : await api('videos.index', { page: p });
    if (j.__err) throw new Error(`videos.index p${p}: ${j.__err}`);
    if (Number.isFinite(+j.total_count)) serverTotaal = +j.total_count;
    const rows = j.videos ?? [];
    for (const v of rows) {
      const id = String(v.id);
      if (vGezien.has(id)) { nVdubbel++; continue; }   // C14: dezelfde video op twee pagina's (verschuiving tijdens de oogst)
      vGezien.add(id);
      vOut.write(JSON.stringify({ id, title: v.title, release_stage: v.release_stage,
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
  log(`VIDEO'S: ${nV}${nVdubbel ? ` (+${nVdubbel} dubbel op een volgende pagina, overgeslagen)` : ''}${serverTotaal != null ? ` · Uscreen zegt ${serverTotaal}` : ' · Uscreen geeft geen total_count (niet gecontroleerd)'}`);
  // nul-tolerantie (aanname, aanpasbaar): ook één video die tijdens de oogst bijkwam of verdween = geen marker, opnieuw
  if (serverTotaal != null && serverTotaal !== nV) throw new Error(`videos.index: ${nV} unieke video's opgehaald, Uscreen meldt ${serverTotaal} (${nV < serverTotaal ? 'minder' : 'meer'}) — oogst wijkt af van het servertotaal, geen marker`);

  // categorieën + hun items
  const catLijst = []; const cGezien = new Set(); let nCdubbel = 0;
  for (let p = 1; ; p++) {   // C14: categories.index pagineren i.p.v. alleen pagina 1; ontdubbeld op id (zelfde patroon als video's)
    if (p > 20) throw new Error('categories.index: pagina-plafond 20 bereikt zonder einde');
    const cj = await api('categories.index', { page: p });
    if (cj.__err) throw new Error(`categories.index p${p}: ${cj.__err}`);
    let nieuw = 0;
    for (const c of (cj.categories ?? [])) { if (cGezien.has(String(c.id))) { nCdubbel++; continue; } cGezien.add(String(c.id)); catLijst.push(c); nieuw++; }
    const tot = cj.pagination?.total_pages;
    // zonder pagination-object (vorm niet gemeten) tóch p2 vragen: stoppen op leeg of niets nieuws, nooit stil na p1
    if (!nieuw || cj.pagination?.is_last_page || (tot && p >= tot)) break;
    await sleep(POLITENESS_MS);
  }
  const cats = [];
  let nCatItems = 0;
  for (const c of catLijst) {
    const items = [];
    for (let p = 1; ; p++) {
      if (p > 100) throw new Error(`categories.show ${c.id}: pagina-plafond 100 bereikt zonder is_last_page`);
      const j = await api('categories.show', { id: Number(c.id), page: p });
      if (j.__err) throw new Error(`categories.show ${c.id} p${p}: ${j.__err}`);
      const rows = j.contents ?? [];   // C22: het veld heet `contents` (zelfde als de wachter); geen gokketen meer
      for (const it of rows) items.push({ id: String(it.id ?? it.subject_id ?? ''), position: it.position ?? null, title: it.title ?? null });
      nCatItems += rows.length;
      if (!rows.length || j.pagination?.is_last_page) break;
      await sleep(POLITENESS_MS);
    }
    cats.push({ id: String(c.id), title: c.title, position: c.position, published: c.published, items });
    await sleep(POLITENESS_MS);
  }
  if (!nCatItems) throw new Error('categories.show gaf 0 items voor alle categorieën — veldnaam veranderd of oogst leeg; geen marker');   // C22: tellingscontrole
  fs.writeFileSync(tmp('categorieen.json'), JSON.stringify(cats, null, 1));
  log(`CATEGORIEËN: ${cats.length} (${nCatItems} items${nCdubbel ? `, ${nCdubbel} categorie(ën) dubbel over pagina's overgeslagen` : ''})`);

  // collecties + leden
  const idx = [];
  for (let p = 1; ; p++) {
    if (p > 200) throw new Error('collections.index: pagina-plafond 200 bereikt zonder einde');
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
    videos: nV, videos_dubbel: nVdubbel, videos_uscreen_totaal: serverTotaal, categorieen: cats.length, categorieen_dubbel: nCdubbel, categorie_items: nCatItems,
    collecties: n, collecties_fout: nFout, politeness_ms: POLITENESS_MS, wachtbeurten_429: n429 }, null, 1));
  log(`oogst compleet in ${Math.round((Date.now() - start) / 60000)} min — marker geschreven`);
  await sluitTab();
  try { await browser.close(); } catch { /* verbinding al weg */ }   // C11: alleen de CDP-verbinding dicht — gemeten 05-09: proces en pagina's blijven; zonder dit houdt de socket het proces open (gemeten 05-09 06:12)
  } catch (e) {
    // Eén uitgang voor elke afbreking in de oogst: streams dicht, tijdelijke bestanden weg, tab dicht.
    // De vorige oogst + marker blijven staan; --hergebruik meet dus nooit op een halve oogst.
    for (const s of geopend) { try { s.destroy(); } catch { /* al dicht */ } }
    for (const naam of OOGST) fs.rmSync(tmp(naam), { force: true });
    await sluitTab();
    if (e instanceof Stop429) { console.error(`[${ts()}] ${e.message} — audit bewust gestopt (exit 3); vorige oogst intact, later opnieuw`); process.exit(3); }
    if (e instanceof ChromeWeg) { console.error(`[${ts()}] ${e.message} (exit 4); vorige oogst intact`); process.exit(4); }
    console.error(`[${ts()}] oogst afgebroken: ${String(e.message || e).slice(0, 200)} — vorige oogst intact (exit 1)`); process.exit(1);
  }
}

// ═══ NAS-toestand ═══
function nasScan() {
  log('NAS: bestandslijst + stat ophalen…');
  // C13/C29: één find met -printf en NUL-scheiding (GNU findutils 4.4.2 op de NAS, gemeten 05-09) — een newline in een
  // naam splitst geen record meer; %y = f/d, %n = aantal hardlinks. Namen mét newline en onleesbare records worden geteld.
  const txt = nas(`cd ${JSON.stringify(BASE)} && find . -mindepth 1 \\( -type f -o -type d \\) -printf '%s|%i|%n|%y|%p\\0'`, 'scan');
  fs.writeFileSync(path.join(AUD, 'nas-scan.txt'), txt);
  const bestanden = [], mappen = []; let verworpenScan = 0, metNewline = 0;   // C3: nooit stil overslaan
  for (const l of txt.split('\0')) {
    if (!l) continue;
    const d = l.split('|');
    if (d.length < 5 || !/^[fd]$/.test(d[3])) { verworpenScan++; continue; }
    const pad = d.slice(4).join('|').replace(/^\.\//, '');
    if (pad.includes('\n')) metNewline++;
    const rec = { bytes: +d[0], inode: +d[1], nlink: +d[2], dir: d[3] === 'd', pad };
    (rec.dir ? mappen : bestanden).push(rec);
  }
  log(`NAS: ${bestanden.length} bestanden · ${mappen.length} mappen${verworpenScan ? ` · ${verworpenScan} onleesbare scanrecords` : ''}${metNewline ? ` · ${metNewline} namen met newline` : ''}`);
  return { bestanden, mappen, verworpenScan, metNewline };
}
let manifestOnleesbaar = [];   // regelnummers die geen geldige JSON zijn (AS 11c)
function nasManifest() {
  const txt = nas(`cat ${JSON.stringify(BASE + '/manifest.jsonl')}`, 'manifest');
  fs.writeFileSync(path.join(AUD, 'manifest.jsonl'), txt);
  // Onleesbare manifestregels zijn een OPEN punt (AS 11c, met regelnummer) — sinds 2026-09-03 appenden de NAS-loop en
  // de extras-ingest zonder gedeelde lock (zie archive-extras.mjs). Eén parse: readJsonl levert de regelnummers.
  const uit = readJsonl(path.join(AUD, 'manifest.jsonl'));
  manifestOnleesbaar = verworpenRegels['manifest.jsonl'] ?? [];
  return uit;
}
function nasRechten() {
  // C5: exitstatus van synoacltool apart meenemen (de pipeline head|tail verborg hem); rc is diagnostiek in het rapport —
  // de indeling gaat op de tekst, want 'It's Linux mode' is zélf een foutuitgang (rc ≠ 0) van synoacltool
  const txt = nas(`cd ${JSON.stringify(BASE)} && for d in */; do o=$(/usr/syno/bin/synoacltool -get "$PWD/$d" 2>&1); rc=$?; a=$(printf '%s\\n' "$o" | head -2 | tail -1); printf "%s|%s|%s|%s\\n" "$(stat -c '%A %U:%G' "$d")" "$a" "$rc" "\${d%/}"; done`, 'rechten');
  fs.writeFileSync(path.join(AUD, 'rechten.txt'), txt);
  return txt.split('\n').filter(Boolean).map((l) => {
    const d = l.split('|');
    return { mode: d[0], acl: (d[1] || '').trim(), rc: d[2], map: d.slice(3).join('|') };
  });
}

// ═══════════════════ HOOFDLOOP ═══════════════════
// C8: samenloop-guard — wachter (+ wrapper), ingest-/manifest-scripts en een tweede audit delen de twin Chrome en het
// manifest (zie kop). Uitgesloten: de eigen voorouders (shell die de regel bevat) én nakomelingen — `caffeinate -i node …`
// maakt op macOS caffeinate tot KIND van node (gemeten 05-09; nohup exec't en is nooit een apart proces) — en kale
// shell-wrappers (`bash -c …`): elke echte run heeft zijn eigen node-proces in de tabel. pgrep exit 1 = geen match;
// elke andere fout (pgrep/ps onvindbaar, regex) = niet meetbaar → exit 5, nooit stil doorgaan (fail-closed).
// Handtools archive-plat/-restructure/-losmap herschrijven het manifest onder eigen lock en tellen daarom óók mee.
const ANDEREN = '(node [^ ]*(archief-bijwerken|archive-request-links|archive-extras|archive-plat|archive-restructure|archive-losmap|audit-volledig)|bash [^ ]*archief-bijwerken\\.sh)';
const psFout = (wat) => (e) => { console.error(`samenloop-controle (${wat}) mislukt: ${e.code ?? e.message} — audit niet gestart (exit 5)`); process.exit(5); };
const ouders = async (pid) => {   // ppid-keten omhoog, max 8 niveaus
  const uit = [];
  for (let k = 0; pid > 1 && k < 8; k++) {
    pid = +(await execFileP('ps', ['-o', 'ppid=', '-p', String(pid)]).catch((e) => (e.code === 1 ? { stdout: '' } : psFout('ps')(e)))).stdout.trim() || 0;
    if (pid) uit.push(pid);
  }
  return uit;
};
const eigenKeten = new Set([process.pid, ...(await ouders(process.pid))]);
const regels = (await execFileP('pgrep', ['-fl', ANDEREN]).catch((e) => (e.code === 1 ? { stdout: '' } : psFout('pgrep')(e)))).stdout
  .split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/))
  .filter(([pid]) => /^\d+$/.test(pid) && !eigenKeten.has(+pid))   // regel zonder pid = vervolgregel van een commando met newline
  .filter(([, cmd, opt]) => !(/(^|\/)(ba|z)?sh$/.test(cmd) && opt === '-c'));   // shell-wrapper: de run zelf staat er apart in
const bezet = [];
for (const d of regels) if (!(await ouders(+d[0])).includes(process.pid)) bezet.push(d.slice(0, 4).join(' '));
if (bezet.length) { console.error(`samenloop: ${bezet.join(' · ')} — audit niet gestart (exit 5)`); process.exit(5); }
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
const scan = nasScan(); const { bestanden, mappen } = scan;
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
const bestaat = (p) => padSet.has(p) || MEDIA_EXT.some((e) => padSet.has(p + e));   // C16
const uscVid = new Map(videos.map((v) => [v.id, v]));
const colVan = new Map(cols.map((c) => [String(c.id), c]));
const catVanCollectie = new Map();
const catItemsOnbekend = [];   // C3: categorie-items die noch video noch collectie zijn
for (const c of cats) for (const it of c.items) {
  if (!catVanCollectie.has(it.id)) catVanCollectie.set(it.id, []);
  catVanCollectie.get(it.id).push(c.position);
  if (!uscVid.has(it.id) && !colVan.has(it.id)) catItemsOnbekend.push({ categorie: c.title, id: it.id, titel: it.title });
}
// C17: de vervallen-allowlist (archive-request-links.mjs, T33): video's die bij Uscreen niet meer bestaan
// maar wél in ons archief/onze administratie staan — verklaard, geen gat en geen spook
const VERVALLEN_PAD = path.join(OUT, 'vervallen-videos.txt');
const vervallen = new Set(fs.existsSync(VERVALLEN_PAD)
  ? fs.readFileSync(VERVALLEN_PAD, 'utf8').split('\n').map((l) => l.split('#')[0].trim()).filter(Boolean) : []);
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
// C3: stille uitvalgroepen — altijd gemeld, ook als het 0 is (nooit stil buiten beschouwing)
info.categorie_items_onbekend = catItemsOnbekend;
info.jsonl_regels_verworpen = verworpen;
info.videos_dubbel_in_oogst = oogstInfo.videos_dubbel ?? 0;
info.scan_regels_verworpen = scan.verworpenScan;
info.scan_namen_met_newline = scan.metNewline;   // C13
const verworpenZonderManifest = Object.entries(verworpen).filter(([k]) => k !== 'manifest.jsonl');   // manifest = AS 11c (open punt)
p(`Buiten beschouwing (gemeld, geen openstaand punt): ${catItemsOnbekend.length} categorie-items die noch video noch collectie zijn` +
  ` · ${verworpenZonderManifest.reduce((a, [, v]) => a + v, 0)} onleesbare JSONL-regels${verworpenZonderManifest.length ? ` (${verworpenZonderManifest.map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''} (manifest: zie AS 11c)` +
  ` · ${scan.verworpenScan} onleesbare scanrecords, ${scan.metNewline} namen met newline · ${oogstInfo.videos_dubbel ?? 0} video's dubbel in de oogst · ${vervallen.size} vervallen video's op de allowlist`);

// ── AS 1: elke Uscreen-video heeft een bestand ──
const manVideoRijen = man.filter((r) => r.kind === 'video');
const manVideoIds = manVideoRijen.map((r) => String(r.id));
const nasIds = new Set(manVideoIds);
const as1 = videos.filter((v) => !nasIds.has(v.id) || !(plek.get(v.id) ?? []).some(bestaat));
werk.as1_video_zonder_bestand = as1.map((v) => ({ id: v.id, titel: v.title, stage: v.release_stage }));
p(`\nAS 1  video's Uscreen/NAS : ${videos.length} / ${nasIds.size} · ontbreekt: ${as1.length}`);
// C17: de omgekeerde as — wat wij administreren maar Uscreen niet (meer) heeft; dubbele manifest-video's (mét de vraag
// of de regels elkaar tegenspreken: zelfde id, andere sha256 = welke regel is waar?)
const manDubbel = [...manVideoIds.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map())].filter(([, k]) => k > 1)
  .map(([id, k]) => ({ id, keer: k, sha_verschilt: new Set(manVideoRijen.filter((r) => String(r.id) === id).map((r) => r.sha256)).size > 1 }));
const structWees = struct.map((r) => String(r.id)).filter((id) => !uscVid.has(id) && !vervallen.has(id));
const manWees = [...nasIds].filter((id) => !uscVid.has(id) && !vervallen.has(id));
werk.as1b_geadministreerd_maar_niet_bij_uscreen = [...new Set([...structWees, ...manWees])].map((id) => ({ id, in_structuur: structWees.includes(id), in_manifest: manWees.includes(id) }));
werk.as1c_manifest_video_dubbel = manDubbel;
info.vervallen_verklaard = { structuur: struct.filter((r) => vervallen.has(String(r.id))).length, manifest: [...nasIds].filter((id) => vervallen.has(id)).length,
  zonder_bestand: [...vervallen].filter((id) => !nasIds.has(id)).length };   // allowlist-ids zonder manifest-video: verklaard, geen archief
p(`AS 1b geadministreerd (structuur/manifest) maar niet bij Uscreen : ${werk.as1b_geadministreerd_maar_niet_bij_uscreen.length}  (vervallen-allowlist verklaart structuur ${info.vervallen_verklaard.structuur} · manifest ${info.vervallen_verklaard.manifest})`);
p(`AS 1c manifest-video's met meer dan één regel : ${manDubbel.length}${manDubbel.length ? ` (${manDubbel.slice(0, 6).map((x) => `${x.id}×${x.keer}${x.sha_verschilt ? ' SHA VERSCHILT' : ''}`).join(', ')})` : ''}`);

// ── AS 2: elke collectie heeft een archiefmap ──
// C10: een collectie mét afleveringen en zónder map is altijd een punt; "bewust leeg" dempt niets meer.
// Staat een bewust-leeg-id tóch met afleveringen bij Uscreen, dan is dat een eigen melding.
const as2 = cols.filter((c) => !serieVan.has(String(c.id)) && (c.items ?? []).some((i) => i.video_id));
werk.as2_collectie_zonder_map = as2.map((c) => ({ id: c.id, titel: c.title, afl: (c.items ?? []).filter((i) => i.video_id).length, bewust_leeg: bewustLeeg.has(String(c.id)) }));
const bewustLeegMetItems = as2.filter((c) => bewustLeeg.has(String(c.id))).length;
info.bewust_leeg_met_afleveringen = bewustLeegMetItems;
p(`AS 2  collecties zonder archiefmap : ${as2.length}  (bewust-leeg-lijst: ${bewustLeeg.size}${bewustLeegMetItems ? ` — waarvan ${bewustLeegMetItems} met afleveringen bij Uscreen: lijst nakijken` : ''})`);
// C18: bestaat élke seriemap uit structuur-series.jsonl ook fysiek op de NAS?
const mapSet = new Set(mappen.map((m) => m.pad));
const as2b = [];
for (const s of series) for (const d of s.dirs) if (!mapSet.has(d)) as2b.push({ collection: s.collection, map: d });
werk.as2b_seriemap_ontbreekt_op_nas = as2b;
const as2bAfl = as2b.reduce((a, x) => a + (serieVan.get(String(x.collection))?.eps.length ?? 0), 0);
p(`AS 2b seriemappen uit structuur-series die op de NAS ontbreken : ${as2b.length}${as2b.length ? ` (${as2bAfl} afleveringen eronder tellen ook in AS 1/3)` : ''}`);
info.series_zonder_uscreen_collectie = series.filter((s) => !colVan.has(String(s.collection))).map((s) => String(s.collection));   // C3: vallen buiten AS 2b/6/8

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
const as6 = []; const as6dub = []; const as6over = [];   // as6over (C3): series die de as niet kan beoordelen
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
  if (volg.some((x) => x === null)) { as6over.push({ id: c.id, titel: c.title, reden: 'aflevering zonder NN-prefix' }); continue; }
  if (volg.length < 2) continue;
  const fout = volg.filter((x, i) => x !== i + 1).length;
  if (fout) as6.push({ id: c.id, titel: c.title, afl: volg.length, posities_anders: fout, dirs: s.dirs.length });
}
werk.as6_volgorde_wijkt_af = as6;
info.as6_ontdubbeld = as6dub;                      // informatief, GEEN openstaand punt
info.as6_niet_beoordeelbaar = as6over;
p(`AS 6  series met afwijkende volgorde : ${as6.length}  (gevolg van de append-only regel van 11-08)`);
p(`AS 6  ontdubbeld op video_id         : ${as6dub.length} series, ${as6dub.reduce((a, x) => a + x.dubbel, 0)} dubbel getoonde items`
  + (as6dub.length ? ' — ' + as6dub.map((x) => `${x.id}: ${x.dubbel}`).join(', ') : ''));
p(`AS 6  niet beoordeelbaar             : ${as6over.length} series (aflevering zonder NN-prefix)`);

// ── AS 7 + 11 + 12: NAS-kant ──
werk.as11c_manifestregel_onleesbaar = manifestOnleesbaar;   // altijd (gratis), ook met --snel
if (SNEL) {
  p('\nAS 7/11a/11b/12 NIET GEMETEN (--snel) — dit rapport is geen volledige audit');
  info.niet_gemeten = ['as7', 'as11a', 'as11b', 'as12'];
} else {
  const manPaden = new Map();
  for (const r of man) {
    if (r.dest) manPaden.set(r.dest, r);
    for (const lk of String(r.links ?? '').split('|')) if (lk) manPaden.set(lk, r);
  }
  // Werk- en administratiemappen (WERKMAPPEN, module-scope) horen niet bij de archiefinhoud. Expliciet benoemd i.p.v.
  // stilzwijgend weggefilterd: het aantal genegeerde bestanden wordt gerapporteerd, zodat "0 afwijkingen" nooit een
  // verborgen filter verbergt.
  const buitenArchief = (pad) => NEGEER_MAP.some((m) => pad.startsWith(m)) || !pad.includes('/');
  const genegeerd = bestanden.filter((b) => buitenArchief(b.pad)).length;
  p(`      (${genegeerd} bestanden in werk-/administratiemappen buiten beschouwing: ${NEGEER_MAP.join(' ')}en losse bestanden in de wortel)`);
  // C15: AS 7 meet wat het label zegt — media op de NAS waarvan de manifest-video-id niet (meer) bij Uscreen bestaat en
  // niet op de vervallen-allowlist staat; per id (één punt, alle plekken). Media zónder manifestregel zijn AS 11b (daar
  // geteld, hier alleen als subtotaal gemeld — niet dubbel in TOTAAL); kind 'buiten-uscreen' is verklaard en wordt gemeld.
  const media = bestanden.filter((b) => isMedia(b.pad) && !buitenArchief(b.pad));
  const as7per = new Map(); let as7zonder = 0; let as7buiten = 0; const as7ander = {};
  for (const b of media) {
    const r = manPaden.get(b.pad);
    if (!r) as7zonder++;
    else if (r.kind === 'buiten-uscreen') as7buiten++;
    else if (r.kind !== 'video') as7ander[r.kind] = (as7ander[r.kind] ?? 0) + 1;   // bv. een .mp4 als bijlage — verklaard, gemeld
    else if (r.kind === 'video' && !uscVid.has(String(r.id)) && !vervallen.has(String(r.id))) {
      const id = String(r.id); if (!as7per.has(id)) as7per.set(id, { id, bytes: b.bytes, plekken: [] });
      as7per.get(id).plekken.push(b.pad);
    }
  }
  const as7 = [...as7per.values()];
  werk.as7_bestand_onbekend_bij_uscreen = as7;
  info.as7_media_zonder_manifestregel = as7zonder;   // ⊂ AS 11b
  info.as7_buiten_uscreen_verklaard = as7buiten;
  info.as7_media_met_ander_kind = as7ander;
  p(`\nAS 7  media op de NAS met een video-id dat Uscreen niet kent : ${as7.length}` +
    (as7.length ? ` (${(as7.reduce((a, x) => a + x.bytes, 0) / 1e9).toFixed(1)} GB)` : '') +
    ` · zonder manifestregel ${as7zonder} (telt in AS 11b) · 'buiten-uscreen' verklaard ${as7buiten} · ander kind ${Object.entries(as7ander).map(([k, v]) => `${k} ${v}`).join(', ') || 0}`);
  for (const x of as7.slice(0, 15)) p(`        ${(x.bytes / 1e6).toFixed(0)} MB  ${x.plekken[0]}  (id ${x.id}, ${x.plekken.length} plek(ken))`);

  const as11a = [...manPaden.keys()].filter((x) => !padSet.has(x));
  const as11b = bestanden.filter((b) => !manPaden.has(b.pad) && !buitenArchief(b.pad)).map((b) => b.pad);
  werk.as11a_manifestpad_bestaat_niet = as11a;
  werk.as11b_bestand_niet_in_manifest = as11b;
  p(`AS 11 manifest -> bestandssysteem : ${as11a.length} ontbrekend · bestandssysteem -> manifest : ${as11b.length} ongeregistreerd · onleesbare manifestregels : ${manifestOnleesbaar.length}`);

  const inodeVan = new Map(bestanden.map((b) => [b.pad, b]));
  // C6: élke regel met dest (video, cover, bijlage, tekst). Twee toetsen: per RIJ bestaan alle plekken en delen ze één
  // inode; per INODE is nlink gelijk aan het aantal paden dat de NAS-scan voor die inode kent (elke fysieke hardlink zit
  // in de boom). Niet per rij 'nlink = plekken': het manifest is append-only en registreert plekken soms in aparte rijen
  // (AS 8-hercontrole 02-09) — dat gaf 24 valse punten (review 05-09). Een pad dat in de scan staat maar in geen enkele
  // rij = AS 11b, een manifestpad dat op de NAS ontbreekt = AS 11a (beide niet hier: geen dubbeltelling; de rijen die
  // daardoor niet toetsbaar zijn staan in info). Eén inode geclaimd door meer dan één kind:id = wél een punt (twee
  // 'verschillende' bestanden die stiekem hetzelfde bestand zijn). Opgevolgde rijen worden geteld, niet getoetst.
  const scanPerInode = new Map();
  for (const b of bestanden) { if (!scanPerInode.has(b.inode)) scanPerInode.set(b.inode, []); scanPerInode.get(b.inode).push(b.pad); }
  const as12 = []; const as12kind = {}; const opgevolgd = {}; const claimVan = new Map(); const as12padOntbreekt = [];
  for (const r of man) {
    if (!r.dest) continue;
    if (manPaden.get(r.dest) !== r) { opgevolgd[r.kind] = (opgevolgd[r.kind] ?? 0) + 1; continue; }
    as12kind[r.kind] = (as12kind[r.kind] ?? 0) + 1;
    const plekken = [r.dest, ...String(r.links ?? '').split('|').filter(Boolean)];
    const st = plekken.map((x) => inodeVan.get(x)).filter(Boolean);
    if (st.length !== plekken.length) { as12padOntbreekt.push({ id: r.id, kind: r.kind, plekken }); continue; }   // → AS 11a
    const inodes = new Set(st.map((x) => x.inode));
    if (inodes.size !== 1) { as12.push({ id: r.id, kind: r.kind, reden: 'plekken delen niet dezelfde inode', plekken }); continue; }
    const inode = st[0].inode; const claim = `${r.kind}:${r.id}`;
    if (claimVan.has(inode)) { claimVan.get(inode).add(claim); continue; }   // inode al getoetst; alleen de claim erbij
    claimVan.set(inode, new Set([claim]));
    const inBoom = scanPerInode.get(inode) ?? [];
    if (st[0].nlink !== inBoom.length) as12.push({ id: r.id, kind: r.kind, reden: `nlink=${st[0].nlink} maar ${inBoom.length} pad(en) in de scan — hardlink buiten het archief?`, plekken: inBoom });
  }
  for (const [inode, claims] of claimVan) if (claims.size > 1) as12.push({ id: [...claims].join(' + '), kind: 'inode', reden: `één inode (${inode}) geclaimd door ${claims.size} verschillende kind:id`, plekken: scanPerInode.get(inode) ?? [] });
  werk.as12_hardlink_afwijking = as12;
  info.manifest_regels_opgevolgd = opgevolgd;   // C3: append-only manifest — latere regel voor hetzelfde pad wint
  info.as12_niet_toetsbaar_pad_ontbreekt = as12padOntbreekt;   // = AS 11a, daar geteld
  p(`AS 12 hardlink-integriteit : ${as12.length} afwijkingen  (getoetst: ${Object.entries(as12kind).map(([k, v]) => `${k} ${v}`).join(' · ')} · inodes ${claimVan.size}; opgevolgde regels niet getoetst: ${Object.values(opgevolgd).reduce((a, b) => a + b, 0)}; rijen met ontbrekend pad → AS 11a: ${as12padOntbreekt.length})`);
  for (const x of as12.slice(0, 10)) p(`        ${x.kind} ${x.id}: ${x.reden}`);
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
// C5: positief matchen. is_support_ACL = ACL aanwezig; "Linux mode" = geen ACL (het punt); al het andere (tool-fout,
// lege uitvoer) = onmeetbaar — telt mee als open punt, wordt nooit als "zichtbaar" geboekt. rc staat er als diagnostiek
// bij (Linux mode is zelf rc ≠ 0). Werkmappen (WERKMAPPEN, zelfde lijst als AS 7/11) apart: geen archiefinhoud.
const isWerkmap = (r) => WERKMAPPEN.has(r.map);
const zonderAcl = (r) => /Linux mode/i.test(r.acl);
const onmeetbaar = (r) => !zonderAcl(r) && !/is_support_ACL/.test(r.acl);
const as10 = rechten.filter((r) => !isWerkmap(r) && zonderAcl(r));
const as10onm = rechten.filter((r) => !isWerkmap(r) && onmeetbaar(r));
const as10werk = rechten.filter(isWerkmap);
werk.as10_topmap_zonder_acl = as10.map((r) => ({ map: r.map, mode: r.mode }));
werk.as10b_topmap_onmeetbaar = as10onm.map((r) => ({ map: r.map, mode: r.mode, uitvoer: r.acl.slice(0, 80), rc: r.rc }));
info.as10_werkmappen_zonder_acl = as10werk.filter(zonderAcl).map((r) => r.map);
info.as10_werkmappen_onmeetbaar = as10werk.filter(onmeetbaar).map((r) => r.map);   // C3: nooit stil
p(`AS 10 inhoudsmappen zonder Synology-ACL : ${as10.length} van ${rechten.length - as10werk.length} · onmeetbaar: ${as10onm.length} · werkmappen zonder ACL (apart, ${info.as10_werkmappen_zonder_acl.length}): ${info.as10_werkmappen_zonder_acl.join(' ') || '-'}`);
for (const r of as10.slice(0, 30)) p(`        ${r.mode}  ${r.map}`);
for (const r of as10onm.slice(0, 10)) p(`        ONMEETBAAR rc=${r.rc}  ${r.map}: ${r.acl.slice(0, 60)}`);

// ── uitkomst ──
const tel = Object.fromEntries(Object.entries(werk).map(([k, v]) => [k, v.length]));
const totaal = Object.values(tel).reduce((a, b) => a + b, 0);
p('\n' + '='.repeat(80));
p(`TOTAAL OPENSTAANDE PUNTEN: ${totaal}${SNEL ? '  (AS 7/11a/11b/12 NIET gemeten: --snel)' : ''}`);
for (const [k, v] of Object.entries(tel)) if (v) p(`   ${String(v).padStart(6)}  ${k}`);
if (!totaal && !SNEL) p('   Alle assen nul — archief is compleet én correct.');
if (!totaal && SNEL) p('   Gemeten assen nul — maar AS 7/11a/11b/12 zijn NIET gemeten (--snel): geen uitspraak over compleetheid.');
fs.writeFileSync(path.join(AUD, 'werklijst.json'), JSON.stringify({ ...werk, _info: info }, null, 1));
fs.writeFileSync(path.join(AUD, 'AUDIT-VOLLEDIG.txt'), R.join('\n') + '\n');
p(`\nwerklijst -> ${path.join(AUD, 'werklijst.json')}`);
p(`rapport   -> ${path.join(AUD, 'AUDIT-VOLLEDIG.txt')}`);
