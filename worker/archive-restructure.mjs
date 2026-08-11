/**
 * archive-restructure.mjs — herindeling van al-aanwezige NAS-archiefbestanden
 * naar de doorbladerbare structuur (teambesluit 2026-08-11, punt 5).
 *
 * Leest het NAS-manifest, zoekt elke video-regel in het OUDE technische schema
 * (video/<id>/<origineel>.mp4) op in structuur.jsonl, en laat de NAS zelf
 * verplaatsen (mv is instant op hetzelfde volume) + de sha256 OPNIEUW berekenen
 * op de nieuwe plek (teambesluit: checksums na verplaatsing herverifiëren).
 * Daarna wordt het manifest herschreven naar het nieuwe formaat
 * (dest + orig + also_in), met backup van het oude manifest op de NAS.
 *
 * Veiligheid:
 *  - weigert te draaien als de NAS-fetch-loop actief is (_lock aanwezig);
 *  - bij sha-mismatch blijft het bestand gewoon staan (niets wordt verwijderd)
 *    en wordt het manifest NIET herschreven — fail-closed;
 *  - idempotent: al-verplaatste bestanden worden alleen opnieuw geverifieerd.
 *
 * Draaien (vanuit worker/):  node archive-restructure.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const BASE = '/volume1/Albunyaan/archief-originelen';

const ssh = (cmd) => spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// -O: Synology's sftp-chroot ziet andere paden dan ssh — vaste les 2026-08-10
const scp = (local, remote) => spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:${remote}`], { encoding: 'utf8' });
const die = (msg) => { console.error(`STOP: ${msg}`); process.exit(1); };

// ── structuur + manifest inlezen ──
const structPath = path.join(OUTDIR, 'structuur.jsonl');
if (!fs.existsSync(structPath)) die('structuur.jsonl ontbreekt — draai eerst node archive-structure.mjs');
const STRUCT = new Map();
for (const l of fs.readFileSync(structPath, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l); STRUCT.set(String(r.id), r);
}

const lockCheck = ssh(`ls -d ${BASE}/_lock 2>/dev/null; true`);
if (lockCheck.status !== 0) die(`NAS onbereikbaar: ${(lockCheck.stderr || '').trim()}`);
if (lockCheck.stdout.trim()) die('archive-fetch.sh draait (_lock aanwezig) — eerst laten stoppen, dan herindelen.');

const manifestRaw = ssh(`cat ${BASE}/manifest.jsonl`);
if (manifestRaw.status !== 0) die(`kon manifest niet lezen: ${(manifestRaw.stderr || '').trim()}`);
const manifestLines = manifestRaw.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ── verplaatsingsplan: alleen video-regels in het oude schema (geen dest) ──
const moves = [];
const newManifest = [];
for (const m of manifestLines) {
  if (m.kind !== 'video' || m.dest) { newManifest.push(m); continue; }
  const st = STRUCT.get(String(m.id));
  if (!st) die(`id ${m.id} staat in het manifest maar niet in structuur.jsonl — structuur eerst compleet maken.`);
  const ext = (m.filename.match(/\.[A-Za-z0-9]{2,5}$/) || ['.mp4'])[0];
  const dest = `${st.dest}${ext}`;
  moves.push({ id: String(m.id), fname: m.filename, dest, sha: m.sha256 });
  newManifest.push({
    kind: 'video', id: String(m.id), dest, orig: m.filename, bytes: m.bytes, sha256: m.sha256,
    also_in: (st.ook_in ?? []).join(' | '), done_at: m.done_at, verplaatst_at: new Date().toISOString(),
  });
}
if (!moves.length) { console.log('Niets te herindelen — alle manifest-regels hebben al een dest.'); process.exit(0); }
console.log(`${moves.length} bestanden herindelen (van video/<id>/ naar de doorbladerbare structuur)…`);

// ── plan + uitvoerder naar de NAS ──
// TSV: tabs kunnen niet in de namen voorkomen (structuurnamen zijn gesaneerd,
// originele Uscreen-namen zijn al tab-vrij in het manifest)
const tsv = moves.map((m) => [m.id, m.fname, m.dest, m.sha].join('\t')).join('\n') + '\n';
const tsvLocal = path.join(OUTDIR, 'herindeling.tsv');
fs.writeFileSync(tsvLocal, tsv);
const driver = `#!/bin/sh
# eenmalige herindelings-uitvoerder — gegenereerd door archive-restructure.mjs
BASE="${BASE}"
TAB=$(printf '\\t')
ok=0; fail=0
while IFS="$TAB" read -r id fname dest sha; do
  [ -z "$id" ] && continue
  old="$BASE/video/$id/$fname"; new="$BASE/$dest"
  if [ ! -f "$old" ] && [ ! -f "$new" ]; then echo "FOUT $id ONTBREEKT: $old"; fail=$((fail+1)); continue; fi
  mkdir -p "$(dirname "$new")"
  if [ -f "$old" ]; then mv "$old" "$new" || { echo "FOUT $id MV-MISLUKT"; fail=$((fail+1)); continue; }; fi
  calc=$(sha256sum "$new" | cut -d' ' -f1)
  if [ "$calc" = "$sha" ]; then
    echo "OK $id $dest"
    ok=$((ok+1))
    rmdir "$BASE/video/$id" 2>/dev/null
  else
    echo "FOUT $id SHA-MISMATCH kreeg=$calc verwacht=$sha (bestand blijft staan: $new)"
    fail=$((fail+1))
  fi
done < "$BASE/herindeling.tsv"
echo "KLAAR ok=$ok fail=$fail"
`;
const driverLocal = path.join(OUTDIR, 'herindeling.sh');
fs.writeFileSync(driverLocal, driver);
for (const [local, remote] of [[tsvLocal, `${BASE}/herindeling.tsv`], [driverLocal, `${BASE}/herindeling.sh`]]) {
  const r = scp(local, remote);
  if (r.status !== 0) die(`scp ${path.basename(local)} mislukt: ${(r.stderr || '').trim()}`);
}

// ── uitvoeren + herverifiëren (sha over ~9 GB duurt ± 1-2 min) ──
const run = spawnSync('ssh', ['-p', NAS_PORT, '-o', 'ConnectTimeout=15', NAS, `sh ${BASE}/herindeling.sh`], { encoding: 'utf8', timeout: 30 * 60_000 });
process.stdout.write(run.stdout || '');
if (run.status !== 0) die(`herindeling.sh faalde: ${(run.stderr || '').trim()}`);
const summary = (run.stdout.match(/^KLAAR ok=(\d+) fail=(\d+)$/m) || []);
if (!summary.length) die('geen KLAAR-regel in de uitvoer — niet te beoordelen, manifest blijft onaangeroerd.');
const [okN, failN] = [parseInt(summary[1], 10), parseInt(summary[2], 10)];
if (failN > 0 || okN !== moves.length) die(`${failN} fouten / ${okN} van ${moves.length} ok — manifest NIET herschreven; fouten hierboven eerst oplossen.`);

// ── manifest herschrijven (backup eerst, fetch-loop draait niet) ──
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const bk = ssh(`cp ${BASE}/manifest.jsonl ${BASE}/manifest.jsonl.voor-structuur-${stamp} && rm ${BASE}/herindeling.tsv ${BASE}/herindeling.sh`);
if (bk.status !== 0) die(`manifest-backup mislukt: ${(bk.stderr || '').trim()}`);
const mfLocal = path.join(OUTDIR, 'manifest-nieuw.jsonl');
fs.writeFileSync(mfLocal, newManifest.map((m) => JSON.stringify(m)).join('\n') + '\n');
const up = scp(mfLocal, `${BASE}/manifest.jsonl`);
if (up.status !== 0) die(`manifest-upload mislukt (backup staat klaar als manifest.jsonl.voor-structuur-${stamp}): ${(up.stderr || '').trim()}`);
fs.unlinkSync(mfLocal);
console.log(`\nKLAAR: ${okN} bestanden op hun doorbladerbare plek, checksums herverifieerd, manifest herschreven (backup: manifest.jsonl.voor-structuur-${stamp}).`);
