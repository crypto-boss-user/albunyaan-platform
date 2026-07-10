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
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { bunnyFromEnv, createVideo, deleteVideo, getVideo, uploadFile } from './lib/bunny';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const CDP = 'http://127.0.0.1:9333';
const DRY = process.argv.includes('--dry');
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const ENTITY = 'video_migration';
function ts() { return new Date().toISOString().slice(11, 19); }

/** exp claim (unix sec) of the Mux playback token in ?token=; null if absent/undecodable. */
function tokenExpSec(hls: string): number | null {
  const m = /[?&]token=([^&]+)/.exec(hls);
  if (!m) return null;
  try {
    const claims = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch { return null; }
}

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
  let page = await browser.contexts()[0].newPage();
  let got = 0, failed = 0;
  for (const v of vids ?? []) {
    try {
      // Hard per-video timeout (defense in depth): one video hung an entire overnight
      // run for 20+ minutes despite a 35s goto timeout — likely stale page/listener
      // state after hours of navigations. If a video takes >25s total, force-fail it,
      // recreate the page fresh, and move on. Never let one video block the batch.
      const one = async () => {
        let hls: string | null = null;
        const onResp = (r: any) => { const u = r.url(); if (/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u) && !hls) hls = u; };
        page.on('response', onResp);
        await page.goto(`https://app.uscreen.tv/manage/videos/${v.external_id}/details`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        if (page.url().includes('login')) { page.off('response', onResp); throw new Error('LOGGED_OUT'); }
        await page.waitForTimeout(2600);
        page.off('response', onResp);
        return hls;
      };
      const hls = await Promise.race([
        one(),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error('HARD_TIMEOUT')), 25000)),
      ]);
      if (!hls) { await setManifest(v.external_id, 'failed', 'no_hls'); failed++; continue; }
      await sb.from('videos').update({ uscreen_hls_url: hls }).eq('id', v.id);
      got++;
      if (got % 10 === 0) console.log(`[${ts()}]   harvested ${got} (${failed} failed)`);
      await page.waitForTimeout(1800); // politeness — avoid tripping bot detection (learned the hard way)
    } catch (e: any) {
      if (String(e.message) === 'LOGGED_OUT') { console.log(`[${ts()}] USCREEN LOGGED OUT — stopping harvest.`); break; }
      if (String(e.message) === 'HARD_TIMEOUT') {
        console.log(`[${ts()}]   ${v.external_id} hard-timed-out — recreating page and continuing.`);
        await page.close().catch(() => {});
        page = await browser.contexts()[0].newPage();
        await setManifest(v.external_id, 'failed', 'hard_timeout');
        failed++;
        continue;
      }
      await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200)); failed++;
    }
  }
  // Deliberately NOT closing this page: closing the LAST open page in the shared
  // browser broke Playwright's connectOverCDP handshake entirely for every future
  // script ("Browser context management is not supported") until a page was
  // reopened via the raw CDP HTTP API. Leaving an idle tab open is harmless and
  // avoids that whole class of failure.
  console.log(`[${ts()}] HARVEST DONE: ${got} harvested, ${failed} failed`);
}

// ── Phase 2: transfer (parallel, no browser — bandwidth only) ──────────────
// ASYNC spawn (not spawnSync): spawnSync blocks Node's single JS thread for the
// whole ffmpeg run, so N "concurrent" workers could never actually overlap —
// discovered overnight (CONCURRENCY=5 configured, only ever 1 ffmpeg observed
// running). Async spawn lets multiple in-flight child processes interleave.
function runFfmpeg(hls: string, tmp: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', hls, '-map', '0:p:1', '-sn', '-c', 'copy', '-y', tmp]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    const killTimer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 200)}`));
      resolve();
    });
  });
}

async function localTranscodeUpload(cfg: any, guid: string, hls: string, extId: string, workerId: number) {
  const tmp = path.join(os.tmpdir(), `mig-w${workerId}-${extId}.mp4`);
  // Timeout = the token's remaining life minus a 5-min upload margin (floor 10,
  // cap 150 min) instead of a fixed 40 min: long lectures were being SIGKILLed
  // at 40 min and retried forever — 634 such kills in the log, ~40 min of
  // wasted bandwidth each, with the worst videos failing 20+ times.
  const exp = tokenExpSec(hls);
  const runwayMs = exp ? exp * 1000 - Date.now() - 5 * 60_000 : 40 * 60_000;
  await runFfmpeg(hls, tmp, Math.min(150 * 60_000, Math.max(10 * 60_000, runwayMs)));
  if (!fs.existsSync(tmp)) throw new Error('ffmpeg produced no output file');
  await uploadFile(cfg, guid, tmp);
  fs.rmSync(tmp, { force: true });
}

async function transferWorker(workerId: number, queue: any[], cfg: any, counters: { done: number; failed: number }) {
  while (queue.length) {
    const v = queue.shift();
    if (!v) break;
    let guid: string | undefined;
    try {
      guid = await createVideo(cfg, v.title);
      await localTranscodeUpload(cfg, guid, v.uscreen_hls_url, v.external_id, workerId);
      await sb.from('videos').update({ bunny_video_id: guid }).eq('id', v.id);
      await setManifest(v.external_id, 'fetched');
      counters.done++;
      console.log(`[${ts()}] w${workerId} ✓ ${v.external_id} "${(v.title || '').slice(0, 40)}" (total ${counters.done}, failed ${counters.failed})`);
    } catch (e: any) {
      console.log(`[${ts()}] w${workerId} ✗ ${v.external_id}: ${String(e.message).slice(0, 120)}`);
      // Clear the stale HLS URL so this video re-enters the harvest queue for a
      // fresh Mux token instead of being stuck forever (harvest skips anything
      // with uscreen_hls_url already set, and a failed token never gets fresher).
      await sb.from('videos').update({ uscreen_hls_url: null }).eq('id', v.id);
      await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200));
      // createVideo() runs before the download/upload attempt, so any failure
      // after that point leaves an empty placeholder on Bunny forever (found
      // 2026-07-10: 97% of the 6,017 videos in the library were 0-byte orphans
      // from exactly this — createVideo succeeds, then ffmpeg/upload fails).
      // Best-effort cleanup so failures stop leaking placeholders going forward.
      if (guid) await deleteVideo(cfg, guid).catch(() => {});
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
  // Preflight: 80% of attempts were 403s on already-expired tokens (each one
  // burning a createVideo + ffmpeg + deleteVideo round trip). Clear those URLs
  // in bulk so the videos re-enter harvest — same contract as the on-failure
  // clear below, minus the wasted attempt.
  const nowSec = Date.now() / 1000;
  const all = vids ?? [];
  const stale = all.filter((v) => { const e = tokenExpSec(v.uscreen_hls_url); return e !== null && e < nowSec + 300; });
  if (stale.length) {
    console.log(`[${ts()}] TRANSFER: clearing ${stale.length} expired-token URLs for re-harvest (preflight)`);
    for (let i = 0; i < stale.length; i += 100) {
      await sb.from('videos').update({ uscreen_hls_url: null }).in('id', stale.slice(i, i + 100).map((v) => v.id));
    }
  }
  const staleIds = new Set(stale.map((v) => v.id));
  // Freshest token first: workers spend bandwidth where the runway is longest.
  const queue = all
    .filter((v) => !staleIds.has(v.id))
    .sort((a, b) => (tokenExpSec(b.uscreen_hls_url) ?? 0) - (tokenExpSec(a.uscreen_hls_url) ?? 0));
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

// CRITICAL: explicit process.exit(0) on success is required. Playwright's
// connectOverCDP() keeps an open WebSocket handle that holds Node's event loop
// alive forever if never closed — a run finished, printed "DONE", and then sat
// there as a zombie process for 44+ minutes, silently fighting every other
// script for the same shared browser (very likely the actual cause of the
// hCaptcha trigger and stuck-page symptoms seen earlier tonight). A bash
// `| tee` pipe blocks on the process actually exiting, not on output stopping,
// so this also silently stalled the overnight orchestrator between phases.
const argN = Number(process.argv[process.argv.indexOf('--harvest') + 1]) || 60;
const run = process.argv.includes('--poll') ? poll()
  : DRY ? dryHarvest(argN)
  : process.argv.includes('--transfer') ? transfer()
  : process.argv.includes('--harvest') ? harvest(argN)
  : (console.log('Usage: --harvest [N] | --transfer | --poll | --dry'), Promise.resolve());
run.then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
