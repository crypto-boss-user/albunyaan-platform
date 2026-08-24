/**
 * audit-serie-extras.mjs — sluitende kruiscontrole SERIE-EXTRA'S (2026-08-22).
 *
 * Vraag van het team ("Nimo & Timo mist de beschrijving"): klopt het archief op
 * de NAS met wat Uscreen NU heeft — voor ALLE series tegelijk, niet serie voor
 * serie? Drie kenmerken: beschrijving.txt, zoekwoorden.txt en cover.
 *
 * WAARHEIDSBRON = de Uscreen-ADMIN, niet de storefront-scrape.
 *   POST https://app.uscreen.tv/bullet_api/v1/contents_collections.index
 *        {"page":n,"sort":"created_at[desc]"}   → alle collecties (vers)
 *   POST https://app.uscreen.tv/bullet_api/v1/contents_collections.details
 *        {"id":<ext>}                            → description/tags/cover
 * Reden: harvest-collection-descriptions.mjs las het storefront-fragment
 * /programs/<permalink>/collection_homepage en zocht daar div.editor-content.
 * Dat fragment levert die div voor nieuwere series NIET meer (live bewezen op
 * collection-j1wppf6yhm4 = Nimo & Timo Part 2: fragment leeg, admin + de
 * gerenderde storefrontpagina tonen wél tekst). Elke "" in
 * uscreen-collection-descriptions.jsonl is daarmee verdacht.
 *
 * Vergelijkt per serie (structuur-series.jsonl = bevroren archieftoewijzing):
 *   - beschrijving: admin-tekst  vs  beschrijving.txt in ELKE map van de serie
 *   - zoekwoorden:  unie van afleveringstags (videos.tags in Supabase, de bron
 *                   die archive-extras.mjs gebruikt) vs zoekwoorden.txt
 *                   + apart gemeld: de collectie-tags die de admin zelf voert
 *   - cover:        big_horizontal_image_url (big_-prefix gestript) vs cover.*
 * Fail-honest: elk verschil met naam in het rapport; niets wordt gegokt.
 *
 * Draaien (vanuit worker/):  node audit-serie-extras.mjs [--geen-oogst]
 *   --geen-oogst = admin niet opnieuw bevragen, laatste live-jsonl hergebruiken
 * Output: ~/.albunyaan-cc/uscreen-collection-details-live.jsonl
 *         ~/.albunyaan-cc/archief/audit-serie-extras.txt
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const LIVE = path.join(CC, 'uscreen-collection-details-live.jsonl');
const RAPPORT = path.join(OUTDIR, 'audit-serie-extras.txt');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const SKIP_HARVEST = process.argv.includes('--geen-oogst');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB = process.env.SUPABASE_URL + '/rest/v1';
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

// zelfde HTML→tekst als archive-extras.mjs (anders vergelijk je appels met peren)
function htmlToText(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return lines.filter((l, i) => l || (i > 0 && lines[i - 1])).join('\n').trim();
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripPrefix = (url) => url.replace(/\/(small|big)_([^/]+)$/, '/$2');
const urlExt = (url) => { const m = new URL(url).pathname.match(/\.[A-Za-z0-9]{2,5}$/); return m ? m[0].toLowerCase() : '.jpg'; };

// ── 1. live oogst uit de admin ──
async function harvest() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  let page = await ctx.newPage();
  await page.goto('https://app.uscreen.tv/manage/contents/collections', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  // De gedeelde twin-Chrome kan een tab verliezen tijdens een oogst van ~700
  // calls ("Target page, context or browser has been closed", gezien
  // 2026-08-24). Dan: nieuwe pagina openen en de call herkansen — nooit de
  // laatste pagina sluiten (huisregel van de gedeelde browser).
  const opnieuwPagina = async () => {
    try { if (!page.isClosed()) await page.close(); } catch { /* al weg */ }
    page = await ctx.newPage();
    await page.goto('https://app.uscreen.tv/manage/contents/collections', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
  };
  const apiRuw = async (pad, body) => page.evaluate(async ([pad, body]) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 45000);
    try {
      const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: ac.signal,
      });
      if (!r.ok) return { __err: r.status };
      return await r.json();
    } catch (e) { return { __err: String(e.message || e).slice(0, 120) }; } finally { clearTimeout(t); }
  }, [pad, body]);
  const api = async (pad, body) => {
    for (let poging = 1; ; poging++) {
      try { return await apiRuw(pad, body); } catch (e) {
        if (poging >= 3) throw e;
        console.log(`[${ts()}]   pagina kwijt (${String(e.message).slice(0, 60)}) — nieuwe tab, poging ${poging + 1}`);
        await opnieuwPagina();
      }
    }
  };

  const alle = [];
  for (let p = 1; p <= 100; p++) {
    const j = await api('contents_collections.index', { page: p, sort: 'created_at[desc]' });
    if (j.__err) throw new Error(`index p${p}: ${j.__err}`);
    const rows = j.collections ?? [];
    alle.push(...rows);
    const tot = j.pagination?.total_pages ?? j.pagination?.pages;
    console.log(`[${ts()}] index p${p}: ${rows.length} (totaal ${alle.length}${tot ? ` van ${tot} pagina's` : ''})`);
    if (!rows.length || (tot && p >= tot)) break;
    await sleep(400);
  }
  const out = fs.createWriteStream(LIVE, { flags: 'w' });
  let n = 0, fout = 0;
  for (const c of alle) {
    const j = await api('contents_collections.details', { id: Number(c.id) });
    const k = j.collection;
    if (j.__err || !k) {
      fout++; console.log(`[${ts()}]   DETAILS MISLUKT ${c.id} ${c.title}: ${j.__err ?? 'geen collection-veld'}`);
      out.write(JSON.stringify({ id: String(c.id), title: c.title, status: c.status, __err: j.__err ?? 'geen collection' }) + '\n');
    } else {
      out.write(JSON.stringify({
        id: String(k.id), title: k.title, meta_title: k.meta_title, permalink: k.permalink,
        status: c.status, release_stage: k.release_stage, deleted_at: c.deleted_at,
        description_html: k.description ?? '', tags: k.tags ?? [],
        cover: k.big_horizontal_image_url ?? null, updated_at: k.updated_at,
        n_items: (k.playlist_items ?? []).length,
      }) + '\n');
    }
    if (++n % 50 === 0) console.log(`[${ts()}]   details ${n}/${alle.length}`);
    await sleep(320);
  }
  out.end(); await new Promise((r) => out.on('finish', r));
  await page.close();
  console.log(`[${ts()}] oogst klaar: ${n} collecties, ${fout} mislukt → ${LIVE}`);
}

if (!SKIP_HARVEST) await harvest();
const live = readJsonl(LIVE);
if (!live.length) { console.error('geen live-gegevens — draai zonder --geen-oogst'); process.exit(1); }
const liveById = new Map(live.map((r) => [String(r.id), r]));

// ── 2. NAS-inventaris ──
console.log(`[${ts()}] NAS-inventaris ophalen…`);
const nasCmd = `cd ${BASE} || exit 1
find . -maxdepth 4 \\( -name 'beschrijving.txt' -o -name '*- beschrijving.txt' -o -name 'zoekwoorden.txt' -o -name '*- zoekwoorden.txt' \\) -type f -exec sh -c 'for f; do printf "===BESTAND===%s\\n" "$f"; cat "$f"; done' sh {} + 2>/dev/null
echo '---COVERS---'
find . -maxdepth 4 \\( -name 'cover.*' -o -name '*- cover.*' \\) -type f -exec stat -c '%s|%n' {} + 2>/dev/null`;
const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS, nasCmd], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60_000 });
if (r.status !== 0) { console.error('NAS-inventaris mislukt:', (r.stderr || '').slice(0, 300)); process.exit(1); }
const [txtBlok, covBlok] = r.stdout.split('---COVERS---');
const nasTxt = new Map();   // pad (zonder ./) → inhoud
{
  const delen = txtBlok.split('===BESTAND===');
  for (const d of delen.slice(1)) {
    const nl = d.indexOf('\n'); if (nl < 0) continue;
    const pad = d.slice(0, nl).replace(/^\.\//, '');
    nasTxt.set(pad, d.slice(nl + 1));
  }
}
const nasCov = new Map();   // pad → bytes
for (const l of (covBlok ?? '').split('\n')) {
  const m = l.match(/^(\d+)\|\.\/(.+)$/); if (m) nasCov.set(m[2], Number(m[1]));
}
console.log(`[${ts()}] NAS: ${nasTxt.size} tekstbestanden, ${nasCov.size} covers`);

// archive-extras.mjs schrijft "inhoud + \n"; vergelijk exact én whitespace-tolerant
const gelijkExact = (nasInhoud, wil) => nasInhoud === wil + '\n';
const gelijkNorm = (nasInhoud, wil) => norm(nasInhoud) === norm(wil);

// ── 3. onze bronnen ──
async function sbAll(table, select) {
  const rows = []; const step = 1000;
  for (let from = 0; ; from += step) {
    const res = await fetch(`${SB}/${table}?select=${select}`, { headers: { ...H, Range: `${from}-${from + step - 1}` } });
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    const j = await res.json(); rows.push(...j);
    if (j.length < step) break;              // 1000-rijen-clamp: altijd doorpagineren
  }
  return rows;
}
const videos = await sbAll('videos', 'external_id,tags');
const vTags = new Map(videos.map((v) => [String(v.external_id), v.tags ?? []]));
const dbColl = await sbAll('collections', 'external_id,description');
const dbDesc = new Map(dbColl.map((c) => [String(c.external_id), c.description ?? '']));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
console.log(`[${ts()}] structuur: ${series.length} series · Supabase: ${videos.length} video's, ${dbColl.length} collecties`);

// ── 4. vergelijken ──
const R = [];
const P = (s = '') => { R.push(s); };
const naamVan = (id) => liveById.get(id)?.title ?? liveById.get(id)?.meta_title ?? '(onbekend)';
const groep = { desc: {}, tags: {}, cover: {} };
const push = (g, k, v) => { (g[k] ??= []).push(v); };

for (const s of series) {
  const id = String(s.collection);
  const l = liveById.get(id);
  const dirs = s.dirs;
  const naam = l?.title ?? '(niet meer in Uscreen)';
  // ---- beschrijving ----
  const liveTekst = l ? htmlToText(l.description_html) : '';
  const paden = dirs.map((d) => `${d}/beschrijving.txt`);
  const aanwezig = paden.filter((p) => nasTxt.has(p));
  if (!l) push(groep.desc, 'GEEN_LIVE', { id, naam, dirs });
  else if (liveTekst && aanwezig.length === 0) push(groep.desc, 'ONTBREEKT', { id, naam, dirs, tekst: liveTekst.slice(0, 90) });
  else if (liveTekst && aanwezig.length < paden.length) push(groep.desc, 'DEELS', { id, naam, mist: paden.filter((p) => !nasTxt.has(p)) });
  else if (liveTekst && aanwezig.length) {
    const anders = aanwezig.filter((p) => !gelijkNorm(nasTxt.get(p), liveTekst));
    const witruimte = aanwezig.filter((p) => gelijkNorm(nasTxt.get(p), liveTekst) && !gelijkExact(nasTxt.get(p), liveTekst));
    if (anders.length) push(groep.desc, 'VEROUDERD', { id, naam, anders, updated_at: l.updated_at, nasStart: norm(nasTxt.get(anders[0])).slice(0, 70), liveStart: norm(liveTekst).slice(0, 70) });
    else if (witruimte.length) push(groep.desc, 'ALLEEN_WITRUIMTE', { id, naam, witruimte });
    else push(groep.desc, 'OK', { id, naam });
  } else if (!liveTekst && aanwezig.length) push(groep.desc, 'EXTRA_OP_NAS', { id, naam, aanwezig });
  else push(groep.desc, 'BEIDE_LEEG', { id, naam });

  // ---- zoekwoorden (bron van het archief = unie van afleveringstags) ----
  const tags = [];
  for (const e of s.eps) for (const t of (vTags.get(String(e.id)) ?? [])) if (!tags.includes(t)) tags.push(t);
  const zPaden = dirs.map((d) => `${d}/zoekwoorden.txt`);
  const zAanwezig = zPaden.filter((p) => nasTxt.has(p));
  if (tags.length && zAanwezig.length === 0) push(groep.tags, 'ONTBREEKT', { id, naam, n: tags.length, dirs });
  else if (tags.length && zAanwezig.length < zPaden.length) push(groep.tags, 'DEELS', { id, naam, mist: zPaden.filter((p) => !nasTxt.has(p)) });
  else if (tags.length) {
    const wil = tags.join('\n');
    const anders = zAanwezig.filter((p) => !gelijkExact(nasTxt.get(p), wil));
    if (anders.length) push(groep.tags, 'VEROUDERD', { id, naam, anders, n: tags.length, nas: norm(nasTxt.get(anders[0])).slice(0, 70), live: norm(wil).slice(0, 70) });
    else push(groep.tags, 'OK', { id, naam });
  } else if (zAanwezig.length) push(groep.tags, 'EXTRA_OP_NAS', { id, naam, aanwezig: zAanwezig });
  else push(groep.tags, 'GEEN_TAGS', { id, naam, collectieTags: l?.tags ?? [] });

  // ---- cover ----
  const cUrl = l?.cover && !/fallback\//.test(l.cover) ? stripPrefix(l.cover) : null;
  const ext = cUrl ? urlExt(cUrl) : '.jpg';
  const cPaden = dirs.map((d) => `${d}/cover${ext}`);
  const cAanwezig = cPaden.filter((p) => nasCov.has(p));
  const cAnders = dirs.filter((d) => [...nasCov.keys()].some((p) => p.startsWith(`${d}/cover.`)) && !nasCov.has(`${d}/cover${ext}`));
  if (cUrl && cAanwezig.length === 0 && cAnders.length === 0) push(groep.cover, 'ONTBREEKT', { id, naam, dirs, url: cUrl });
  else if (cUrl && cAanwezig.length + cAnders.length < cPaden.length) push(groep.cover, 'DEELS', { id, naam, mist: cPaden.filter((p) => !nasCov.has(p)) });
  else if (cUrl) push(groep.cover, cAnders.length ? 'ANDERE_EXTENSIE' : 'OK', { id, naam, cAnders });
  else if (cAanwezig.length) push(groep.cover, 'EXTRA_OP_NAS', { id, naam });
  else push(groep.cover, 'GEEN_COVER_BRON', { id, naam });
}

// series die Uscreen wél heeft maar het archief niet kent
const inStruct = new Set(series.map((s) => String(s.collection)));
const nieuw = live.filter((l) => !inStruct.has(String(l.id)) && !l.__err);

// ── 5. rapport ──
const tel = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]));
P(`AUDIT SERIE-EXTRA'S — ${new Date().toISOString().slice(0, 19)}Z`);
P(`bron: Uscreen-admin (contents_collections.index/details) · ${live.length} collecties live · ${series.length} series in structuur.jsonl · NAS ${nasTxt.size} teksten / ${nasCov.size} covers`);
P();
P('== BESCHRIJVING =='); P(JSON.stringify(tel(groep.desc)));
for (const k of ['ONTBREEKT', 'DEELS', 'VEROUDERD', 'ALLEEN_WITRUIMTE', 'EXTRA_OP_NAS', 'GEEN_LIVE']) {
  for (const x of (groep.desc[k] ?? [])) P(`  ${k}  ${x.id}  ${x.naam}${x.tekst ? `  :: ${x.tekst}…` : ''}${x.mist ? `  mist: ${x.mist.join(' | ')}` : ''}${x.anders ? `  afwijkend: ${x.anders.join(' | ')}\n      NAS : ${x.nasStart}…\n      LIVE: ${x.liveStart}…` : ''}`);
}
P();
P('== ZOEKWOORDEN =='); P(JSON.stringify(tel(groep.tags)));
for (const k of ['ONTBREEKT', 'DEELS', 'VEROUDERD', 'EXTRA_OP_NAS']) {
  for (const x of (groep.tags[k] ?? [])) P(`  ${k}  ${x.id}  ${x.naam}${x.n ? `  (${x.n} tags)` : ''}${x.mist ? `  mist: ${x.mist.join(' | ')}` : ''}${x.anders ? `  afwijkend: ${x.anders.join(' | ')}` : ''}`);
}
P();
P('== COVER =='); P(JSON.stringify(tel(groep.cover)));
for (const k of ['ONTBREEKT', 'DEELS', 'ANDERE_EXTENSIE', 'GEEN_COVER_BRON']) {
  for (const x of (groep.cover[k] ?? [])) P(`  ${k}  ${x.id}  ${x.naam}${x.mist ? `  mist: ${x.mist.join(' | ')}` : ''}${x.url ? `  bron: ${x.url}` : ''}`);
}
P();
P(`== COLLECTIES ZONDER ARCHIEFPLEK (${nieuw.length}) ==`);
for (const l of nieuw) P(`  ${l.id}  ${l.status}  ${l.title}  (aangemaakt/bijgewerkt ${l.updated_at})  items:${l.n_items}`);
P();
P('== DB-ACHTERSTAND (Supabase collections.description vs admin) ==');
let stale = 0;
for (const l of live) {
  if (l.__err) continue;
  const liveT = htmlToText(l.description_html); const dbT = htmlToText(dbDesc.get(String(l.id)) ?? '');
  if (norm(liveT) !== norm(dbT)) { stale++; P(`  ${l.id}  ${l.title}  admin:${liveT.length} db:${dbT.length}`); }
}
P(`  totaal afwijkend: ${stale}`);
fs.writeFileSync(RAPPORT, R.join('\n') + '\n');
console.log(R.slice(0, 60).join('\n'));
console.log(`\n[${ts()}] volledig rapport → ${RAPPORT}`);
process.exit(0);
