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
 *   1c. volgorde-signaal (AS 6.6, 2026-09-03): volgt de afleveringnummering in
 *       het archief de Uscreen-volgorde? Zelfde definitie als audit-volledig.mjs
 *       as 6 (elke video één keer, eerste voorkomen, aaneengesloten). Alleen
 *       SIGNALEREN — "volgorde: N series afwijkend" + Telegram; de wachter
 *       repareert nooit (volgorde-synchronisatie is een teambesluit).
 *   2. bepaalt wat nieuw is t.o.v. structuur.jsonl;
 *   3. wijst paden toe (achteraan) en breidt structuur.jsonl +
 *      structuur-series.jsonl uit — append-only, met gedateerde backup;
 *   4. zet de nieuwe id's in uscreen-video-ids.jsonl (bronlijst die
 *      archive-request-links.mjs al meeleest);
 *   5. draait archive-request-links.mjs (video's) en archive-extras.mjs
 *      (covers/teksten) — beide idempotent. Mislukt die ophaalronde, dan blijft
 *      het markerbestand archief/OPHAAL-MISLUKT staan en draait de VOLGENDE
 *      ronde stap 5 tóch, ook zonder nieuwe video's (inhaal, 2026-09-03: een
 *      gemiste video stond al in structuur.jsonl en werd anders nooit opgehaald);
 *   6. Telegram-bericht met wat erbij kwam, of met de storing.
 *
 * Fail-honest: bij een verlopen Uscreen-sessie of onbereikbare NAS stopt hij en
 * meldt hij dat; hij verzint nooit een plek en hernoemt nooit iets bestaands.
 * Exitcodes: 0 klaar · 1 structuur ontbreekt · 2 Uscreen-sessie verlopen ·
 * 3 ronde bewust overgeslagen (Uscreen 429 blijft na MAX_429 wachtbeurten) · 4 browser intern stuk · 6 ophaalronde MISLUKT (kind niet gestart of niet met
 * exit 0 geëindigd — stap 5; sinds 2026-09-03, zie "4/5. ophalen"; laat
 * archief/OPHAAL-MISLUKT achter zodat de volgende ronde inhaalt).
 *
 * Tempo (B72a, founder-ja 2026-09-05; T2 harvest-politeness): dezelfde Uscreen-limiet als de audit
 * (audit-volledig.mjs, C7) — minimaal POLITENESS_MS sinds het einde van de vorige admin-call, over
 * alle fasen heen, in de enige weg naar Uscreen (api()); 429 = tempo-limiet, géén sessieverlies:
 * WACHT_429_MS wachten en dezelfde call herhalen, max MAX_429 keer per ronde, daarna exit 3.
 * Plaatsing (lib/archief-plaatsing.mjs, B57/B74/B75 2026-09-05): seriepad per collectie + eigen losmap
 * in ELKE directe categorie ("<nn> - <titel>/<titel>", cover/teksten via archive-extras.mjs; admin-gegevens
 * van nieuwe losse video's gaan naar uscreen-video-details-live.jsonl als terugval zolang Supabase ze niet kent).
 * Elke --dry herspeelt het beleid over álle al geadministreerde live video's met een directe categorie en
 * vergelijkt de vorm met structuur.jsonl (AS 13.1-definitie: 0 verschil = het archief voldoet al).
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
import { plaatsVideos, vormTokens, haalCollectieDetails, zonderMislukteCollecties } from './lib/archief-plaatsing.mjs';

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
// fouten-mac.log = het Mac-foutenlog dat archive-request-links/archive-extras ook schrijven (B79 M-2, fail-closed collectie-details)
const ERRLOG = path.join(OUTDIR, 'fouten-mac.log');
const logErr = (msg) => { log(`FOUT: ${msg}`); if (!DRY) fs.appendFileSync(ERRLOG, `${new Date().toISOString()} [wachter] ${msg}\n`); };

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
// Tempo en 429 zitten hier, in de enige weg naar Uscreen (zelfde model als audit-volledig.mjs, C7):
//  - minimaal POLITENESS_MS sinds het EINDE van de vorige call, ook over faseovergangen heen
//    (gemeten 2026-09-03 14:02: 429 na een dag vol audit- en wachterrondes; gelijk tempo = gelijke limiet);
//  - tabverlies: nieuwe tab en opnieuw (max 3 pogingen, pre-existing);
//  - 429 = tempo-limiet, GEEN sessieverlies (de founder hoeft niet in te loggen): WACHT_429_MS wachten
//    en dezelfde call herhalen; na MAX_429 wachtbeurten in één ronde bewust stoppen (Telegram + exit 3).
const POLITENESS_MS = 1800;
const WACHT_429_MS = 90_000;
const MAX_429 = 3;
let laatste = 0; let n429 = 0;
const api = async (pad, body) => {
  for (let poging = 1; ; ) {
    const w = laatste + POLITENESS_MS - Date.now();
    if (w > 0) await sleep(w);
    let r;
    try { r = await apiRuw(pad, body); } catch (e) {
      if (poging >= 3) throw e;
      log(`  pagina kwijt — nieuwe tab (poging ${++poging})`);
      await nieuwePagina(); continue;
    } finally { laatste = Date.now(); }
    if (r.__err === 429) {
      if (++n429 > MAX_429) {
        await tg('[archief-wachter] Uscreen beperkt het tempo (429) — géén sessieprobleem, niet inloggen; deze ronde is overgeslagen, de volgende probeert het opnieuw.');
        console.error(`Uscreen 429 blijft na ${MAX_429} wachtbeurten (${pad} ${JSON.stringify(body)}) — ronde overgeslagen`);
        try { if (!page.isClosed()) await page.close(); } catch { /* al weg */ }   // geen wees-tab: de TAB-GC van de migration-watchdog is uitgeladen (B5)
        process.exit(3);
      }
      log(`  Uscreen 429 (tempo-limiet) op ${pad} ${JSON.stringify(body)} — ${WACHT_429_MS / 1000} s wachten (beurt ${n429}/${MAX_429})`);
      await sleep(WACHT_429_MS); continue;
    }
    return r;
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
  let j = p === 1 ? proef : await api('videos.index', { page: p });
  // Eén tijdelijke 5xx van Uscreen (gemeten 2026-09-03 13:59: p225 → 500) mag niet de
  // hele ronde omgooien: twee herkansingen met oplopende wachttijd, daarna hardop stoppen.
  for (let poging = 1; j.__err && /^5\d\d$/.test(String(j.__err)) && poging <= 2; poging++) {
    log(`  videos.index p${p} gaf ${j.__err} — herkansing ${poging}/2 na ${poging * 5} s`);
    await sleep(poging * 5000);
    j = await api('videos.index', { page: p });
  }
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
let indexOnvolledig = false;   // collections.index brak af → 1b én 1c zijn dan onvolledig
for (let p = 1; p <= 200; p++) {
  const j = await api('contents_collections.index', { page: p, sort: 'created_at[desc]' });
  if (j.__err) { log(`  dekkingscontrole: collections.index p${p} gaf ${j.__err} — overgeslagen (ONVOLLEDIG)`); indexOnvolledig = true; break; }
  for (const c of (j.collections ?? [])) liveCollecties.push({ id: String(c.id), titel: c.title, status: c.status });
  const tot = j.pagination?.total_pages;
  if (!(j.collections ?? []).length || (tot && p >= tot)) break;
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

// ── 1c. VOLGORDE-SIGNAAL (AS 6.6) ─────────────────────────────────────────
// Logica = audit-volledig.mjs "AS 6": per serie de Uscreen-playlist (dividers
// eruit, ontdubbeld op subject_id — Uscreen toont sommige video's op twee
// posities), en het archiefnummer van de k-de unieke video moet k zijn.
// Alleen signaleren. Een detail-call die faalt telt als "niet gecontroleerd",
// nooit stilzwijgend als "goed".
const serieVanCollectie1c = new Map(series.map((s) => [String(s.collection), s]));
const volgordeAfwijkend = [];
let volgordeNietGecontroleerd = 0; let volgordeOntdubbeld = 0; let volgordeGecontroleerd = 0; let volgordeOvergeslagen = 0;
const liveIds = new Set(liveCollecties.map((c) => c.id));
// series zonder live collectie (bij Uscreen verwijderd, bv. 2528068 "A Joke from the First Line", de 12 نكتة):
// niets om tegen te controleren — informatief, geen onvolledigheid van de controle zelf
const volgordeZonderLive = series.filter((s) => !liveIds.has(String(s.collection))).map((s) => String(s.collection));
for (const c of liveCollecties) {
  const s = serieVanCollectie1c.get(c.id); if (!s) continue;
  const j = await api('contents_collections.details', { id: Number(c.id) });
  if (j.__err || !j.collection) { volgordeNietGecontroleerd++; continue; }
  const arch = new Map(s.eps.map((e) => [String(e.id), e.bestand]));
  const items = (j.collection.playlist_items ?? []).filter((i) => i.subject_id).sort((a, b) => a.position - b.position);
  const gezien = new Set(); const volg = [];
  for (const i of items) {
    const vid = String(i.subject_id);
    if (gezien.has(vid)) { volgordeOntdubbeld++; continue; }
    gezien.add(vid);
    if (!arch.has(vid)) continue;
    const m = String(arch.get(vid)).match(/^\s*(\d+)\s*-/); volg.push(m ? +m[1] : null);
  }
  if (volg.length < 2 || volg.some((x) => x === null)) { volgordeOvergeslagen++; continue; } // <2 afl. of nummer onleesbaar: geen oordeel
  volgordeGecontroleerd++;
  const fout = volg.filter((x, i) => x !== i + 1).length;
  if (fout) volgordeAfwijkend.push({ id: c.id, titel: c.titel, afl: volg.length, anders: fout });
}
const volgordeOnvolledig = indexOnvolledig || volgordeNietGecontroleerd > 0;
log(`volgorde: ${volgordeOnvolledig ? 'ONVOLLEDIG GECONTROLEERD — ' : ''}${volgordeAfwijkend.length} series afwijkend ` +
  `(${volgordeGecontroleerd} gecontroleerd` +
  `${volgordeOvergeslagen ? ` · ${volgordeOvergeslagen} overgeslagen (<2 afl. of nummer onleesbaar)` : ''}` +
  `${volgordeNietGecontroleerd ? ` · ${volgordeNietGecontroleerd} NIET gecontroleerd (detail-call faalde)` : ''}` +
  `${volgordeZonderLive.length ? ` · ${volgordeZonderLive.length} zonder live collectie, niet controleerbaar (${volgordeZonderLive.slice(0, 3).join(', ')})` : ''}` +
  `${indexOnvolledig ? ' · collections.index brak af' : ''}` +
  `${volgordeOntdubbeld ? ` · ${volgordeOntdubbeld} dubbel getoonde items ontdubbeld` : ''})`);
for (const a of volgordeAfwijkend.slice(0, 10)) log(`  VOLGORDE AFWIJKEND: ${a.id} ${a.titel} — ${a.anders} van ${a.afl} posities`);
// Telegram alleen als het BEELD verandert (andere set afwijkende ids, of de controle
// werd onvolledig) — anders komt dezelfde melding elke nacht en leert niemand er meer
// naar te kijken. De logregel hierboven komt wél elke ronde.
const VOLGORDE_LAATST = path.join(OUTDIR, 'VOLGORDE-laatst.json');
const volgordeNu = JSON.stringify({ ids: volgordeAfwijkend.map((a) => a.id).sort(), onvolledig: volgordeOnvolledig });
const volgordeVorig = fs.existsSync(VOLGORDE_LAATST) ? fs.readFileSync(VOLGORDE_LAATST, 'utf8').trim() : null;
if (!DRY && volgordeNu !== volgordeVorig) {
  if (volgordeAfwijkend.length) {
    await tg(`[archief-wachter] volgorde: ${volgordeAfwijkend.length} serie(s) wijken af van de Uscreen-volgorde ` +
      `(${volgordeAfwijkend.slice(0, 3).map((a) => a.id).join(', ')}${volgordeAfwijkend.length > 3 ? ', …' : ''}). ` +
      'Signaal — de wachter repareert dit NIET; volgorde-synchronisatie is een teambesluit (plan AS 6).');
  } else if (volgordeOnvolledig) {
    await tg('[archief-wachter] volgorde-controle ONVOLLEDIG (detail-calls of collections.index faalden) — 0 afwijkingen is dus geen bewijs; logboek nakijken.');
  } else if (volgordeVorig) {
    await tg('[archief-wachter] volgorde: alle series volgen weer de Uscreen-volgorde (0 afwijkend).');
  }
  fs.writeFileSync(VOLGORDE_LAATST, volgordeNu + '\n');
}

// ── 4/5. ophalen — definities (hier al, omdat het inhaal-pad ze vóór stap 2/3 nodig heeft) ──
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

// Eén functie voor beide paden (nieuwe video's én inhaal zonder nieuwe video's).
// Write-ahead: de marker OPHAAL-MISLUKT staat er al VOORDAT de kinderen starten
// ("gestart, nog niet afgerond") — sterft de wachter zelf (reboot, kill, uitzondering),
// dan haalt de volgende ronde alsnog in. Mislukt: marker herschreven met reden,
// Telegram, exit 6 — nooit "klaar". Gelukt: marker weg.
// NAS-peiling vooraf: zonder bereikbare NAS leest archive-request-links.mjs done/ als
// leeg en zou het met --negeer-wachtrij de hele catalogus opnieuw aanvragen — daarom
// hier stoppen (marker + Telegram + exit 6) in plaats van de kinderen te starten.
const NAS_SSH = ['-p', '8022', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', 'mostafa@nas.fitrahmedia.nl'];
const nasBereikbaar = () => new Promise((resolve) => {
  const k = spawn('ssh', [...NAS_SSH, 'test -d /volume1/Albunyaan/archief-originelen/done && echo NAS-OK'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
  let uit = ''; k.stdout.on('data', (d) => { uit += d; });
  k.on('error', () => resolve(false)); k.on('close', (st) => resolve(st === 0 && uit.includes('NAS-OK')));
});
async function ophaalronde(nNieuw, nSeries, isInhaal) {
  fs.writeFileSync(MARKER, `${new Date().toISOString()} ophaalronde gestart, nog niet afgerond (${nNieuw} nieuwe video's${isInhaal ? ', inhaal' : ''})\n`);
  const kop = `[archief-wachter] ${nNieuw} nieuwe video's bijgezet · ${nSeries} nieuwe series` + (isInhaal ? ' · plus INHAAL van een eerder mislukte ronde' : '')
    + (videosOvergeslagen.length ? ` · ${videosOvergeslagen.length} video('s) OVERGESLAGEN: collectie-details mislukt (fouten-mac.log; volgende nacht opnieuw)` : '')
    + (extrasTerugvalMislukt ? ` · ${extrasTerugvalMislukt} losmap(pen) ZONDER extras-bron (videos.details mislukte; logboek)` : '');
  if (!(await nasBereikbaar())) {
    fs.writeFileSync(MARKER, `${new Date().toISOString()} NAS onbereikbaar (ssh/done-map) — ophaalronde niet gestart\n`);
    log('MISLUKT: NAS onbereikbaar — ophaalronde niet gestart, OPHAAL-MISLUKT gezet, volgende ronde haalt in');
    await tg(`${kop} · OPHAALRONDE NIET GESTART: NAS onbereikbaar — volgende ronde probeert het opnieuw (OPHAAL-MISLUKT)`);
    process.exit(6);
  }
  const rVideos = await draai('archive-request-links.mjs', ['--batch', '10', '--negeer-wachtrij']);
  const rExtras = await draai('archive-extras.mjs');
  const mislukt = rVideos.status !== 0 || rExtras.status !== 0;
  if (mislukt) fs.writeFileSync(MARKER, `${new Date().toISOString()} video-ronde ${uitleg(rVideos)} · extras ${uitleg(rExtras)}\n`);
  await tg([kop, `video-ronde ${uitleg(rVideos)}`, `covers/teksten ${uitleg(rExtras)}`,
    mislukt ? 'OPHAALRONDE MISLUKT — logboek nakijken; volgende ronde probeert het opnieuw (OPHAAL-MISLUKT)' : ''].filter(Boolean).join(' · '));
  if (mislukt) {
    log('MISLUKT: ophaalronde niet compleet — OPHAAL-MISLUKT gezet, volgende ronde haalt in — logboek nakijken');
    process.exit(6);
  }
  fs.unlinkSync(MARKER);
  if (isInhaal) log('OPHAAL-MISLUKT verwijderd — gemiste ronde ingehaald');
  log('klaar');
}

// ── markerbestand: vorige ophaalronde mislukt? ────────────────────────────
const MARKER = path.join(OUTDIR, 'OPHAAL-MISLUKT');
const inhaal = fs.existsSync(MARKER);   // BESTAAN telt — ook een leeg (handmatig aangeraakt) bestand
const inhaalReden = inhaal ? (fs.readFileSync(MARKER, 'utf8').trim() || '(leeg — handmatig gezet)') : null;
// Tellers voor de Telegram-kop van ophaalronde(): HIER declareren, vóór de vroege exits die ophaalronde() al aanroepen
// (inhaal-pad hieronder). Een `const`/`let` verderop zit dan nog in de TDZ → ReferenceError (koude review 06-09, I-1:
// gold ook al voor extrasTerugvalMislukt sinds a6bb157; het inhaal-pad draaide sindsdien niet).
let videosOvergeslagen = [];     // B79 M-2: video's overgeslagen omdat hun collectie-details mislukten
let extrasTerugvalMislukt = 0;   // B75: videos.details bleef falen → losmap zonder extras-bron (luid in log + Telegram)
const sluitPagina = async () => { try { if (!page.isClosed()) await page.close(); } catch { /* al weg */ } };

if (!nieuweVideos.length && !inhaal && !DRY) {
  log('geen nieuwe video\'s.');
  await tg(zonderMap.length
    ? `[archief-wachter] Geen nieuwe video's, maar ${zonderMap.length} collectie(s) missen een archiefmap.`
    : (volgordeAfwijkend.length || volgordeOnvolledig)
      ? `[archief-wachter] Geen nieuwe video's; volgorde: ${volgordeAfwijkend.length} afwijkend${volgordeOnvolledig ? ' (controle ONVOLLEDIG)' : ''}.`
      : '[archief-wachter] Niets nieuws bij Uscreen — het archief is bij (dekking 100%, volgorde 0 afwijkend).');
  await sluitPagina();
  process.exit(0);
}
if (!nieuweVideos.length && inhaal && !DRY) {
  log(`geen nieuwe video's, maar OPHAAL-MISLUKT staat er (${inhaalReden.slice(0, 120)}) — stap 5 draait om de gemiste ronde in te halen`);
  if (ALLEEN_STRUCTUUR) { log('[alleen-structuur] inhaal niet gedraaid — marker blijft staan'); await sluitPagina(); process.exit(0); }
  await sluitPagina();
  await ophaalronde(0, 0, true);
  process.exit(0);
}
if (!nieuweVideos.length && DRY) log(`geen nieuwe video's${inhaal ? ` (OPHAAL-MISLUKT staat er: ${inhaalReden.slice(0, 80)} — inhaal niet gedraaid in DRY)` : ''} — [DRY] herspeling van het plaatsingsbeleid over het bestaande archief`);

// categorieën + hun inhoud (voor de plaatsing van NIEUWE series)
const cj = await api('categories.index', { page: 1 });
const cats = (cj.categories ?? []).map((c) => ({ id: String(c.id), titel: c.title, positie: c.position }));
const catNr = new Map(cats.map((c) => [c.id, String(c.positie).padStart(2, '0')]));
const catVanItem = new Map();
for (const c of nieuweVideos.length ? cats : []) {   // alleen nodig voor de plaatsing van nieuwe series
  for (let p = 1; p <= 40; p++) {
    const j = await api('categories.show', { id: Number(c.id), page: p });
    if (j.__err) break;
    for (const it of (j.contents ?? [])) {
      const k = String(it.id ?? it.subject_id);
      if (!catVanItem.has(k)) catVanItem.set(k, []);
      if (!catVanItem.get(k).includes(catNr.get(c.id))) catVanItem.get(k).push(catNr.get(c.id));
    }
    if (!(j.contents ?? []).length || j.pagination?.is_last_page) break;
  }
}
log(`${cats.length} categorieën ingelezen${nieuweVideos.length ? '' : ' (alleen index; geen nieuwe video\'s)'}`);

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
// titels + volgorde van nieuwe collecties ophalen
// details van ELKE geraakte collectie: titel + afspeelvolgorde. Die volgorde
// bepaalt in welke volgorde de nieuwe afleveringen genummerd worden — anders
// krijgen ze de volgorde waarin videos.index ze teruggeeft (aanmaakdatum
// aflopend), en dan staat aflevering 5 vóór aflevering 1 in de map.
// Uitweg (stap 5 I-A, 2026-09-06): Uscreen laat verwijderde collectie-id's op video's staan (oogst 05-09: 89 video's met 9
// zwevende id's). Zo'n id zou elke nacht opnieuw "mislukken" en de video voorgoed tegenhouden. Allowlist naar het patroon
// van vervallen-videos.txt: één id per regel, "<id>  # reden"; die id's tellen niet mee als collectie (video krijgt zijn
// overige plekken of de 99-map). De founder zet een id erop na de Telegram/fouten-mac.log-melding — nooit automatisch.
const VERVALLEN_COLL_PAD = path.join(OUTDIR, 'collecties-vervallen.txt');
const collectiesVervallen = new Set(fs.existsSync(VERVALLEN_COLL_PAD)
  ? fs.readFileSync(VERVALLEN_COLL_PAD, 'utf8').split('\n').map((l) => l.split('#')[0].trim()).filter(Boolean) : []);
let vervallenGestript = 0;
for (const v of nieuweVideos) {
  const n = v.collection_ids.length;
  v.collection_ids = v.collection_ids.filter((c) => !collectiesVervallen.has(c));
  vervallenGestript += n - v.collection_ids.length;
}
if (vervallenGestript) log(`${vervallenGestript} vervallen collectie-koppeling(en) genegeerd (collecties-vervallen.txt: ${[...collectiesVervallen].join(', ')})`);
const geraakteCollecties = [...new Set(nieuweVideos.flatMap((v) => v.collection_ids))];
// FAIL-CLOSED (B79 M-2, founder 2026-09-06): mislukte details → die collectie in `collectiesMislukt`, haar video's
// worden deze ronde NIET geplaatst (blijven "nieuw" → volgende ronde opnieuw), regel in fouten-mac.log, teller in de
// Telegram-kop. Vóór 06-09 viel zo'n video stil terug op de 99-map en werd daarna nooit meer herplaatst.
const { collectieInfo, liveRegels, mislukt: collectiesMislukt } = await haalCollectieDetails(geraakteCollecties, api, { sleep, log, logErr }).catch(async (e) => {
  if (e.code !== 'SESSIE') throw e;
  log(`STOP: ${e.message}`);
  await tg(`[archief-wachter] Uscreen-sessie verlopen tijdens de collectie-details — inloggen in de twin Chrome nodig; er is niets geplaatst.`);
  await sluitPagina();
  process.exit(2);
});
const { door, overgeslagen } = zonderMislukteCollecties(nieuweVideos, collectiesMislukt);
videosOvergeslagen = overgeslagen;
if (videosOvergeslagen.length) {
  log(`${videosOvergeslagen.length} video('s) OVERGESLAGEN — collectie-details mislukt voor ${[...collectiesMislukt].join(', ')}; niet geplaatst, volgende ronde opnieuw (fouten-mac.log)`);
  // één regel per VIDEO in fouten-mac.log: archief-check/archief-status zoeken daar op video-id (stap 5 I-B)
  for (const v of videosOvergeslagen) logErr(`OVERGESLAGEN ${v.id} — COLLECTIE-DETAILS MISLUKT (collectie ${v.collection_ids.filter((c) => collectiesMislukt.has(c)).join(', ')}) — ${v.title}`);
  nieuweVideos.splice(0, nieuweVideos.length, ...door);   // const-array: in plaats vervangen, alle aanroepers hierna zien de gefilterde lijst
  if (!nieuweVideos.length && DRY) log('[DRY] geen plaatsbare nieuwe video\'s over — de herspeling hieronder gaat gewoon door');
  if (!nieuweVideos.length && !DRY) {
    await tg(`[archief-wachter] ${videosOvergeslagen.length} nieuwe video('s) OVERGESLAGEN: collectie-details mislukt (${[...collectiesMislukt].join(', ')}) — niets geplaatst; volgende ronde opnieuw. Zie fouten-mac.log; bestaat de collectie niet meer → id in archief/collecties-vervallen.txt.`);
    log('geen plaatsbare nieuwe video\'s over — ronde klaar zonder wijzigingen');
    await sluitPagina();
    // staat OPHAAL-MISLUKT: de gemiste ronde toch inhalen (zelfde tak als "geen nieuwe video's" hierboven) — I-2
    if (inhaal && ALLEEN_STRUCTUUR) log('[alleen-structuur] inhaal niet gedraaid — marker blijft staan');
    if (inhaal && !ALLEEN_STRUCTUUR) await ophaalronde(0, 0, true);
    process.exit(0);
  }
}
const nieuweCollecties = geraakteCollecties.filter((cid) => !serieVanCollectie.has(cid) && !collectiesMislukt.has(cid));
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

// ── plaatsing (lib/archief-plaatsing.mjs): seriepad per collectie + losmap per directe categorie ──
const ctxPlaatsing = () => ({ serieVanCollectie, collectieInfo, catVanItem, catNr, catDirNaam, serieNummers, serieBreedte, epNummer, epBreedte, san });
// [DRY] herspeling (AS 13.1-definitie, B74/B75): élke live video met een directe categorie opnieuw geplaatst met de
// huidige regels op een KOPIE van de administratie, vergeleken met structuur.jsonl op (categorie, serie/los, vorm) —
// nummers verschillen per definitie (append-only). 0 verschil = het bestaande archief voldoet al aan het beleid.
if (DRY) {
  const hernoemdVoor = hernoemd.length;   // de herspeling saneert honderden titels; die horen niet in structuur-hernoemd.log
  const kopie = {
    ...ctxPlaatsing(), collectieInfo: new Map(), catVanItem: new Map(),
    serieVanCollectie: new Map([...serieVanCollectie].map(([k, x]) => [k, { ...x, eps: x.eps.slice() }])),
    serieNummers: new Map(serieNummers), serieBreedte: new Map(serieBreedte), epNummer: new Map(epNummer), epBreedte: new Map(epBreedte),
    san: (naam) => san(naam, '[DRY] herspeling'),
  };
  const serieDirSet = new Set(series.flatMap((x) => x.dirs));
  const structVan = new Map(struct.map((r) => [String(r.id), [r.dest, ...(r.ook_in ?? [])]]));
  const populatie = liveVideos.filter((v) => (v.category_ids ?? []).some((c) => catNr.has(c)) && structVan.has(v.id));
  const her = plaatsVideos(populatie, kopie);
  const verschil = [];
  for (const r of her.nieuweRijen) {
    const nu = vormTokens(structVan.get(r.id), serieDirSet);
    const zou = vormTokens([r.dest, ...r.ook_in], serieDirSet);
    if (nu.join('|') !== zou.join('|')) verschil.push({ id: r.id, nu, zou });
  }
  const alleenVorm = verschil.filter((d) => d.nu.map((t) => t.replace(/:kaal$/, ':losmap')).join('|') === d.zou.join('|'));
  log(`[DRY] herspeling: ${populatie.length} video's met een directe categorie · ${verschil.length} verschil met structuur.jsonl` +
    `${verschil.length ? ` (${alleenVorm.length} alleen vorm kaal→losmap, ${verschil.length - alleenVorm.length} plek(ken))` : ' — het archief voldoet al'}`);
  for (const d of verschil.slice(0, 10)) log(`   ${d.id}  nu: ${d.nu.join(' ')}  →  zou: ${d.zou.join(' ')}`);
  // B79: ook de 99-map herspelen — video's zonder directe categorie én zonder bekende collectie (113 op 05-09).
  const pop99 = liveVideos.filter((v) => structVan.has(v.id) && !(v.category_ids ?? []).some((c) => catNr.has(c))
    && !(v.collection_ids ?? []).some((c) => serieVanCollectie.has(c)));
  const her99 = plaatsVideos(pop99, kopie);
  const verschil99 = her99.nieuweRijen.filter((r) => vormTokens(structVan.get(r.id), serieDirSet).join('|') !== vormTokens([r.dest, ...r.ook_in], serieDirSet).join('|'));
  log(`[DRY] herspeling 99-map: ${pop99.length} video's zonder categorie én zonder bekende collectie · ${verschil99.length} verschil met structuur.jsonl${verschil99.length ? '' : ' — het archief voldoet al'}`);
  for (const r of verschil99.slice(0, 10)) log(`   ${r.id}  nu: ${vormTokens(structVan.get(r.id), serieDirSet).join(' ')}  →  zou: ${vormTokens([r.dest, ...r.ook_in], serieDirSet).join(' ')}`);
  hernoemd.length = hernoemdVoor;
}
const { nieuweRijen, geraakteSeries, losseVideos, lossePlekken } = plaatsVideos(nieuweVideos, ctxPlaatsing());

// ── admin-gegevens van nieuwe video's met een losmap (B75): archive-extras.mjs leest beschrijving/tags/cover
// uit Supabase, waar een nieuwe video nog niet in staat — daarom hier videos.details naar
// uscreen-video-details-live.jsonl (zelfde terugval als uscreen-collection-details-live.jsonl voor nieuwe series).
const liveVideoRegels = new Map();
const serieDirs = new Set([...serieVanCollectie.values()].flatMap((x) => x.dirs));   // incl. de zojuist nieuwe series
const isLosmap = (pad) => pad.split('/').length >= 3 && !serieDirs.has(pad.split('/').slice(0, -1).join('/'));
let losmapVideos = 0;
for (const r of nieuweRijen) {
  if (![r.dest, ...r.ook_in].some(isLosmap)) continue;
  losmapVideos++;
  if (DRY) continue;   // niets wordt geschreven; geen calls tegen de Uscreen-limiet
  // Eén tijdelijke 5xx/netwerkfout mag de extras-bron niet permanent kosten (de video is de volgende ronde
  // "bekend" en wordt nooit opnieuw bevraagd): twee herkansingen zoals videos.index, daarna luid tellen.
  let j = await api('videos.details', { id: Number(r.id) });
  for (let poging = 1; (j.__err || !j.video) && poging <= 2; poging++) {
    log(`  videos.details ${r.id} gaf ${j.__err ?? 'geen video'} — herkansing ${poging}/2 na ${poging * 5} s`);
    await sleep(poging * 5000);
    j = await api('videos.details', { id: Number(r.id) });
  }
  const k = j.video;
  if (!k) { extrasTerugvalMislukt++; log(`  videos.details ${r.id} MISLUKT (${j.__err ?? 'geen video'}) — losmap zonder extras-bron; archive-extras slaat die map over tot Supabase de video kent`); continue; }
  liveVideoRegels.set(String(k.id), {
    id: String(k.id), title: k.title, description_html: k.description ?? '', tags: k.tags ?? [],
    cover: k.big_horizontal_image_url ?? null, category_ids: (k.category_ids ?? []).map(String), updated_at: k.updated_at,
  });
}

const aantalNieuweSeries = [...geraakteSeries.values()].filter((x) => x.nieuw).length;
log(`toewijzing: ${nieuweRijen.length} video's · ${aantalNieuweSeries} nieuwe series · ${losseVideos.length} zonder collectie · ${lossePlekken} losse plekken (losmap) · ${DRY ? `${losmapVideos} video's zouden videos.details krijgen` : `${liveVideoRegels.size} extras-regels${extrasTerugvalMislukt ? ` · ${extrasTerugvalMislukt} extras-terugval MISLUKT` : ''}`}`);
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
if (liveVideoRegels.size) {
  const LIVE_V = path.join(CC, 'uscreen-video-details-live.jsonl');
  const bestaand = readJsonl(LIVE_V).filter((r) => !liveVideoRegels.has(String(r.id)));
  fs.writeFileSync(LIVE_V, [...bestaand, ...liveVideoRegels.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
  log(`${liveVideoRegels.size} videoregels bijgewerkt in uscreen-video-details-live.jsonl`);
}
log(`structuur bijgewerkt (backups: structuur*.jsonl.bak-${stamp})`);

await sluitPagina();
if (ALLEEN_STRUCTUUR) {
  // de nieuwe video's staan nu in structuur.jsonl maar zijn niet opgehaald: marker
  // zetten, anders ziet de volgende ronde "niets nieuws" en blijven ze liggen
  fs.writeFileSync(MARKER, `${new Date().toISOString()} alleen-structuur: ${nieuweRijen.length} video's nog op te halen\n`);
  log(`[alleen-structuur] niets opgehaald — OPHAAL-MISLUKT gezet (${nieuweRijen.length} video's), volgende ronde haalt in`);
  process.exit(0);
}

// ── 4/5. ophalen (definities staan hierboven, vóór de vroege exit) ──
await ophaalronde(nieuweRijen.length, aantalNieuweSeries, inhaal);
process.exit(0);
