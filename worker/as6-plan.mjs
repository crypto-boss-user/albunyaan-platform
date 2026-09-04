/**
 * as6-plan.mjs — plangenerator voor AS 6 (volgorde-synchronisatie): welke afleveringbestanden moeten
 * hernummerd worden zodat de archiefvolgorde de Uscreen-volgorde volgt. (2026-09-03, plan §3.1 / §5 B30)
 *
 * ALLEEN LEZEN + één uitvoerbestand: ~/.albunyaan-cc/archief/as6-plan.json. Raakt de NAS niet.
 * Leest dezelfde bronnen als audit-volledig.mjs (audit/collecties.jsonl = Uscreen-oogst,
 * structuur-series.jsonl = archief) en gebruikt dezelfde AS 6-definitie:
 *   - elke video ÉÉN keer, EERSTE voorkomen, aaneengesloten genummerd (Uscreen toont sommige video's
 *     op twee posities; die tweede positie telt niet en wordt gemeld);
 *   - nummerbreedte per serie = max(huidige breedte in de bestandsnamen, cijfers nodig) — val van 02-09:
 *     met 2 cijfers zou "001 - …" (The Arabic Language 1) op 173 i.p.v. 74 hernoemingen uitkomen;
 *   - géén dubbele regels (het plan van 02-09 bevatte 33 hernoem-regels twee keer — droogloop AS 6.1);
 *   - tweefasig = true als een doelnaam gelijk is aan een andere bronnaam in dezelfde serie
 *     (dan moet de uitvoering via tijdelijke namen).
 * Een bestaand as6-plan.json wordt eerst weggezet als as6-plan.json.voor-<label> (label via --label, anders datum).
 *
 *   node as6-plan.mjs [--label b30-2026-09-03]
 * Vereist audit/oogst-klaar.json (C1: complete, foutloze oogst van audit-volledig.mjs zonder --hergebruik);
 * ontbreekt hij of klopt de telling niet → exit 1.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = path.join(os.homedir(), '.albunyaan-cc', 'archief');
const AUD = path.join(OUT, 'audit');
const PLAN = path.join(OUT, 'as6-plan.json');
const li = process.argv.indexOf('--label');
const LABEL = li > -1 ? process.argv[li + 1] : new Date().toISOString().slice(0, 10);

const readJsonl = (p) => fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
// C1: alleen een complete oogst is een geldige bron (marker geschreven door audit-volledig.mjs ná rename)
const MARKER = path.join(AUD, 'oogst-klaar.json');
if (!fs.existsSync(MARKER)) { console.error(`oogst-marker ontbreekt (${MARKER}) — draai eerst audit-volledig.mjs (zonder --hergebruik)`); process.exit(1); }
const oogstInfo = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
console.log(`Uscreen-oogst van ${oogstInfo.klaar_op} (${oogstInfo.collecties} collecties)`);
const cols = readJsonl(path.join(AUD, 'collecties.jsonl'));
if (cols.length !== oogstInfo.collecties || oogstInfo.collecties_fout) { console.error(`collecties.jsonl ≠ marker (${cols.length}/${oogstInfo.collecties}, foutrijen ${oogstInfo.collecties_fout ?? '?'}) — draai eerst audit-volledig.mjs`); process.exit(1); }
const series = readJsonl(path.join(OUT, 'structuur-series.jsonl'));
const serieVan = new Map(series.map((s) => [String(s.collection), s]));

const plan = []; const meld = [];
for (const c of cols) {
  const s = serieVan.get(String(c.id)); if (!s) continue;
  const arch = new Map(s.eps.map((e) => [String(e.id), e.bestand]));
  // Uscreen-volgorde: op positie, dividers eruit, ontdubbeld op video_id (eerste voorkomen)
  const items = [...(c.items ?? [])].filter((i) => i.video_id).sort((a, b) => a.position - b.position);
  const gezien = new Set(); const volg = []; let dubbel = 0;
  for (const i of items) {
    if (gezien.has(i.video_id)) { dubbel++; continue; }
    gezien.add(i.video_id);
    if (arch.has(i.video_id)) volg.push(i.video_id);
  }
  if (volg.length < 2) continue;
  const huidig = volg.map((v) => String(arch.get(v)).match(/^\s*(\d+)\s*-/)).map((m) => (m ? m[1] : null));
  if (huidig.some((x) => x === null)) { meld.push(`${c.id} ${c.title}: aflevering zonder nummer — overgeslagen`); continue; }
  const breedte = Math.max(...huidig.map((x) => x.length), String(volg.length).length);
  const hernoem = [];
  volg.forEach((v, k) => {
    const oud = String(arch.get(v));
    const m = oud.match(/^(\d+)(\s*-\s*)([\s\S]*)$/);
    const nieuw = String(k + 1).padStart(breedte, '0') + m[2] + m[3];
    if (nieuw !== oud) hernoem.push({ vid: v, oud, nieuw });
  });
  if (!hernoem.length) { if (dubbel) meld.push(`${c.id} ${c.title}: staat goed (ontdubbeld: ${dubbel}), niets te doen`); continue; }
  const oudSet = new Set(hernoem.map((h) => h.oud));
  const tweefasig = hernoem.some((h) => oudSet.has(h.nieuw));
  const dubbelDoel = new Set(hernoem.map((h) => h.nieuw)).size !== hernoem.length;
  if (dubbelDoel) { meld.push(`${c.id} ${c.title}: twee bronnen zelfde doel — NIET in het plan`); continue; }
  plan.push({ id: String(c.id), titel: c.title, dirs: s.dirs, afl: volg.length, breedte, tweefasig, ontdubbeld: dubbel, hernoem });
}

if (fs.existsSync(PLAN)) {
  const bak = `${PLAN}.voor-${LABEL}`;
  if (!fs.existsSync(bak)) fs.copyFileSync(PLAN, bak);
  console.log(`oud plan bewaard als ${bak}`);
}
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 1));
let ops = 0, uniek = 0;
console.log('serie                                        afl  breedte  hernoem  mappen  ops  tweefasig  ontdubbeld');
for (const s of plan) {
  const n = s.hernoem.length * s.dirs.length; ops += n; uniek += s.hernoem.length;
  console.log(`${(s.id + ' ' + s.titel).slice(0, 44).padEnd(44)} ${String(s.afl).padStart(4)}  ${s.breedte}        ${String(s.hernoem.length).padStart(4)}     ${s.dirs.length}     ${String(n).padStart(4)}  ${s.tweefasig ? 'JA' : 'nee'}        ${s.ontdubbeld}`);
}
console.log(`TOTAAL: ${plan.length} series · ${uniek} unieke bestanden · ${ops} fysieke acties (unieke bestanden × mappen)`);
for (const m of meld) console.log('melding: ' + m);
console.log(`plan -> ${PLAN}`);
