#!/usr/bin/env node
// archief-status-html.mjs — bouwt _ARCHIEF-STATUS.html en zet 'm op de NAS.
//
// Waarom: archief-check.mjs beantwoordt "staat deze video al op de NAS?" maar
// vereist een terminal. Dit script giet dezelfde waarheid in één zelfstandig
// HTML-bestand in de archiefmap, zodat iemand zonder terminal het bestand
// dubbelklikt, een link of titel plakt en meteen antwoord krijgt.
//
// Zelfstandig = geen internet, geen server: alle data zit in het bestand.
// Wordt elk uur ververst door LaunchAgent com.albunyaan.archief-status.
//
// Gebruik:  node archief-status-html.mjs [--lokaal]
//   --lokaal  = alleen lokaal schrijven, niet naar de NAS kopiëren (test)
//
// Fail-honest: zonder manifest van de NAS wordt er GEEN bestand geschreven —
// een status-pagina met halve data is erger dan geen pagina.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const NAS_ROOT = '/volume1/Albunyaan/archief-originelen';
const LOKAAL = path.join(OUTDIR, '_ARCHIEF-STATUS.html');
const RUNLOG = path.join(CC, 'archief-run.log');
const ALLEEN_LOKAAL = process.argv.includes('--lokaal');

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 16);
const log = (m) => console.log(`[${ts()}] ${m}`);

function jsonl(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ── bronnen ──
const details = jsonl(path.join(CC, 'uscreen-video-details.jsonl'));
const structRows = jsonl(path.join(OUTDIR, 'structuur.jsonl'));
if (!details || !structRows) { console.error('ONTBREEKT: uscreen-video-details.jsonl of archief/structuur.jsonl'); process.exit(2); }

const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=20', NAS, `cat ${NAS_ROOT}/manifest.jsonl`],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (r.status !== 0 || !r.stdout) {
  console.error(`NAS onbereikbaar — geen pagina geschreven: ${(r.stderr || '').trim().slice(0, 120)}`);
  process.exit(3);
}
const manifest = r.stdout.split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const KLAAR = new Map();
for (const d of manifest) if (d.kind === 'video') KLAAR.set(String(d.id), d);

// ── wachtrijvolgorde: exact zoals archive-request-links.mjs die opbouwt ──
const bronIds = []; const gezien = new Set();
for (const fn of ['uscreen-video-details.jsonl', 'uscreen-video-ids.jsonl']) {
  for (const row of jsonl(path.join(CC, fn)) ?? []) {
    const i = String(row.id);
    if (!gezien.has(i)) { gezien.add(i); bronIds.push(i); }
  }
}
let memberIds = new Set();
try { memberIds = new Set(JSON.parse(fs.readFileSync(path.join(OUTDIR, 'member-visible-ids.json'), 'utf8')).map(String)); } catch { /* bronvolgorde */ }
const volgorde = [...bronIds.filter((i) => memberIds.has(i)), ...bronIds.filter((i) => !memberIds.has(i))];
const wachtrij = new Map();
volgorde.filter((i) => !KLAAR.has(i)).forEach((i, n) => wachtrij.set(i, n + 1));

// ── geweigerd/gefaald uit het runlog ──
const geweigerd = new Map();
if (fs.existsSync(RUNLOG)) {
  for (const l of fs.readFileSync(RUNLOG, 'utf8').split('\n')) {
    const m = l.match(/PREP GEWEIGERD (\d+): (.*)$/);
    if (m) geweigerd.set(m[1], m[2].trim().slice(0, 80));
  }
}

// ── gemeten tempo (laatste 24 u) ──
const grens = Date.now() - 24 * 3600 * 1000;
let laatste24 = 0;
for (const d of manifest) {
  if (d.kind !== 'video' || !d.done_at) continue;
  const t = Date.parse(d.done_at);
  if (Number.isFinite(t) && t >= grens) laatste24 += 1;
}
const perUur = laatste24 > 0 ? laatste24 / 24 : 0;

// ── data plat slaan (categorie/serie apart = veel kleiner bestand) ──
const catIdx = new Map(); const serIdx = new Map();
const idxVan = (map, s) => { if (!map.has(s)) map.set(s, map.size); return map.get(s); };
const DETAIL = new Map(details.map((d) => [String(d.id), d]));
const rijen = [];
for (const s of structRows) {
  const id = String(s.id);
  const deel = String(s.dest).split('/');
  const cat = deel[0] ?? '';
  const serie = deel.length > 2 ? deel[1] : '';
  const d = DETAIL.get(id);
  let status = 1, extra = wachtrij.get(id) ?? 0;
  if (KLAAR.has(id)) { status = 0; extra = (KLAAR.get(id).done_at || '').slice(0, 10); }
  else if (geweigerd.has(id)) { status = 2; extra = geweigerd.get(id); }
  rijen.push([id, d?.permalink ?? '', d?.title ?? deel[deel.length - 1], idxVan(catIdx, cat), serie ? idxVan(serIdx, serie) : -1, status, extra]);
}
const CATS = [...catIdx.keys()]; const SERIES = [...serIdx.keys()];
const klaarN = rijen.filter((x) => x[5] === 0).length;

// per categorie tellen
const perCat = CATS.map((naam, i) => {
  const r2 = rijen.filter((x) => x[3] === i);
  return [naam, r2.filter((x) => x[5] === 0).length, r2.length];
});

const DATA = JSON.stringify({ CATS, SERIES, R: rijen, perCat });

// ── pagina ──
const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Albunyaan archief — status</title>
<style>
 :root{--groen:#0d7a3e;--oranje:#a35c00;--rood:#a01b1b;--rand:#d8d3c8;--pap:#faf8f4;--ink:#22201c}
 *{box-sizing:border-box}
 body{margin:0;padding:24px;background:var(--pap);color:var(--ink);
      font:17px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
 .wrap{max-width:900px;margin:0 auto}
 h1{font-size:28px;margin:0 0 4px}
 .sub{color:#6b665c;margin:0 0 24px}
 .balk{height:26px;background:#e8e3d8;border-radius:13px;overflow:hidden;margin:12px 0 6px}
 .balk>i{display:block;height:100%;background:var(--groen)}
 .cijfers{display:flex;gap:28px;flex-wrap:wrap;margin-bottom:28px;font-size:15px;color:#4a463e}
 .cijfers b{font-size:22px;color:var(--ink);display:block}
 label{display:block;font-weight:600;margin-bottom:8px;font-size:18px}
 input[type=search]{width:100%;padding:16px 18px;font-size:19px;border:2px solid var(--rand);
   border-radius:10px;background:#fff}
 input[type=search]:focus{outline:none;border-color:#8a8578}
 .hint{color:#6b665c;font-size:15px;margin:8px 0 22px}
 .kaart{border:1px solid var(--rand);border-left-width:8px;border-radius:10px;background:#fff;
   padding:16px 18px;margin-bottom:14px}
 .kaart.k0{border-left-color:var(--groen)} .kaart.k1{border-left-color:var(--oranje)}
 .kaart.k2{border-left-color:var(--rood)}
 .kop{font-size:19px;font-weight:600;margin-bottom:6px}
 .status{font-weight:700;margin-bottom:8px} .k0 .status{color:var(--groen)}
 .k1 .status{color:var(--oranje)} .k2 .status{color:var(--rood)}
 .pad{font-size:14px;color:#57534a;word-break:break-word;direction:ltr;unicode-bidi:plaintext}
 .leeg{color:#6b665c;padding:20px 0}
 details{margin-top:34px;border-top:1px solid var(--rand);padding-top:18px}
 summary{cursor:pointer;font-weight:600;font-size:18px}
 table{border-collapse:collapse;width:100%;margin-top:14px;font-size:15px}
 td,th{padding:8px 10px;border-bottom:1px solid #eae5da;text-align:left}
 th{color:#6b665c;font-weight:600} td:nth-child(2),td:nth-child(3){text-align:right;white-space:nowrap}
 .vt{color:#6b665c;font-size:14px;margin-top:30px;border-top:1px solid var(--rand);padding-top:14px}
</style></head><body><div class="wrap">
<h1>Albunyaan archief — status</h1>
<p class="sub">Staat een video al op de NAS? Plak hieronder de link, de titel of het nummer.</p>

<div class="balk"><i style="width:${((klaarN / rijen.length) * 100).toFixed(1)}%"></i></div>
<div class="cijfers">
 <div><b>${klaarN.toLocaleString('nl-NL')}</b> video's op de NAS</div>
 <div><b>${(rijen.length - klaarN).toLocaleString('nl-NL')}</b> nog te gaan</div>
 <div><b>${((klaarN / rijen.length) * 100).toFixed(1)}%</b> klaar</div>
 <div><b>${perUur ? Math.round(perUur) : '—'}</b> video's per uur (gemeten)</div>
</div>

<label for="q">Zoek een video</label>
<input id="q" type="search" placeholder="albunyaan.tv-link, titel of nummer…" autocomplete="off">
<p class="hint">Bijvoorbeeld: <code>https://albunyaan.tv/programs/ios-c527ff</code> · <code>ios-c527ff</code> · <code>4256127</code> · <code>Kids Place</code></p>
<div id="uit"></div>

<details><summary>Overzicht per categorie</summary>
<table><thead><tr><th>Categorie</th><th>Op de NAS</th><th>Totaal</th></tr></thead><tbody>
${perCat.map(([n, k, t]) => `<tr><td>${n.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td><td>${k}</td><td>${t}</td></tr>`).join('\n')}
</tbody></table></details>

<p class="vt">Bijgewerkt: <b>${ts()}</b> · ververst automatisch elk uur.<br>
Nog niet op de NAS betekent bijna altijd <b>nog niet aan de beurt</b>: het archief werkt de video's af in
één vaste volgorde (eerst alles wat leden kunnen zien), niet categorie voor categorie. Een half gevulde
map is dus normaal tot de hele run klaar is. Een <span style="color:var(--rood)">rode</span> uitkomst is
het enige dat aandacht vraagt.</p>
</div>
<script>
const D=${DATA};
const el=document.getElementById('uit'), q=document.getElementById('q');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function pad(r){const c=D.CATS[r[3]],s=r[4]>=0?D.SERIES[r[4]]:'';return c+(s?' / '+s:'')}
function kaart(r){
 const [id,perma,titel,,,st,ex]=r;
 let status,uitleg;
 if(st===0){status='✅ Staat op de NAS';uitleg='Gearchiveerd en gecontroleerd op '+ex+'.';}
 else if(st===2){status='⛔ Niet opgehaald';uitleg='Uscreen gaf een foutmelding bij deze video ('+esc(ex)+'). Dit is er één om te melden — hij komt ook in het eindrapport.';}
 else {const p=ex||0;const d=${perUur ? perUur.toFixed(2) : 0};
   uitleg='Plek '+p.toLocaleString('nl-NL')+' in de wachtrij'+(d>0?' — verwacht over ongeveer '+(p/d/24).toFixed(1)+' dagen':'')+'. Dit is geen fout.';
   status='⏳ Komt nog';}
 return '<div class="kaart k'+st+'"><div class="kop">'+esc(titel)+'</div>'+
  '<div class="status">'+status+'</div><div>'+uitleg+'</div>'+
  '<div class="pad">Plek in het archief: '+esc(pad(r))+'<br>Nummer: '+id+(perma?' · '+esc(perma):'')+'</div></div>';
}
function zoek(){
 const t=q.value.trim(); if(!t){el.innerHTML='';return}
 const m=t.match(/\\/programs\\/([A-Za-z0-9_-]+)/); const perma=m?m[1]:t;
 let hits=D.R.filter(r=>r[0]===t||r[1]===perma);
 if(!hits.length){const n=t.toLowerCase();hits=D.R.filter(r=>String(r[2]).toLowerCase().includes(n));}
 if(!hits.length){el.innerHTML='<p class="leeg">Niets gevonden. Probeer de titel, of het nummer uit de link.</p>';return}
 el.innerHTML=(hits.length>25?'<p class="leeg">'+hits.length+' treffers — hier de eerste 25.</p>':'')+
   hits.slice(0,25).map(kaart).join('');
}
q.addEventListener('input',zoek);
</script></body></html>`;

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(LOKAAL, html);
const mb = (Buffer.byteLength(html) / 1048576).toFixed(1);
log(`pagina gebouwd: ${rijen.length} video's, ${klaarN} klaar, ${mb} MB → ${LOKAAL}`);

if (ALLEEN_LOKAAL) { log('--lokaal: niet naar de NAS gekopieerd'); process.exit(0); }
// scp naar Synology vereist -O (vaste les)
const c = spawnSync('scp', ['-O', '-P', NAS_PORT, LOKAAL, `${NAS}:${NAS_ROOT}/_ARCHIEF-STATUS.html`], { encoding: 'utf8' });
if (c.status !== 0) { console.error(`scp MISLUKT: ${(c.stderr || '').trim().slice(0, 150)}`); process.exit(4); }
log(`op de NAS gezet: ${NAS_ROOT}/_ARCHIEF-STATUS.html`);
