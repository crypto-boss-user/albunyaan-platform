/**
 * archive-losmap.mjs — one-off ombouw voor correctie 1b (definitief,
 * teambesluit 2026-08-12): een losse video MÉT extra's krijgt een eigen map
 * ("<nn> - <titel>/") met daarin alles naakt: "<titel>.mp4", cover.jpg,
 * beschrijving.txt, zoekwoorden.txt en de bijlagen. Kale losse video's
 * (zonder extra's) blijven een kaal bestand.
 *
 * Werkt vanuit het NAS-manifest + de HERGENEREERDE structuur (losmap-vorm,
 * diff-gecontroleerd: alleen losse-met-extra's-rijen veranderd):
 *   - video-regels waarvan structuur-dest ≠ manifest-dest → mv naar de map
 *     (elke afwijking die níet de losmap-vorm is = HARD STOP);
 *   - bijbehorende cover/tekst-regels (video-id) → "<map>/cover.jpg" etc.;
 *   - bijlage-regels met een "<oude basis> - "-dest of -link → "<map>/<naam>";
 *   - markers: video's zijn bestandsnaam-gebaseerd (blijven); cover/tekst/
 *     bijlage zijn dest-hash-gebaseerd → per glob vervangen;
 *   - manifest-herschrijving met dezelfde asserts en backup als archive-plat.
 * mv is rename(2) op hetzelfde btrfs-volume: hardlinks blijven intact.
 * Guards en idempotente herstart identiek aan archive-plat.mjs.
 *
 * Draaien (vanuit worker/):  node archive-losmap.mjs [--dry]
 */
// spawnSync is hier OK: bewust sequentieel herstelscript.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';
const DRY = process.argv.includes('--dry');
const US = '\u001f';

const ssh = (cmd) => spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60 * 60_000 });
const scpTo = (local, remote) => {
  const r = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:'${remote}'`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`scp ${path.basename(local)} mislukt: ${r.stderr}`); process.exit(1); }
};
const die = (msg) => { console.error(`STOP: ${msg}`); process.exit(1); };
const destHash = (d) => createHash('sha256').update(d, 'utf8').digest('hex').slice(0, 16);
const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

const struct = readJsonl(path.join(OUTDIR, 'structuur.jsonl'));
const series = readJsonl(path.join(OUTDIR, 'structuur-series.jsonl'));
if (!struct.length || !series.length) die('structuur(.series).jsonl ontbreekt');
const structById = new Map(struct.map((r) => [String(r.id), r]));
const serieDirSet = new Set(series.flatMap((s) => s.dirs));
const looseDirs = (st) => [st.dest, ...(st.ook_in ?? [])]
  .filter((l) => !serieDirSet.has(path.dirname(l)) && l.split('/').length >= 3)
  .map((l) => path.dirname(l));

// ── veiligheid ──
const scan = ssh(`self=$$; n=0; for p in /proc/[0-9]*/cmdline; do pid=\${p#/proc/}; pid=\${pid%/cmdline}; [ "$pid" = "$self" ] && continue; c=$(tr "\\0" " " < "$p" 2>/dev/null); case "$c" in *archive-fetch.sh*) n=$((n+1));; esac; done; echo "n=$n"; ls -d ${BASE}/_lock 2>/dev/null || echo geen-lock`);
if (scan.status !== 0) die('NAS onbereikbaar');
if (!/n=0/.test(scan.stdout)) die('fetch-loop draait nog — eerst killen.');
if (!/geen-lock/.test(scan.stdout)) die('_lock aanwezig zonder proces — eerst beoordelen.');

const mfRaw = ssh(`cat ${BASE}/manifest.jsonl`);
if (mfRaw.status !== 0) die('kon manifest niet lezen');
const manifest = mfRaw.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ── transformaties bepalen ──
const moves = [];
const markerRm = new Set();
const markerAdd = [];
const newManifest = [];
// oude losse basis ("…/NN - Titel") → nieuwe map ("…/NN - Titel")
const baseMap = new Map(); // oldBase → {folder, inner}
for (const m of manifest) {
  if (m.kind !== 'video') continue;
  const st = structById.get(String(m.id));
  if (!st) die(`video ${m.id} niet in structuur`);
  const ext = path.extname(m.dest);
  const nieuw = `${st.dest}${ext}`;
  if (nieuw === m.dest) continue;
  const oldBase = m.dest.slice(0, m.dest.length - ext.length);
  const folder = path.dirname(nieuw);
  if (folder !== oldBase) die(`video ${m.id}: afwijking is geen losmap-vorm: "${m.dest}" → "${nieuw}"`);
  baseMap.set(oldBase, { folder, id: String(m.id) });
}
const herschrijfLinks = (links) => (links ?? '').split('|').filter(Boolean).map((l) => {
  for (const [oldBase, { folder }] of baseMap) {
    if (l.startsWith(`${oldBase} - `)) return `${folder}/${l.slice(oldBase.length + 3)}`;
    if (l.startsWith(`${oldBase}.`)) return `${folder}/${path.basename(folder).replace(/^\d+ - /, '')}${path.extname(l)}`;
  }
  return l;
}).join('|');
for (const m of manifest) {
  const entry = { ...m };
  const ext = path.extname(m.dest ?? '');
  if (m.kind === 'video') {
    const st = structById.get(String(m.id));
    const nieuw = `${st.dest}${ext}`;
    if (nieuw !== m.dest) {
      moves.push({ old: m.dest, new: nieuw });
      entry.dest = nieuw; // marker is bestandsnaam-gebaseerd: blijft geldig
    }
    entry.links = herschrijfLinks(m.links);
    newManifest.push(entry);
    continue;
  }
  if (['cover', 'beschrijving', 'zoekwoorden', 'bijlage'].includes(m.kind) && m.dest) {
    let nieuw = null;
    for (const [oldBase, { folder }] of baseMap) {
      if (m.dest === `${oldBase} - cover${ext}`) nieuw = `${folder}/cover${ext}`;
      else if (m.dest === `${oldBase} - beschrijving.txt`) nieuw = `${folder}/beschrijving.txt`;
      else if (m.dest === `${oldBase} - zoekwoorden.txt`) nieuw = `${folder}/zoekwoorden.txt`;
      else if (m.dest.startsWith(`${oldBase} - `)) nieuw = `${folder}/${m.dest.slice(oldBase.length + 3)}`;
      if (nieuw) break;
    }
    if (nieuw) {
      moves.push({ old: m.dest, new: nieuw });
      markerRm.add(`${m.kind}-${m.id}-${destHash(m.dest)}`);
      markerAdd.push(`${m.kind}-${m.id}-${destHash(nieuw)}`);
      entry.dest = nieuw;
    }
    entry.links = herschrijfLinks(m.links);
    newManifest.push(entry);
    continue;
  }
  newManifest.push(entry);
}
// asserts (zelfde als archive-plat)
const keys = new Set();
for (const m of newManifest) {
  const k = `${m.kind} ${m.id}`;
  if (keys.has(k)) die(`(kind,id) niet uniek: ${k}`);
  keys.add(k);
  for (const p of [m.dest, ...(m.links ?? '').split('|').filter(Boolean)]) {
    if (p && Buffer.byteLength(path.basename(p), 'utf8') > 255) die(`naam >255 bytes: ${p}`);
  }
}
console.log(`losmap-ombouw: ${baseMap.size} losse video's → eigen map · ${moves.length} mv's · markers: ${markerRm.size} weg, ${markerAdd.length} nieuw`);
if (DRY) { for (const mv of moves) console.log(`  mv "${mv.old}" → "${mv.new}"`); process.exit(0); }
if (!moves.length) { console.log('Niets te doen.'); process.exit(0); }

// ── remote uitvoering ──
fs.writeFileSync(path.join(OUTDIR, 'losmap-mv.tsv'), moves.map((m) => `${m.old}${US}${m.new}`).join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'losmap-marker-rm.txt'), [...markerRm].join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'losmap-marker-add.txt'), markerAdd.join('\n') + '\n');
for (const f of ['losmap-mv.tsv', 'losmap-marker-rm.txt', 'losmap-marker-add.txt']) scpTo(path.join(OUTDIR, f), `${BASE}/${f}`);
const run = ssh(`set -e
cd ${BASE}
if ! mkdir _lock 2>/dev/null; then echo "LOCK BEZET" >&2; exit 3; fi
trap 'rmdir _lock 2>/dev/null' EXIT INT TERM
US=$(printf '\\037')
fail=0
while IFS="$US" read -r old new; do
  [ -z "$old" ] && continue
  if [ -e "$old" ] && [ -e "$new" ]; then echo "FOUT MV old+new bestaan beide: $old"; fail=$((fail+1)); continue; fi
  if [ ! -e "$old" ] && [ -e "$new" ]; then continue; fi
  if [ ! -e "$old" ]; then echo "FOUT MV bron ontbreekt: $old"; fail=$((fail+1)); continue; fi
  mkdir -p "$(dirname "$new")" && mv "$old" "$new" || { echo "FOUT MV: $old"; fail=$((fail+1)); }
done < losmap-mv.tsv
while IFS= read -r g; do [ -z "$g" ] && continue; rm -f "done/$g"; done < losmap-marker-rm.txt
while IFS= read -r m; do [ -z "$m" ] && continue; touch "done/$m"; done < losmap-marker-add.txt
echo "LOSMAP-KLAAR fail=$fail"`);
process.stdout.write(run.stdout || '');
if (run.status !== 0) die('remote ombouw faalde');
const sum = run.stdout.match(/^LOSMAP-KLAAR fail=(\d+)$/m);
if (!sum || parseInt(sum[1], 10) > 0) die('fouten in de remote ombouw — manifest NIET herschreven.');

// ── manifest vervangen ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const mfLocal = path.join(OUTDIR, 'manifest-nieuw.jsonl');
fs.writeFileSync(mfLocal, newManifest.map((m) => JSON.stringify(m)).join('\n') + '\n');
scpTo(mfLocal, `${BASE}/manifest.jsonl.new`);
const fin = ssh(`set -e
cd ${BASE}
if ! mkdir _lock 2>/dev/null; then echo "LOCK BEZET" >&2; exit 3; fi
trap 'rmdir _lock 2>/dev/null' EXIT INT TERM
cp manifest.jsonl "manifest.jsonl.voor-losmap-${stamp}"
mv manifest.jsonl.new manifest.jsonl
echo "MANIFEST-OK regels=$(wc -l < manifest.jsonl) markers=$(ls done | wc -l)"`);
process.stdout.write(fin.stdout || '');
if (fin.status !== 0 || !fin.stdout.includes('MANIFEST-OK')) die('manifest-vervanging mislukt');
fs.unlinkSync(mfLocal);
console.log(`\nKLAAR: losmap-structuur doorgevoerd (backup: manifest.jsonl.voor-losmap-${stamp}).`);
