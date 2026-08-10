/**
 * archive-images.mjs — beeldwachtrij voor het NAS-originelenarchief
 * (teambesluit 2026-08-10; zelfde wachtrijvorm als archive-request-links.mjs,
 * afgewerkt door archive-fetch.sh op de NAS).
 *
 * De ORIGINELE afbeelding op de Uscreen-CDN is de KALE bestandsnaam (1480×832);
 * `small_` (320×182) en `big_` (740×420) zijn verkleinde afgeleiden — bewezen
 * 2026-08-09/10. De urls staan al lokaal in de oogst:
 *   ~/.albunyaan-cc/uscreen-videos-rich.jsonl        (veld thumb, small_-url)
 *   ~/.albunyaan-cc/uscreen-collection-covers.jsonl  (veld cover, big_-url)
 * -> prefix strippen = origineel. GEEN admin-sessie nodig; de NAS fetcht direct.
 *
 * Naast horizontal worden ook de vertical- en square-varianten geprobeerd
 * (best-effort): hun bestandsnamen verschillen per video en zijn hier niet
 * bekend, dus die komen alleen mee als de kale `thumbnail.jpg`-conventie geldt.
 * 403's zijn bij de bron GEEN uitzondering (drafts gaven AccessDenied) — de NAS
 * legt elke mislukking eerlijk vast in fouten.log; daarna volgt een aparte
 * fallback-analyse. expected_bytes is hier null (bytes vooraf onbekend; de
 * sha256 bij binnenkomst op de NAS is de archief-vingerafdruk).
 *
 * Draaien:  node archive-images.mjs [--limit N]
 * Uitvoer:  ~/.albunyaan-cc/archief/queue-beeld-<ts>.jsonl  → scp naar NAS _queue/
 */
// spawnSync is hier OK: dit script is bewust single-threaded/sequentieel (geen
// parallelle workers om te blokkeren — de spawnSync-regel uit commit 9623f97
// gaat over event-loop-blokkade in parallel transfercode). Zelfde patroon als
// de checker-aanroep in import-video-extras.ts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUTDIR = path.join(CC, 'archief');
const NAS = 'mostafa@nas.fitrahmedia.nl';
const NAS_PORT = '8022';
const NAS_QUEUE = '/volume1/Albunyaan/archief-originelen/_queue';

const args = process.argv.slice(2);
const i = args.indexOf('--limit');
const LIMIT = i >= 0 ? parseInt(args[i + 1], 10) : Infinity;

const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];

/** small_/big_-prefix van de bestandsnaam strippen -> URL van het origineel. */
function stripPrefix(url) {
  return url.replace(/\/(small|big)_([^/]+)$/, '/$2');
}

const rows = [];
let nVid = 0, nColl = 0;

// video-thumbnails (horizontal is de gegarandeerde; vertical/square best-effort
// via de kale-naam-conventie — alleen als de horizontal een uuid-naam heeft
// weten we de andere namen NIET, dus die slaan we daar eerlijk over)
for (const r of readJsonl(path.join(CC, 'uscreen-videos-rich.jsonl'))) {
  if (!r.thumb || !r.thumb.includes('uscreencdn')) continue;
  const orig = stripPrefix(r.thumb);
  const base = path.basename(new URL(orig).pathname);
  rows.push({ kind: 'beeld-video', id: String(r.id), url: orig, filename: `horizontal-${base}`, expected_bytes: null });
  nVid++;
  // vertical/square: alléén de generieke thumbnail.jpg-conventie proberen
  // (uuid-namen van andere oriëntaties zijn onbekend zonder admin-call)
  if (base === 'thumbnail.jpg') {
    for (const orient of ['vertical', 'square']) {
      rows.push({
        kind: 'beeld-video', id: String(r.id),
        url: orig.replace('/horizontal/', `/${orient}/`),
        filename: `${orient}-${base}`, expected_bytes: null,
      });
    }
  }
}

// serie-covers
for (const r of readJsonl(path.join(CC, 'uscreen-collection-covers.jsonl'))) {
  if (!r.cover || !r.cover.includes('uscreencdn')) continue;
  const orig = stripPrefix(r.cover);
  const base = path.basename(new URL(orig).pathname);
  rows.push({ kind: 'beeld-serie', id: String(r.id), url: orig, filename: `horizontal-${base}`, expected_bytes: null });
  nColl++;
}

const out = rows.slice(0, LIMIT);
fs.mkdirSync(OUTDIR, { recursive: true });
const name = `queue-beeld-${Date.now()}.jsonl`;
const local = path.join(OUTDIR, name);
fs.writeFileSync(local, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`${out.length} beeld-items in wachtrij (${nVid} video-thumbs, ${nColl} serie-covers, rest = vertical/square best-effort)`);

// -O = legacy scp-protocol (Synology-SFTP-chroot geeft anders "No such file
// or directory" op paden die via ssh wél bestaan — 2026-08-10)
const scp = spawnSync('scp', ['-O', '-P', NAS_PORT, '-o', 'ConnectTimeout=20', local, `${NAS}:${NAS_QUEUE}/${name}`], { encoding: 'utf8' });
if (scp.status === 0) console.log(`wachtrij ${name} → NAS`);
else console.error(`SCP MISLUKT: ${(scp.stderr || '').trim().slice(0, 150)}\nBestand staat lokaal: ${local}`);
