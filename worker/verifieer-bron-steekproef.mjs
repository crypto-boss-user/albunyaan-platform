/**
 * verifieer-bron-steekproef.mjs — bewijst per video dat het gearchiveerde
 * bestand de HUIDIGE "Request download"-bron van Uscreen is (2026-08-24).
 *
 * Waarom: de eindaudit vond 17 bestanden met een lagere hoogte dan de
 * resolution_tier in de admin en 4 bestanden waarvan de bytes afwijken van de
 * grootte die bij de oorspronkelijke prep werd opgegeven. Beide kunnen twee
 * dingen betekenen: (a) we hebben een streamingkopie i.p.v. het origineel, of
 * (b) de admin-tier/oude opgave zegt iets anders dan het bronbestand zelf.
 * Deze toets beslist dat: vraag NU een verse downloadlink en vergelijk de
 * Content-Length met de bytes op de NAS. Gelijk = zelfde bestand = origineel.
 *
 * Draaien (vanuit worker/): node verifieer-bron-steekproef.mjs <id> [<id> …]
 *                            node verifieer-bron-steekproef.mjs --bestand ids.txt
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const NAS = 'mostafa@nas.fitrahmedia.nl', NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bestandArg = process.argv.indexOf('--bestand');
const ids = bestandArg > 0
  ? fs.readFileSync(process.argv[bestandArg + 1], 'utf8').split(/\s+/).filter(Boolean)
  : process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (!ids.length) { console.error('geen ids opgegeven'); process.exit(1); }

const struct = fs.readFileSync(path.join(CC, 'archief', 'structuur.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));
const destVan = new Map(struct.map((r) => [String(r.id), `${r.dest}.mp4`]));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
const api = (pad, body) => page.evaluate(async ([pad, body]) => {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    return r.ok ? await r.json() : { __err: r.status };
  } catch (e) { return { __err: String(e.message || e).slice(0, 80) }; } finally { clearTimeout(t); }
}, [pad, body]);
const headLen = (url) => page.evaluate(async (url) => {
  try { const r = await fetch(url, { method: 'HEAD' });
    return { status: r.status, len: Number(r.headers.get('content-length') || 0), type: r.headers.get('content-type') };
  } catch (e) { return { fout: String(e.message || e).slice(0, 60) }; }
}, url);

// bytes op de NAS in één keer ophalen
const paden = ids.map((id) => destVan.get(id)).filter(Boolean);
const uit = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS,
  `cd ${BASE} && cat > /tmp/_v.txt && while IFS= read -r p; do printf '%s|%s\\n' "$(stat -c %s "$p" 2>/dev/null || echo 0)" "$p"; done < /tmp/_v.txt; rm -f /tmp/_v.txt`],
  { encoding: 'utf8', input: paden.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
const nasBytes = new Map();
for (const l of (uit.stdout || '').split('\n')) { const m = l.match(/^(\d+)\|(.+)$/); if (m) nasBytes.set(m[2], +m[1]); }

console.log(`[${ts()}] ${ids.length} video's: verse downloadlink aanvragen en HEAD vergelijken\n`);
const R = [];
for (const id of ids) {
  const dest = destVan.get(id);
  const opSchijf = dest ? nasBytes.get(dest) ?? 0 : 0;
  const rd = await api('videos.request_download', { id: Number(id) });
  if (rd.__err) { R.push({ id, oordeel: `PREP GEWEIGERD (${rd.__err})`, opSchijf }); console.log(`${id}: prep geweigerd (${rd.__err})`); continue; }
  let url = null;
  for (let i = 0; i < 60; i++) {           // max 10 min per video
    await sleep(10000);
    const d = await api('videos.details', { id: Number(id) });
    const u = d?.video?.master_url;
    if (u && u !== 'preparing') { url = u; break; }
  }
  if (!url) { R.push({ id, oordeel: 'GEEN VERSE LINK (prep-timeout)', opSchijf }); console.log(`${id}: geen verse link binnen 10 min`); continue; }
  const h = await headLen(url);
  const gelijk = h.len && h.len === opSchijf;
  R.push({ id, opSchijf, bron: h.len ?? 0, oordeel: gelijk ? 'IDENTIEK (archief = huidige bron)' : `AFWIJKEND (bron ${h.len}, schijf ${opSchijf})`, naam: (url.split('/').pop() || '').split('?')[0] });
  console.log(`${id}: schijf ${opSchijf} · bron ${h.len} → ${gelijk ? 'IDENTIEK' : 'AFWIJKEND'} (${(url.split('/').pop() || '').split('?')[0].slice(0, 40)})`);
}
const ok = R.filter((r) => r.oordeel.startsWith('IDENTIEK')).length;
console.log(`\nRESULTAAT: ${ok} van ${R.length} identiek aan de verse Uscreen-bron`);
for (const r of R.filter((x) => !x.oordeel.startsWith('IDENTIEK'))) console.log(`  ${r.id}  ${r.oordeel}`);
fs.writeFileSync(path.join(CC, 'archief', 'bron-verificatie.json'), JSON.stringify(R, null, 1));
await page.close();
process.exit(0);
