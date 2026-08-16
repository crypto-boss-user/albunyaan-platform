#!/usr/bin/env node
// archief-check.mjs — "staat deze video al op de NAS, en zo nee, wanneer?"
//
// Beantwoordt in één klap de vraag die tijdens de lopende archiefrun steeds
// terugkomt: een video ontbreekt in een sectie op de NAS — is dat een fout of
// is hij simpelweg nog niet aan de beurt? De run archiveert NIET categorie voor
// categorie (eerst alle member-zichtbare video's, daarna de rest, in
// bronvolgorde), dus een half gevulde sectie is normaal tot de run klaar is.
//
// Gebruik:
//   node archief-check.mjs https://albunyaan.tv/programs/ios-c527ff?category_id=156459
//   node archief-check.mjs ios-c527ff
//   node archief-check.mjs 4256127
//   node archief-check.mjs "Kids Place"          (titelfragment, toont alle treffers)
//   node archief-check.mjs --sectie 24           (hele sectie: wat staat er, wat niet)
//
// Vlaggen:
//   --vers      manifest opnieuw van de NAS halen (anders cache < 10 min)
//   --offline   NIET naar de NAS; alleen de cache gebruiken (fail-honest als die mist)
//
// Fail-honest: als een bron ontbreekt of de NAS niet bereikbaar is, zegt het
// script dat met zoveel woorden in plaats van een half antwoord te geven.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const NAS_MANIFEST = '/volume1/Albunyaan/archief-originelen/manifest.jsonl';
const CACHE = path.join(OUTDIR, 'manifest-cache.jsonl');
const RUNLOG = path.join(CC, 'archief-run.log');
const CACHE_MAX_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const VERS = args.includes('--vers');
const OFFLINE = args.includes('--offline');
const sectieIdx = args.indexOf('--sectie');
const SECTIE = sectieIdx >= 0 ? args[sectieIdx + 1] : null;
// let op: sectieIdx is -1 als --sectie ontbreekt; dan mag index 0 NIET wegvallen
const vrij = args.filter((a, i) => !a.startsWith('--') && !(sectieIdx >= 0 && i === sectieIdx + 1));

if (!vrij.length && !SECTIE) {
  console.error('gebruik: node archief-check.mjs <url|permalink|id|titelfragment> [--vers] [--offline]');
  console.error('     of: node archief-check.mjs --sectie <nn>');
  process.exit(1);
}

// ── bronnen ──
function jsonl(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

const details = jsonl(path.join(CC, 'uscreen-video-details.jsonl'));
if (!details) { console.error(`ONTBREEKT: ${CC}/uscreen-video-details.jsonl — zonder bronlijst geen antwoord`); process.exit(2); }
const structRows = jsonl(path.join(OUTDIR, 'structuur.jsonl'));
if (!structRows) { console.error(`ONTBREEKT: ${OUTDIR}/structuur.jsonl — draai eerst archive-structure.mjs`); process.exit(2); }

const STRUCT = new Map(structRows.map((r) => [String(r.id), r]));
const DETAIL = new Map(details.map((r) => [String(r.id), r]));

// bronvolgorde exact zoals archive-request-links.mjs die opbouwt
const bronIds = [];
const gezien = new Set();
for (const fn of ['uscreen-video-details.jsonl', 'uscreen-video-ids.jsonl']) {
  for (const r of jsonl(path.join(CC, fn)) ?? []) {
    const i = String(r.id);
    if (!gezien.has(i)) { gezien.add(i); bronIds.push(i); }
  }
}
let memberIds = new Set();
const mp = path.join(OUTDIR, 'member-visible-ids.json');
if (fs.existsSync(mp)) {
  try { memberIds = new Set(JSON.parse(fs.readFileSync(mp, 'utf8')).map(String)); } catch { /* val terug op bronvolgorde */ }
}
const volgorde = [...bronIds.filter((i) => memberIds.has(i)), ...bronIds.filter((i) => !memberIds.has(i))];

// ── manifest van de NAS (of cache) ──
function haalManifest() {
  const versGenoeg = fs.existsSync(CACHE) && (Date.now() - fs.statSync(CACHE).mtimeMs) < CACHE_MAX_MS;
  if (OFFLINE || (versGenoeg && !VERS)) {
    if (!fs.existsSync(CACHE)) return { rijen: null, bron: 'GEEN CACHE' };
    const leeftijd = Math.round((Date.now() - fs.statSync(CACHE).mtimeMs) / 60000);
    return { rijen: jsonl(CACHE), bron: `cache (${leeftijd} min oud)` };
  }
  const r = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `cat ${NAS_MANIFEST}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) {
    if (fs.existsSync(CACHE)) {
      const leeftijd = Math.round((Date.now() - fs.statSync(CACHE).mtimeMs) / 60000);
      return { rijen: jsonl(CACHE), bron: `cache (${leeftijd} min oud) — NAS onbereikbaar: ${(r.stderr || '').trim().slice(0, 60)}` };
    }
    return { rijen: null, bron: `NAS onbereikbaar en geen cache: ${(r.stderr || '').trim().slice(0, 80)}` };
  }
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(CACHE, r.stdout);
  return { rijen: jsonl(CACHE), bron: 'live van de NAS' };
}

const { rijen: manifest, bron: manifestBron } = haalManifest();
const KLAAR = new Map();
if (manifest) for (const d of manifest) if (d.kind === 'video') KLAAR.set(String(d.id), d);

// ── tempo uit het manifest zelf (laatste 24 u), niet uit een aanname ──
function tempoPerUur() {
  if (!manifest) return null;
  const grens = Date.now() - 24 * 3600 * 1000;
  let n = 0;
  for (const d of manifest) {
    if (d.kind !== 'video' || !d.done_at) continue;
    const t = Date.parse(d.done_at);
    if (Number.isFinite(t) && t >= grens) n += 1;
  }
  return n > 0 ? n / 24 : null;
}

// ── geweigerd/gefaald in het runlog? ──
function logStatus(id) {
  if (!fs.existsSync(RUNLOG)) return null;
  const uit = [];
  for (const l of fs.readFileSync(RUNLOG, 'utf8').split('\n')) {
    if (!l.includes(String(id))) continue;
    if (/PREP GEWEIGERD|MISLUKT|GEEN HEAD-INFO|TIMEOUT|fout/i.test(l)) uit.push(l.trim());
  }
  return uit.length ? uit : null;
}

// ── invoer → id('s) ──
function resolveer(term) {
  const t = String(term).trim();
  const uitUrl = t.match(/\/programs\/([A-Za-z0-9_-]+)/);
  const permalink = uitUrl ? uitUrl[1] : t;
  if (/^\d+$/.test(t) && DETAIL.has(t)) return [t];
  const opPermalink = details.filter((d) => String(d.permalink || '') === permalink).map((d) => String(d.id));
  if (opPermalink.length) return opPermalink;
  const naald = t.toLowerCase();
  return details.filter((d) => String(d.title || '').toLowerCase().includes(naald)).map((d) => String(d.id));
}

// ── rapport ──
function rapport(id) {
  const d = DETAIL.get(id);
  const s = STRUCT.get(id);
  console.log('─'.repeat(72));
  console.log(`id ${id}  ${d?.title ?? '(titel onbekend)'}`);
  if (d?.permalink) console.log(`   permalink: ${d.permalink}${d.duration ? `   duur: ${d.duration}s` : ''}`);

  if (!d) console.log('   ⚠️  ZIT NIET IN DE BRONLIJST (uscreen-video-details.jsonl) — nooit ingepland');
  if (!s) {
    console.log('   ⚠️  GEEN PLEK IN structuur.jsonl — dit is een ECHTE fout: de video kan nergens heen.');
    console.log('       Actie: melden; structuur mag niet zomaar hergenereerd worden (bevroren toewijzing).');
  } else {
    console.log(`   gepland op: ${s.dest}`);
    if (s.ook_in?.length) console.log(`   ook in    : ${s.ook_in.length} extra plek(ken) (hardlinks)`);
  }

  const klaar = KLAAR.get(id);
  if (klaar) {
    const gb = (klaar.bytes / 1073741824).toFixed(2);
    console.log(`   ✅ STAAT OP DE NAS — ${gb} GB, geverifieerd ${klaar.done_at}`);
    console.log(`      pad: ${klaar.dest}`);
    console.log(`      sha256: ${klaar.sha256?.slice(0, 16)}…`);
    return;
  }
  if (!manifest) { console.log(`   ❓ onbekend of hij al op de NAS staat — ${manifestBron}`); return; }

  const fouten = logStatus(id);
  if (fouten) {
    console.log(`   ❌ DOOR DE RUN GEWEIGERD/GEFAALD (${fouten.length}× in het log):`);
    for (const f of fouten.slice(-3)) console.log(`      ${f}`);
    console.log('      404 = bron waarschijnlijk al op Uscreen verwijderd; komt in het eindrapport.');
    return;
  }

  const todo = volgorde.filter((i) => !KLAAR.has(i));
  const pos = todo.indexOf(id);
  if (pos < 0) { console.log('   ❓ niet op de NAS en niet in de wachtrij — onverwacht, melden.'); return; }
  const tempo = tempoPerUur();
  const eta = tempo ? `over ~${((pos + 1) / tempo / 24).toFixed(1)} dagen (~${Math.round(tempo)} video/uur gemeten)` : 'ETA onbekend (te weinig tempo-data)';
  console.log(`   ⏳ NOG NIET AAN DE BEURT — plek ${pos + 1} van ${todo.length} in de wachtrij`);
  console.log(`      ${eta}`);
  console.log(`      Dit is GEEN fout: de run gaat member-eerst + bronvolgorde, niet per categorie.`);
}

// ── uitvoeren ──
console.log(`manifest: ${manifestBron}${manifest ? ` — ${KLAAR.size} video's op de NAS van ${bronIds.length}` : ''}`);
if (!memberIds.size) console.log('let op: geen member-visible cache — wachtrijposities zijn benaderingen in bronvolgorde');

if (SECTIE) {
  const pre = `${String(SECTIE).padStart(2, '0')} - `;
  const inSectie = structRows.filter((r) => String(r.dest).startsWith(pre));
  if (!inSectie.length) { console.log(`geen sectie gevonden die begint met "${pre}"`); process.exit(0); }
  const naam = inSectie[0].dest.split('/')[0];
  const op = inSectie.filter((r) => KLAAR.has(String(r.id)));
  console.log(`\nSectie: ${naam}`);
  console.log(`  ${op.length} van ${inSectie.length} video's op de NAS\n`);
  for (const r of inSectie.filter((r) => !KLAAR.has(String(r.id)))) {
    console.log(`  ⏳ ${r.id}  ${r.dest.split('/').slice(1).join('/')}`);
  }
  process.exit(0);
}

for (const term of vrij) {
  const ids = resolveer(term);
  if (!ids.length) { console.log(`\ngeen video gevonden voor "${term}"`); continue; }
  if (ids.length > 8) { console.log(`\n"${term}" geeft ${ids.length} treffers — maak het specifieker`); continue; }
  console.log('');
  for (const id of ids) rapport(id);
}
