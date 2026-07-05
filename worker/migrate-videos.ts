/**
 * Video migration pipeline: Uscreen/Mux → Bunny Stream. TWO-PHASE by design:
 *
 *   Phase 1 — HARVEST (sequential, one browser page, gentle):
 *     visit each pending video's admin page, capture its live Mux HLS URL
 *     (token valid ~159min), store on videos.uscreen_hls_url.
 *     IMPORTANT: concurrent admin page loads tripped Uscreen's bot detection
 *     (an hCaptcha appeared once 3-4 admin video-detail pages loaded at
 *     once) — harvest MUST stay sequential with a polite delay.
 *
 *   Phase 2 — TRANSFER (parallel, no browser, no Uscreen contact at all):
 *     for videos with a fresh uscreen_hls_url, ffmpeg-pull the file + upload
 *     to Bunny. Purely bandwidth-bound (Mux CDN + Bunny), so this is where
 *     concurrency actually helps — safe to run 4-6 at once.
 *
 * Run:
 *   node --import tsx migrate-videos.ts --harvest [N]   # sequential, default N=60
 *   node --import tsx migrate-videos.ts --transfer      # parallel, CONCURRENCY workers
 *   node --import tsx migrate-videos.ts --poll          # update Bunny encode status
 *   node --import tsx migrate-videos.ts --dry           # harvest only, log, no Bunny calls
 *
 * Env: cloud.env (Supabase) + BUNNY_LIBRARY_ID + BUNNY_API_KEY.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { bunnyFromEnv, createVideo, getVideo, uploadFile } from './lib/bunny';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const CDP = 'http://127.0.0.1:9333';
const DRY = process.argv.includes('--dry');
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const ENTITY = 'video_migration';
function ts() { return new Date().toISOString().slice(11, 19); }

async function setManifest(extId: string, status: string, err?: string) {
  await sb.from('export_manifest').upsert(
    { entity: ENTITY, external_id: extId, status, last_error: err ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'entity,external_id' },
  );
}

// ── Phase 1: harvest (sequential, one page, polite delay) ──────────────────
async function harvest(limit: number) {
  const { data: vids, error } = await sb
    .from('videos')
    .select('id, external_id, title')
    .eq('source', 'uscreen')
    .is('bunny_video_id', null)
    .is('uscreen_hls_url', null)
    .order('status', { ascending: false }) // published first (~197 total — what the site serves)
    .limit(limit);
  if (error) throw error;
  console.log(`[${ts()}] HARVEST: ${vids?.length ?? 0} videos to harvest (sequential)`);

  const browser = await chromium.connectOverCDP(CDP);
  const page = await browser.contexts()[0].newPage();
  let got = 0, failed = 0;
  for (const v of vids ?? []) {
    try {
      let hls: string | null = null;
      const onResp = (r: any) => { const u = r.url(); if (/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u) && !hls) hls = u; };
      page.on('response', onResp);
      await page.goto(`https://app.uscreen.tv/manage/videos/${v.external_id}/details`, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      if (page.url().includes('login')) { page.off('response', onResp); console.log(`[${ts()}] USCREEN LOGGED OUT — stopping harvest.`); break; }
      await page.waitForTimeout(2600);
      page.off('response', onResp);
      if (!hls) { await setManifest(v.external_id, 'failed', 'no_hls'); failed++; continue; }
      await sb.from('videos').update({ uscreen_hls_url: hls }).eq('id', v.id);
      got++;
      if (got % 10 === 0) console.log(`[${ts()}]   harvested ${got} (${failed} failed)`);
      await page.waitForTimeout(1800); // politeness — avoid tripping bot detection (learned the hard way)
    } catch (e: any) {
      await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200)); failed++;
    }
  }
  await page.close();
  console.log(`[${ts()}] HARVEST DONE: ${got} harvested, ${failed} failed`);
}

// ── Phase 2: transfer (parallel, no browser — bandwidth only) ──────────────
async function localTranscodeUpload(cfg: any, guid: string, hls: string, extId: string, workerId: number) {
  const tmp = path.join(os.tmpdir(), `mig-w${workerId}-${extId}.mp4`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', hls, '-map', '0:p:1', '-sn', '-c', 'copy', '-y', tmp], { timeout: 40 * 60_000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) throw new Error('ffmpeg failed');
  await uploadFile(cfg, guid, tmp);
  fs.rmSync(tmp, { force: true });
}

async function transferWorker(workerId: number, queue: any[], cfg: any, counters: { done: number; failed: number }) {
  while (queue.length) {
    const v = queue.shift();
    if (!v) break;
    try {
      const guid = await createVideo(cfg, v.title);
      await localTranscodeUpload(cfg, guid, v.uscreen_hls_url, v.external_id, workerId);
      await sb.from('videos').update({ bunny_video_id: guid }).eq('id', v.id);
      await setManifest(v.external_id, 'fetched');
      counters.done++;
      console.log(`[${ts()}] w${workerId} ✓ ${v.external_id} "${(v.title || '').slice(0, 40)}" (total ${counters.done}, failed ${counters.failed})`);
    } catch (e: any) {
      console.log(`[${ts()}] w${workerId} ✗ ${v.external_id}: ${String(e.message).slice(0, 120)}`);
      await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200));
      counters.failed++;
    }
  }
}

async function transfer() {
  const cfg = bunnyFromEnv();
  // Videos with a harvested URL (fresh — token ~159min) not yet migrated.
  const { data: vids, error } = await sb
    .from('videos')
    .select('id, external_id, title, uscreen_hls_url')
    .eq('source', 'uscreen')
    .is('bunny_video_id', null)
    .not('uscreen_hls_url', 'is', null);
  if (error) throw error;
  const queue = [...(vids ?? [])];
  console.log(`[${ts()}] TRANSFER: ${queue.length} videos ready (concurrency=${CONCURRENCY})`);
  const counters = { done: 0, failed: 0 };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, (_, i) => transferWorker(i + 1, queue, cfg, counters)));
  console.log(`[${ts()}] TRANSFER DONE: migrated ${counters.done}, failed ${counters.failed}`);
}

// ── poll: update Bunny encode status ────────────────────────────────────────
async function poll() {
  const cfg = bunnyFromEnv();
  const { data } = await sb.from('videos').select('id, external_id, bunny_video_id').eq('source', 'uscreen').not('bunny_video_id', 'is', null).limit(2000);
  let finished = 0, encoding = 0, failed = 0;
  for (const v of data ?? []) {
    try {
      const s = await getVideo(cfg, v.bunny_video_id!);
      if (s.status >= 3 && s.status !== 5) { await setManifest(v.external_id, 'done'); finished++; }
      else if (s.status === 5) { await setManifest(v.external_id, 'failed', 'bunny_encode_failed'); failed++; }
      else encoding++;
    } catch { /* transient */ }
  }
  console.log(`poll: finished ${finished}, still encoding ${encoding}, failed ${failed}`);
}

async function dryHarvest(limit: number) {
  const { data: vids } = await sb.from('videos').select('id, external_id, title').eq('source', 'uscreen').is('bunny_video_id', null).limit(limit);
  const browser = await chromium.connectOverCDP(CDP);
  const page = await browser.contexts()[0].newPage();
  for (const v of vids ?? []) {
    let hls: string | null = null;
    const onResp = (r: any) => { const u = r.url(); if (/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u) && !hls) hls = u; };
    page.on('response', onResp);
    await page.goto(`https://app.uscreen.tv/manage/videos/${v.external_id}/details`, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
    await page.waitForTimeout(2600);
    page.off('response', onResp);
    console.log(`[dry] ${v.external_id}: ${hls ? 'harvested ✓' : 'FAILED'}`);
    await page.waitForTimeout(1500);
  }
  await page.close();
}

const argN = Number(process.argv[process.argv.indexOf('--harvest') + 1]) || 60;
if (process.argv.includes('--poll')) poll().catch((e) => { console.error(e); process.exit(1); });
else if (DRY) dryHarvest(argN).catch((e) => { console.error(e); process.exit(1); });
else if (process.argv.includes('--transfer')) transfer().catch((e) => { console.error(e); process.exit(1); });
else if (process.argv.includes('--harvest')) harvest(argN).catch((e) => { console.error(e); process.exit(1); });
else { console.log('Usage: --harvest [N] | --transfer | --poll | --dry'); process.exit(1); }
