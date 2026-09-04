/**
 * archive-plat.mjs — one-off ombouw naar de DEFINITIEVE platte structuur
 * (teambesluit v3, 2026-08-11; adversarieel getoetst draaiboek).
 *
 * Doet in één vergrendelde remote fase (zelfde mkdir-_lock als de fetch-loop):
 *   1. aflevering-thumbnails verwijderen: dest ∪ links-paden (228 stuks) +
 *      kale rmdir van de thumbnails/-mappen (géén rm -rf: een falende rmdir
 *      is de fail-closed-detectie; alleen een puur @eaDir-restant wordt
 *      gesanctioneerd opgeruimd);
 *   2. losse-video-thumbs hernoemen naar "<nn> - <titel> - cover.<ext>"
 *      (kind thumb → cover in het manifest);
 *   3. bijlagen-submappen afvlakken: "…/bijlagen/x" → "…/x" en
 *      "… - bijlagen/x" → "… - x" — mv is rename(2) op hetzelfde btrfs-volume,
 *      hardlink-paren blijven intact; mv-guards: old+new beide aanwezig =
 *      HARD STOP, old weg + new aanwezig = OK (idempotente herstart is hét
 *      herstelpad);
 *   4. done-markers per GLOB vervangen (thumb-<id>-*, bijlage-<id>-* — ruimt
 *      ook de bekende stale bijlage-marker op) en nieuwe markers zetten
 *      (hashes Mac-zijdig berekend);
 *   5. _queue/verwerkt/ → verwerkt-oud-schema/ (oude wachtrijregels met
 *      thumbnails/-dests mogen nooit meer door de loop), en het
 *      _staging-bijlagen-restje opruimen.
 * Daarna Mac-zijdig het manifest herschrijven (backup met datum+tijd-stempel,
 * atomaire mv, asserts: unieke (kind,id), bestandsnaam ≤255 bytes) en de
 * eindcontrole markers == manifestregels.
 *
 * De plan-bestanden (plat-*.txt/tsv) BLIJVEN op de NAS staan als
 * omkeer-artefact — samen met de manifest-backup het rollback-pad voor alles
 * behalve de verwijderde thumbnails (die zijn definitief; daarom draait de
 * volledige sha-herverificatie VÓÓR dit script — zie plan).
 *
 * Vereisten vooraf: fetch-loop gestopt (dit script weigert bij lock of
 * levend proces), pre-sha-verificatie gedaan, code (extras/links) al plat.
 *
 * Draaien (vanuit worker/):  node archive-plat.mjs [--dry]
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

// ── veiligheid: geen levende fetch-loop, geen lock ──
const scan = ssh(`self=$$; n=0; for p in /proc/[0-9]*/cmdline; do pid=\${p#/proc/}; pid=\${pid%/cmdline}; [ "$pid" = "$self" ] && continue; c=$(tr "\\0" " " < "$p" 2>/dev/null); case "$c" in *archive-fetch.sh*) n=$((n+1));; esac; done; echo "n=$n"; ls -d ${BASE}/_lock 2>/dev/null || echo geen-lock; ls -d ${BASE}/_lock-extras 2>/dev/null || echo geen-lock-extras`);
if (scan.status !== 0) die(`NAS onbereikbaar: ${(scan.stderr || '').trim()}`);
if (!/n=0/.test(scan.stdout)) die('fetch-loop draait nog — eerst killen (per /proc-scan) en opnieuw.');
if (!/^geen-lock$/m.test(scan.stdout)) die('_lock aanwezig zonder proces — verweesde lock eerst beoordelen/opruimen.');
// _lock-extras (sinds 2026-09-03): de tekst-/bijlagen-ingest van archive-extras.mjs (wachter, stap 5)
// appendt en herschrijft manifest.jsonl onder zijn eigen lock — nooit tegelijk met een manifest-vervanging hier.
if (!/geen-lock-extras/.test(scan.stdout)) die('_lock-extras aanwezig — archive-extras-ingest (wachter) bezig; wachten tot die klaar is.');

// ── manifest inlezen ──
const mfRaw = ssh(`cat ${BASE}/manifest.jsonl`);
if (mfRaw.status !== 0) die('kon manifest niet lezen');
const manifest = mfRaw.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));

const dels = [];        // te verwijderen paden (dest ∪ links van aflevering-thumbs)
const rmdirs = new Set(); // thumbnails/-mappen
const moves = [];       // {old, new}
const markerRm = new Set();  // globs
const markerAdd = [];   // exacte namen
const newManifest = [];
const flat = (p) => p.replace(/\/bijlagen\//, '/').replace(/ - bijlagen\//, ' - ');

for (const m of manifest) {
  if (m.kind === 'thumb' && m.dest.includes('/thumbnails/')) {
    dels.push(m.dest);
    for (const l of (m.links ?? '').split('|').filter(Boolean)) dels.push(l);
    rmdirs.add(path.dirname(m.dest));
    for (const l of (m.links ?? '').split('|').filter(Boolean)) rmdirs.add(path.dirname(l));
    markerRm.add(`thumb-${m.id}-*`);
    continue; // regel vervalt
  }
  if (m.kind === 'thumb') {
    // losse-video-thumb → cover-sidecar
    const ext = path.extname(m.dest);
    const nieuw = `${m.dest.slice(0, m.dest.length - ext.length)} - cover${ext}`;
    if ((m.links ?? '') !== '') die(`losse thumb ${m.id} heeft onverwacht links — handmatig beoordelen`);
    moves.push({ old: m.dest, new: nieuw });
    markerRm.add(`thumb-${m.id}-*`);
    markerAdd.push(`cover-${m.id}-${destHash(nieuw)}`);
    newManifest.push({ ...m, kind: 'cover', dest: nieuw });
    continue;
  }
  if (m.kind === 'bijlage' && /( - )?bijlagen\//.test(m.dest)) {
    // bekend manco uit de v1→v2-overgang: de 222454-regel is de oude
    // mini-run-v1-regel zonder links-veld (de done-marker bestond al, dus de
    // nieuwe extras-regel met links werd nooit geschreven) — het
    // WhoAreWe-hardlinkpad bestáát op schijf. Expliciet aanvullen zodat de
    // mv-lijst en het manifest kloppen (orig meteen naar de originele naam).
    let links = (m.links ?? '').split('|').filter(Boolean);
    if (m.id === '222454' && !links.length) {
      links = ['02 - Welcome to Albunyaan 👋/03 - Albunyaan _ Who are we_ (AR_ENG_NL)/bijlagen/albunyaan-about-us.pdf'];
      m.orig = '222454__albunyaan-about-us.pdf';
    }
    const nieuw = flat(m.dest);
    const nieuweLinks = links.map(flat);
    moves.push({ old: m.dest, new: nieuw });
    for (const [i, l] of links.entries()) moves.push({ old: l, new: nieuweLinks[i] });
    // de oude bijlagen-submappen zelf ook opruimen
    if (m.dest.includes('bijlagen/')) rmdirs.add(path.dirname(m.dest));
    for (const l of links) if (l.includes('bijlagen/')) rmdirs.add(path.dirname(l));
    markerRm.add(`bijlage-${m.id}-*`);
    markerAdd.push(`bijlage-${m.id}-${destHash(nieuw)}`);
    newManifest.push({ ...m, dest: nieuw, links: nieuweLinks.join('|') });
    continue;
  }
  newManifest.push(m);
}

// ── asserts vóór alles ──
const keys = new Set();
for (const m of newManifest) {
  const k = `${m.kind} ${m.id}`;
  if (keys.has(k)) die(`(kind,id) niet uniek na transformatie: ${k}`);
  keys.add(k);
  for (const p of [m.dest, ...(m.links ?? '').split('|').filter(Boolean)]) {
    if (p && Buffer.byteLength(path.basename(p), 'utf8') > 255) die(`bestandsnaam >255 bytes: ${p}`);
  }
}
console.log(`ombouw: ${dels.length} thumb-paden weg · ${rmdirs.size} mappen rmdir · ${moves.length} mv's · markers: ${markerRm.size} globs weg, ${markerAdd.length} nieuw · manifest ${manifest.length} → ${newManifest.length} regels`);
if (DRY) {
  for (const mv of moves) console.log(`  mv "${mv.old}" → "${mv.new}"`);
  process.exit(0);
}

// ── plan-bestanden naar de NAS (blijven staan als omkeer-artefact) ──
fs.writeFileSync(path.join(OUTDIR, 'plat-del.txt'), dels.join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'plat-rmdir.txt'), [...rmdirs].sort().reverse().join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'plat-mv.tsv'), moves.map((m) => `${m.old}${US}${m.new}`).join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'plat-marker-rm.txt'), [...markerRm].join('\n') + '\n');
fs.writeFileSync(path.join(OUTDIR, 'plat-marker-add.txt'), markerAdd.join('\n') + '\n');
for (const f of ['plat-del.txt', 'plat-rmdir.txt', 'plat-mv.tsv', 'plat-marker-rm.txt', 'plat-marker-add.txt']) {
  scpTo(path.join(OUTDIR, f), `${BASE}/${f}`);
}

// ── remote ombouw onder de lock ──
const run = ssh(`set -e
cd ${BASE}
if [ -d _lock-extras ]; then echo "LOCK-EXTRAS BEZET (archive-extras-ingest bezig)" >&2; exit 3; fi
if ! mkdir _lock 2>/dev/null; then echo "LOCK BEZET" >&2; exit 3; fi
trap 'rmdir _lock 2>/dev/null' EXIT INT TERM
US=$(printf '\\037')
fail=0
# 1. thumbnails verwijderen (ssh-rm passeert #recycle niet — definitief)
while IFS= read -r p; do
  [ -z "$p" ] && continue
  if [ -f "$p" ]; then rm -f "$p" || { echo "FOUT RM: $p"; fail=$((fail+1)); }
  else echo "NOTITIE: ontbrak al: $p"; fi
done < plat-del.txt
# 2. hernoemingen/afvlakkingen met guards
while IFS="$US" read -r old new; do
  [ -z "$old" ] && continue
  if [ -e "$old" ] && [ -e "$new" ]; then echo "FOUT MV old+new bestaan beide: $old"; fail=$((fail+1)); continue; fi
  if [ ! -e "$old" ] && [ -e "$new" ]; then continue; fi   # al gedaan (herstart)
  if [ ! -e "$old" ]; then echo "FOUT MV bron ontbreekt: $old"; fail=$((fail+1)); continue; fi
  mkdir -p "$(dirname "$new")" && mv "$old" "$new" || { echo "FOUT MV: $old"; fail=$((fail+1)); }
done < plat-mv.tsv
# 3. lege mappen weg; alleen een puur @eaDir-restant is gesanctioneerd
while IFS= read -r d; do
  [ -z "$d" ] || [ ! -d "$d" ] && continue
  if ! rmdir "$d" 2>/dev/null; then
    rest=$(ls -A "$d")
    if [ "$rest" = "@eaDir" ]; then rm -rf "$d/@eaDir" && rmdir "$d" || { echo "FOUT RMDIR: $d"; fail=$((fail+1)); }
    else echo "FOUT RMDIR niet leeg: $d bevat: $rest"; fail=$((fail+1)); fi
  fi
done < plat-rmdir.txt
# 4. markers: globs weg, nieuwe erbij
while IFS= read -r g; do [ -z "$g" ] && continue; rm -f done/$g; done < plat-marker-rm.txt
while IFS= read -r m; do [ -z "$m" ] && continue; touch "done/$m"; done < plat-marker-add.txt
# 5. oud-schema-wachtrijen wegzetten + staging-restje
[ -d _queue/verwerkt ] && mv _queue/verwerkt _queue/verwerkt-oud-schema 2>/dev/null || true
rm -f "_staging-bijlagen/222454__albunyaan-about-us.pdf" 2>/dev/null || true
rmdir _staging-bijlagen 2>/dev/null || true
echo "PLAT-KLAAR fail=$fail"`);
process.stdout.write(run.stdout || '');
if (run.status !== 0) die(`remote ombouw faalde: ${(run.stderr || '').slice(0, 300)}`);
const sum = run.stdout.match(/^PLAT-KLAAR fail=(\d+)$/m);
if (!sum) die('geen PLAT-KLAAR-regel — niet te beoordelen; manifest onaangeroerd.');
if (parseInt(sum[1], 10) > 0) die(`${sum[1]} fouten in de remote ombouw — manifest NIET herschreven; idempotente herstart na beoordeling is het herstelpad.`);

// ── manifest herschrijven (backup met datum+tijd, atomaire mv, onder lock) ──
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
const mfLocal = path.join(OUTDIR, 'manifest-nieuw.jsonl');
fs.writeFileSync(mfLocal, newManifest.map((m) => JSON.stringify(m)).join('\n') + '\n');
scpTo(mfLocal, `${BASE}/manifest.jsonl.new`);
const fin = ssh(`set -e
cd ${BASE}
if [ -d _lock-extras ]; then echo "LOCK-EXTRAS BEZET (archive-extras-ingest bezig) — manifest.jsonl.new staat klaar" >&2; exit 3; fi
if ! mkdir _lock 2>/dev/null; then echo "LOCK BEZET — manifest.jsonl.new staat klaar" >&2; exit 3; fi
trap 'rmdir _lock 2>/dev/null' EXIT INT TERM
cp manifest.jsonl "manifest.jsonl.voor-plat-${stamp}"
mv manifest.jsonl.new manifest.jsonl
mc=$(wc -l < manifest.jsonl)
dc=$(ls done | wc -l)
echo "MANIFEST-OK regels=$mc markers=$dc"`);
process.stdout.write(fin.stdout || '');
if (fin.status !== 0 || !fin.stdout.includes('MANIFEST-OK')) die('manifest-vervanging mislukt');
const mm = fin.stdout.match(/regels=(\d+) markers=(\d+)/);
if (mm && mm[1] !== mm[2]) console.error(`⚠ markers (${mm[2]}) ≠ manifestregels (${mm[1]}) — uitzoeken vóór de herkeuring!`);
fs.unlinkSync(mfLocal);
console.log(`\nKLAAR: platte structuur doorgevoerd; manifest herschreven (backup: manifest.jsonl.voor-plat-${stamp}); plan-bestanden blijven op de NAS als omkeer-artefact.`);
