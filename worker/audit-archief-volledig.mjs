/**
 * audit-archief-volledig.mjs — brede integriteitscontrole van het NAS-archief
 * (2026-08-22). Beantwoordt: "klopt het archief, of zitten er nog fouten in —
 * kwaliteit, covers, bijlagen, hardlinks, manifest?"
 *
 * Leest ALLES read-only:
 *   NAS   : find (pad|bytes|nlink|inode) over de hele boom, lege mappen,
 *           manifest.jsonl, done/-markers, fouten.log
 *   lokaal: archief/structuur.jsonl (bevroren toewijzing = wat er hóórt te staan),
 *           structuur-series.jsonl, uscreen-video-details.jsonl (duur → bitrate),
 *           uscreen-file-resources.jsonl + ~/.albunyaan-cc/resources (bijlagen),
 *           archief/fouten-mac.log (reden per overgeslagen video)
 *
 * Controles:
 *   1. video's: verwachte plek aanwezig? (incl. hardlink-plekken) + reden bij afwezig
 *   2. lege bestanden (0 bytes) en lege mappen
 *   3. manifest ↔ werkelijkheid: verdwenen dest, bytes-afwijking, niet-gemanifesteerde
 *      bestanden
 *   4. hardlinks: elke link-plek bestaat én deelt hetzelfde inode als het origineel
 *   5. bijlagen: alle 107 originelen aanwezig, grootte vs Uscreen-opgave
 *   6. covers: serie-, losse-video- en channelcovers geteld en op 0 bytes gecontroleerd
 *   7. KWALITEIT: bitrate = bytes*8/duur per video; verdacht laag (<300 kbps) en
 *      mini-bestanden (<1 MB) worden met naam gemeld — vangt afgekapte downloads
 *      en bestanden die géén mezzanine zijn
 *
 * Draaien (vanuit worker/): node audit-archief-volledig.mjs
 * Rapport: ~/.albunyaan-cc/archief/audit-archief-volledig.txt
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const RESDIR = path.join(CC, 'resources');
const RAPPORT = path.join(OUTDIR, 'audit-archief-volledig.txt');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const ts = () => new Date().toISOString().slice(11, 19);
const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];

function nas(cmd, label) {
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS, cmd],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 30 * 60_000 });
  if (r.status !== 0) { console.error(`${label} mislukt: ${(r.stderr || '').slice(0, 300)}`); process.exit(1); }
  return r.stdout;
}

console.log(`[${ts()}] NAS-boom inlezen…`);
const boom = nas(`cd ${BASE} && find . -type f -exec stat -c '%s|%h|%i|%n' {} + 2>/dev/null`, 'find');
const bestanden = new Map(); // pad → {bytes, nlink, inode}
for (const l of boom.split('\n')) {
  const m = l.match(/^(\d+)\|(\d+)\|(\d+)\|\.\/(.+)$/);
  if (m) bestanden.set(m[4], { bytes: +m[1], nlink: +m[2], inode: m[3] });
}
console.log(`[${ts()}] ${bestanden.size} bestanden`);
const legeMappen = nas(`cd ${BASE} && find . -type d -empty 2>/dev/null | grep -v '^\\./done$' | head -200`, 'lege mappen')
  .split('\n').filter(Boolean).map((s) => s.replace(/^\.\//, ''));
console.log(`[${ts()}] manifest + markers inlezen…`);
const manifestRuw = nas(`cd ${BASE} && cat manifest.jsonl`, 'manifest');
const manifest = manifestRuw.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const markers = new Set(nas(`cd ${BASE} && ls done 2>/dev/null`, 'markers').split('\n').filter(Boolean));
const foutenNas = nas(`cd ${BASE} && cat fouten.log 2>/dev/null`, 'fouten').split('\n').filter(Boolean);

const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const details = readJsonl(path.join(CC, 'uscreen-video-details.jsonl'));
const duur = new Map(details.map((d) => [String(d.id), d.duration]));
const titel = new Map(details.map((d) => [String(d.id), d.title]));
const resMeta = readJsonl(path.join(CC, 'uscreen-file-resources.jsonl'));
const foutenMac = fs.existsSync(path.join(OUTDIR, 'fouten-mac.log'))
  ? fs.readFileSync(path.join(OUTDIR, 'fouten-mac.log'), 'utf8').split('\n').filter(Boolean) : [];
const redenPerId = new Map();
for (const l of foutenMac) {
  const m = l.match(/(PREP GEWEIGERD|PREP TIMEOUT|HEAD MISLUKT|GEEN HEAD-INFO|API MISLUKT)\s+(\d+)/);
  if (m) redenPerId.set(m[2], m[1] + (l.includes('404') ? ' (404)' : ''));
}

const R = [];
const P = (s = '') => R.push(s);
P(`AUDIT ARCHIEF VOLLEDIG — ${new Date().toISOString().slice(0, 19)}Z`);
P(`NAS: ${bestanden.size} bestanden · manifest ${manifest.length} regels · done-markers ${markers.size} · structuur ${struct.length} rijen`);
P();

// ── 1. video's op hun verwachte plek ──
const videoPad = new Map(); // pad → id
for (const s of struct) {
  videoPad.set(`${s.dest}.mp4`, String(s.id));
  for (const l of (s.ook_in ?? [])) videoPad.set(`${l}.mp4`, String(s.id));
}
const mistPad = [], mistId = new Map();
for (const [p, id] of videoPad) {
  if (!bestanden.has(p)) { mistPad.push(p); (mistId.get(id) ?? mistId.set(id, []).get(id)).push(p); }
}
const idsMet = new Set();
for (const [p, id] of videoPad) if (bestanden.has(p)) idsMet.add(id);
const alleIds = new Set([...videoPad.values()]);
const idsZonder = [...alleIds].filter((i) => !idsMet.has(i));
P('== 1. VIDEO\'S ==');
P(`verwachte plekken: ${videoPad.size} (${alleIds.size} unieke video's) · aanwezig: ${videoPad.size - mistPad.length} · ontbreekt: ${mistPad.length}`);
P(`video's volledig afwezig (nergens): ${idsZonder.length} · video's die op SOMMIGE plekken ontbreken: ${[...mistId.keys()].filter((i) => idsMet.has(i)).length}`);
const perReden = {};
for (const id of idsZonder) { const r = redenPerId.get(id) ?? 'GEEN LOGREGEL (nooit aan de beurt geweest)'; (perReden[r] ??= []).push(id); }
for (const [r, ids] of Object.entries(perReden).sort((a, b) => b[1].length - a[1].length)) P(`   ${r}: ${ids.length}`);
P();
P('   -- volledig ontbrekende video\'s (id · reden · titel) --');
for (const id of idsZonder.slice(0, 500)) P(`   ${id}  ${redenPerId.get(id) ?? 'geen logregel'}  ${(titel.get(id) ?? '').slice(0, 70)}`);
if (idsZonder.length > 500) P(`   … en nog ${idsZonder.length - 500}`);
P();
const deelsMist = [...mistId.entries()].filter(([i]) => idsMet.has(i));
P(`   -- video's die op sommige plekken ontbreken (hardlink onvolledig): ${deelsMist.length} --`);
for (const [id, paden] of deelsMist.slice(0, 100)) P(`   ${id}  mist: ${paden.join(' | ')}`);
P();

// ── 2. lege bestanden en mappen ──
const leeg = [...bestanden.entries()].filter(([, v]) => v.bytes === 0);
P('== 2. LEGE BESTANDEN / MAPPEN ==');
P(`0-byte bestanden: ${leeg.length}`);
for (const [p] of leeg.slice(0, 50)) P(`   ${p}`);
P(`lege mappen: ${legeMappen.length}`);
for (const d of legeMappen.slice(0, 50)) P(`   ${d}`);
P();

// ── 3. manifest ↔ werkelijkheid ──
const manifestPaden = new Set();
let bytesMismatch = 0, destWeg = 0;
const mmRegels = [], weg = [];
for (const m of manifest) {
  if (!m.dest) continue;
  manifestPaden.add(m.dest);
  for (const l of String(m.links ?? '').split('|').filter(Boolean)) manifestPaden.add(l);
  const f = bestanden.get(m.dest);
  if (!f) { destWeg++; if (weg.length < 40) weg.push(`${m.kind ?? '?'} ${m.id ?? '?'} ${m.dest}`); continue; }
  if (typeof m.bytes === 'number' && m.bytes !== f.bytes) { bytesMismatch++; if (mmRegels.length < 40) mmRegels.push(`${m.dest}: manifest ${m.bytes} ≠ schijf ${f.bytes}`); }
}
const nietInManifest = [...bestanden.keys()].filter((p) => !manifestPaden.has(p)
  && !/^(README-manifest\.txt|_ARCHIEF-STATUS\.html|archive-fetch\.sh|manifest\.jsonl|fouten\.log)/.test(p)
  && !p.startsWith('done/') && !p.startsWith('_queue/') && !p.startsWith('_staging') && !p.startsWith('plat-') && !p.includes('manifest.jsonl'));
P('== 3. MANIFEST ↔ SCHIJF ==');
P(`manifestregels: ${manifest.length} · unieke paden in manifest (incl. links): ${manifestPaden.size}`);
P(`dest uit manifest die NIET meer op schijf staat: ${destWeg}`);
for (const w of weg) P(`   ${w}`);
P(`bytes-afwijking manifest vs schijf: ${bytesMismatch}`);
for (const w of mmRegels) P(`   ${w}`);
P(`bestanden op schijf ZONDER manifestregel: ${nietInManifest.length}`);
for (const p of nietInManifest.slice(0, 60)) P(`   ${p}`);
if (nietInManifest.length > 60) P(`   … en nog ${nietInManifest.length - 60}`);
P();

// ── 4. hardlinks ──
let linkOntbreekt = 0, linkAnderInode = 0;
const linkFout = [];
for (const m of manifest) {
  const links = String(m.links ?? '').split('|').filter(Boolean);
  if (!links.length || !m.dest) continue;
  const bron = bestanden.get(m.dest); if (!bron) continue;
  for (const l of links) {
    const f = bestanden.get(l);
    if (!f) { linkOntbreekt++; if (linkFout.length < 40) linkFout.push(`ONTBREEKT ${l}`); }
    else if (f.inode !== bron.inode) { linkAnderInode++; if (linkFout.length < 40) linkFout.push(`GEEN HARDLINK (kopie) ${l}`); }
  }
}
P('== 4. HARDLINKS ==');
P(`ontbrekende linkplekken: ${linkOntbreekt} · plekken die wél bestaan maar een losse kopie zijn: ${linkAnderInode}`);
for (const f of linkFout) P(`   ${f}`);
P();

// ── 5. bijlagen ──
const lokaleRes = fs.existsSync(RESDIR) ? fs.readdirSync(RESDIR) : [];
const nasBasenames = new Map();
for (const p of bestanden.keys()) {
  const b = p.slice(p.lastIndexOf('/') + 1);
  if (!nasBasenames.has(b)) nasBasenames.set(b, []);
  nasBasenames.get(b).push(p);
}
const parseSize = (s) => { const m = String(s ?? '').match(/([\d.]+)\s*(KB|MB|GB|B)/i); if (!m) return null;
  const f = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase()]; return +m[1] * f; };
let resOk = 0; const resMist = [], resAfw = [];
for (const f of lokaleRes) {
  const rid = (f.match(/^(\d+)__/) ?? [])[1];
  const naam = f.replace(/^\d+__/, '');
  const treffers = nasBasenames.get(naam) ?? [];
  const lokaalBytes = fs.statSync(path.join(RESDIR, f)).size;
  if (!treffers.length) { resMist.push(`${rid} ${naam}`); continue; }
  const opNas = bestanden.get(treffers[0]).bytes;
  if (opNas !== lokaalBytes) resAfw.push(`${rid} ${naam}: NAS ${opNas} ≠ lokaal ${lokaalBytes}`);
  else resOk++;
}
P('== 5. BIJLAGEN (resources) ==');
P(`originelen lokaal: ${lokaleRes.length} · Uscreen kent er ${resMeta.length} · op de NAS teruggevonden met gelijke grootte: ${resOk}`);
P(`niet teruggevonden op de NAS: ${resMist.length}`);
for (const r of resMist) P(`   ${r}`);
P(`grootte wijkt af: ${resAfw.length}`);
for (const r of resAfw) P(`   ${r}`);
const resIdsLokaal = new Set(lokaleRes.map((f) => (f.match(/^(\d+)__/) ?? [])[1]));
const resNietGedownload = resMeta.filter((r) => !resIdsLokaal.has(String(r.id)));
P(`in Uscreen bekend maar nooit lokaal gedownload: ${resNietGedownload.length}`);
for (const r of resNietGedownload) P(`   ${r.id} ${r.title} (${r.size})`);
P();

// ── 6. covers ──
const covers = [...bestanden.keys()].filter((p) => /(^|\/)(cover\.[a-z0-9]+|.+ - cover\.[a-z0-9]+)$/i.test(p));
const coversLeeg = covers.filter((p) => bestanden.get(p).bytes === 0);
const channelCovers = covers.filter((p) => p.startsWith('01 - Channels Live'));
P('== 6. COVERS ==');
P(`coverbestanden totaal: ${covers.length} · waarvan channelcovers: ${channelCovers.length} · 0 bytes: ${coversLeeg.length}`);
for (const p of coversLeeg.slice(0, 30)) P(`   LEEG ${p}`);
P();

// ── 7. kwaliteit: bitrate-plausibiliteit ──
const perId = new Map(); // id → eerste fysieke pad
for (const [p, id] of videoPad) if (bestanden.has(p) && !perId.has(id)) perId.set(id, p);
const verdacht = [], mini = [];
let gemeten = 0, zonderDuur = 0;
for (const [id, p] of perId) {
  const b = bestanden.get(p).bytes; const d = duur.get(id);
  if (b < 1024 * 1024) mini.push({ id, p, b, d });
  if (!d) { zonderDuur++; continue; }
  gemeten++;
  const kbps = (b * 8) / d / 1000;
  if (kbps < 300) verdacht.push({ id, p, b, d, kbps: Math.round(kbps) });
}
verdacht.sort((a, b) => a.kbps - b.kbps);
P('== 7. KWALITEIT (bitrate-plausibiliteit) ==');
P(`gemeten video's: ${gemeten} (zonder bekende duur: ${zonderDuur})`);
P(`< 1 MB (bijna zeker fout): ${mini.length}`);
for (const m of mini.slice(0, 40)) P(`   ${m.id}  ${m.b} bytes  ${m.p}`);
P(`< 300 kbps (verdacht laag): ${verdacht.length}`);
for (const v of verdacht.slice(0, 60)) P(`   ${v.kbps} kbps  ${Math.round(v.b / 1024 / 1024)} MB / ${v.d}s  ${v.id}  ${(titel.get(v.id) ?? '').slice(0, 50)}`);
const alle = [...perId.entries()].map(([id, p]) => ({ id, b: bestanden.get(p).bytes, d: duur.get(id) })).filter((x) => x.d);
const kbpsAlle = alle.map((x) => (x.b * 8) / x.d / 1000).sort((a, b) => a - b);
const pct = (q) => Math.round(kbpsAlle[Math.floor(kbpsAlle.length * q)] ?? 0);
P(`bitrate-verdeling (kbps): p1 ${pct(0.01)} · p10 ${pct(0.10)} · mediaan ${pct(0.5)} · p90 ${pct(0.9)} · p99 ${pct(0.99)}`);
const totaalBytes = [...perId.values()].reduce((a, p) => a + bestanden.get(p).bytes, 0);
P(`totale omvang unieke video's: ${(totaalBytes / 1024 ** 4).toFixed(2)} TB`);
P();

// ── 8. NAS-fouten.log ──
P('== 8. fouten.log op de NAS ==');
P(`${foutenNas.length} regels`);
for (const l of foutenNas.slice(0, 30)) P(`   ${l}`);
fs.writeFileSync(RAPPORT, R.join('\n') + '\n');
console.log(R.slice(0, 40).join('\n'));
console.log(`\n[${ts()}] rapport → ${RAPPORT}`);
