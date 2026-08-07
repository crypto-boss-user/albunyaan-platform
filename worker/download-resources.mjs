/**
 * Download every Uscreen "Resource" (the 107 APK/PDF/ZIP attachments) to disk,
 * then (optionally) upload them to Supabase Storage so the new site serves
 * them from OUR infrastructure instead of Uscreen's.
 *
 * Download endpoint (verified in the founder's browser, 2026-08-06):
 *   GET /bullet_api/v1/file_resources/{id}/download   (admin session, redirects to the file)
 *
 * Input:  ~/.albunyaan-cc/uscreen-file-resources.jsonl  (from harvest-video-extras.mjs)
 * Files:  ~/.albunyaan-cc/resources/<id>__<safe-title>
 * Upload: Supabase Storage bucket 'resources', path <id>__<safe-title>
 *         (public bucket; the importer writes the public URL into videos.resources)
 *
 * Run (from worker/):
 *   node download-resources.mjs             # download only (resumable)
 *   node download-resources.mjs --upload    # download + upload to Supabase Storage
 * Prereq: twin Chrome on :9333 (admin session); env from ~/.albunyaan-cc/cloud.env
 * for --upload (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const IN = path.join(CC, 'uscreen-file-resources.jsonl');
const DIR = path.join(CC, 'resources');
const UPLOAD = process.argv.includes('--upload');
const BUCKET = 'resources';
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const line of fs.existsSync(path.join(CC, 'cloud.env')) ? fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const safe = (t, ext) => {
  let name = String(t).replace(/[\/\\:*?"<>|]/g, '_').slice(0, 120);
  if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) name += `.${ext}`;
  return name;
};

let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 400 "already exists" is fine; anything else is not.
  if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`bucket create ${res.status}: ${(await res.text()).slice(0, 200)}`);
  bucketEnsured = true;
}

async function uploadToSupabase(localPath, storagePath, contentType) {
  await ensureBucket();
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(storagePath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: fs.readFileSync(localPath),
  });
  if (!res.ok) throw new Error(`storage upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(storagePath)}`;
}

async function main() {
  if (!fs.existsSync(IN)) throw new Error(`missing ${IN} — run harvest-video-extras.mjs first`);
  fs.mkdirSync(DIR, { recursive: true });
  const resources = fs.readFileSync(IN, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.id);
  console.log(`[${ts()}] ${resources.length} resources in catalog`);

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  // ctx.request shares the admin session cookies and follows the redirect to the file.
  let ok = 0, skipped = 0, failed = 0;
  const manifest = [];
  for (const r of resources) {
    const fname = `${r.id}__${safe(r.title, r.extension)}`;
    const dest = path.join(DIR, fname);
    try {
      if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
        // 2 pogingen met pauze: een wifi/DNS-blip (ENOTFOUND-storm 2026-08-07)
        // mag niet de hele restlijst in één seconde laten stranden.
        let resp = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            resp = await ctx.request.get(`https://app.uscreen.tv/bullet_api/v1/file_resources/${r.id}/download`, {
              timeout: 10 * 60_000, maxRedirects: 5,
            });
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            console.log(`[${ts()}]   netwerkfout bij ${r.id}, nieuwe poging over 20s…`);
            await sleep(20_000);
          }
        }
        if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
        fs.writeFileSync(dest, await resp.body());
        console.log(`[${ts()}] ↓ ${fname} (${(fs.statSync(dest).size / 1048576).toFixed(1)} MB)`);
        await sleep(700); // politeness
      } else {
        skipped++;
      }
      let publicUrl = null;
      const STORAGE_MAX = 50 * 1024 * 1024; // gratis Supabase-plan; verhogen = betaald plan (founder-besluit)
      if (UPLOAD && fs.statSync(dest).size > STORAGE_MAX) {
        console.log(`[${ts()}] ⏭ ${fname} (${(fs.statSync(dest).size / 1048576).toFixed(0)} MB) > 50MB — alleen lokaal bewaard, hosting later`);
        manifest.push({ id: String(r.id), title: r.title, extension: r.extension, size: r.size, file: fname, url: null, oversize_local_only: true });
        ok++;
        continue;
      }
      if (UPLOAD) {
        // Storage keys accepteren geen Arabisch/spaties (400 InvalidKey) —
        // upload onder een ASCII-sleutel <id>.<ext>; de echte bestandsnaam
        // blijft in het manifest (UI serveert hem via ?download=<naam>).
        const key = `${r.id}.${String(r.extension || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'}`;
        publicUrl = await uploadToSupabase(dest, key, r.mime_type || undefined);
        console.log(`[${ts()}] ↑ ${fname} → Storage als ${key}`);
      }
      manifest.push({ id: String(r.id), title: r.title, extension: r.extension, size: r.size, file: fname, url: publicUrl });
      ok++;
    } catch (e) {
      failed++;
      console.log(`[${ts()}] ✗ ${fname}: ${String(e.message).slice(0, 120)}`);
      manifest.push({ id: String(r.id), title: r.title, extension: r.extension, size: r.size, file: null, url: null, error: String(e.message).slice(0, 200) });
    }
  }
  fs.writeFileSync(path.join(CC, 'uscreen-resources-manifest.jsonl'), manifest.map((m) => JSON.stringify(m)).join('\n') + '\n');
  console.log(`[${ts()}] DONE: ${ok} ok (${skipped} already on disk), ${failed} failed → uscreen-resources-manifest.jsonl`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
