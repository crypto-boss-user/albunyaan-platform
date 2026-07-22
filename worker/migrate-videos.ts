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
  // supabase-js returns errors instead of throwing; swallowing them here hid a
  // CHECK-constraint rejection of 'done'/'skip_no_hls' for weeks (fixed in
  // migration 0011) — always surface manifest write failures.
  const { error } = await sb.from('export_manifest').upsert(
    { entity: ENTITY, external_id: extId, status, last_error: err ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'entity,external_id' },
  );
  if (error) console.error(`[${ts()}] manifest write FAILED for ${extId} (${status}): ${error.message}`);
}

// ── Phase 1: harvest (sequential, one page, polite delay) ──────────────────
async function harvest(limit: number) {
  // Over-fetch, then drop videos we've learned have no stream. Without this,
  // permanently stream-less videos (live channels have no VOD file; some old
  // drafts have dead sources) sit at the front of the deterministic sort and
  // re-occupy the whole batch every round — harvest collapsed 60/60 → 3/57
  // overnight 2026-07-11 exactly this way. `status='live'` is excluded outright;
  // anything else gets two no_hls strikes (manifest status 'skip_no_hls') and
  // is then skipped for good.
  const { data: rawVids, error } = await sb
    .from('videos')
    .select('id, external_id, title')
    .eq('source', 'uscreen')
    .neq('status', 'live')
    .is('bunny_video_id', null)
    .is('uscreen_hls_url', null)
    // Member-visible first (founder-ratified 2026-07-22, MASTER-PLAN Phase 2 +
    // migration-truth.md): members watch through published COLLECTIONS, so the
    // real watchable universe is 15,180 videos, not the 197 status='published'
    // ones (all long since migrated). member_visible is populated by
    // set-member-visible.ts from the collection scrapes (migration 0012).
    .order('member_visible', { ascending: false })
    // Shortest first within each tier: 80% of the library is <15-min episodes
    // (~150-300MB each) while the giants are multi-GB movies — on the founder's
    // metered 400GB bundle (every video costs 2× its size, down + up), smallest-
    // first buys ~10x more videos per GB and per hour. Giants sink to the tail.
    .order('duration_seconds', { ascending: true, nullsFirst: false })
    .limit(limit * 5);
  if (error) throw error;
  const candidateIds = (rawVids ?? []).map((v) => v.external_id);
  const priorFail = new Map<string, string>(); // external_id -> last_error
  const skipped = new Set<string>();
  for (let i = 0; i < candidateIds.length; i += 200) {
    const { data: mrows } = await sb.from('export_manifest').select('external_id, status, last_error')
      .eq('entity', ENTITY).in('external_id', candidateIds.slice(i, i + 200));
    for (const m of mrows ?? []) {
      if (m.status === 'skip_no_hls') skipped.add(m.external_id);
      else if (m.last_error) priorFail.set(m.external_id, m.last_error);
    }
  }
  const vids = (rawVids ?? []).filter((v) => !skipped.has(v.external_id)).slice(0, limit);
  console.log(`[${ts()}] HARVEST: ${vids.length} videos to harvest (sequential${skipped.size ? `, ${skipped.size} known stream-less skipped` : ''})`);

  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  // REUSE an existing tab instead of always opening a new one. Every harvest
  // round used to newPage() and never close it (see park note at the end), so
  // tabs accumulated all night — dozens of heavy admin pages (each auto-loads
  // a Mux player, ~150-300MB) filled the Mac's application memory until macOS
  // threw its "force-quit apps" dialog. Prefer a parked about:blank tab, then
  // any Uscreen tab, and only create one if the context is empty.
  let page =
    ctx.pages().find((p) => p.url() === 'about:blank') ??
    ctx.pages().find((p) => p.url().includes('app.uscreen.tv')) ??
    (await ctx.newPage());
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
      if (!hls) {
        // Second consecutive no_hls = give up on this video permanently (it has
        // no reachable stream); one strike could just be a slow page load.
        const secondStrike = priorFail.get(v.external_id) === 'no_hls';
        await setManifest(v.external_id, secondStrike ? 'skip_no_hls' : 'failed', 'no_hls');
        failed++;
        continue;
      }
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
  // PARK the page on about:blank instead of leaving the heavy admin page (SPA +
  // Mux player) resident, and sweep any surplus Uscreen tabs from HARD_TIMEOUT
  // recreations or prior crashed runs. The one hard rule: NEVER close the LAST
  // open page — that broke Playwright's connectOverCDP handshake for every
  // future script ("Browser context management is not supported") until a page
  // was reopened via the raw CDP HTTP API. Parking (navigate, don't close)
  // satisfies that while freeing the tab's memory.
  await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  for (const p of ctx.pages()) {
    if (p !== page && /app\.uscreen\.tv\/manage\/videos\//.test(p.url())) {
      await p.close().catch(() => {});
    }
  }
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
  const bytes = fs.statSync(tmp).size;
  await uploadFile(cfg, guid, tmp);
  fs.rmSync(tmp, { force: true });
  return bytes;
}

async function transferWorker(workerId: number, queue: any[], cfg: any, counters: { done: number; failed: number }) {
  while (queue.length) {
    const v = queue.shift();
    if (!v) break;
    let guid: string | undefined;
    try {
      guid = await createVideo(cfg, v.title);
      const bytes = await localTranscodeUpload(cfg, guid, v.uscreen_hls_url, v.external_id, workerId);
      await sb.from('videos').update({ bunny_video_id: guid }).eq('id', v.id);
      await setManifest(v.external_id, 'fetched');
      counters.done++;
      // Size in the log = bundle-burn visibility (metered connection; each video
      // costs ~2× this figure in bundle data: download + upload).
      const gb = (bytes / 1073741824).toFixed(2);
      console.log(`[${ts()}] w${workerId} ✓ ${v.external_id} "${(v.title || '').slice(0, 40)}" (${gb}GB, total ${counters.done}, failed ${counters.failed})`);
    } catch (e: any) {
      console.log(`[${ts()}] w${workerId} ✗ ${v.external_id}: ${String(e.message).slice(0, 120)}`);
      // A failed/aborted download leaves its multi-GB temp file behind (only
      // the success path removes it) — delete it here or they accumulate.
      fs.rmSync(path.join(os.tmpdir(), `mig-w${workerId}-${v.external_id}.mp4`), { force: true });
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
    .select('id, external_id, title, uscreen_hls_url, duration_seconds, member_visible')
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
  // Shortest first (freshest token as tiebreak): small files finish well inside
  // any token's life, and on the metered line each GB spent on a movie buys
  // 10-20 fewer episodes. Token-freshness-first mattered when giants outlived
  // their tokens; the preflight above already clears the expired ones.
  const queue = all
    .filter((v) => !staleIds.has(v.id))
    .sort((a, b) => Number(b.member_visible ?? false) - Number(a.member_visible ?? false)
                 || (a.duration_seconds ?? 1e9) - (b.duration_seconds ?? 1e9)
                 || (tokenExpSec(b.uscreen_hls_url) ?? 0) - (tokenExpSec(a.uscreen_hls_url) ?? 0));
  console.log(`[${ts()}] TRANSFER: ${queue.length} videos ready (concurrency=${CONCURRENCY})`);
  const counters = { done: 0, failed: 0 };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, (_, i) => transferWorker(i + 1, queue, cfg, counters)));
  console.log(`[${ts()}] TRANSFER DONE: migrated ${counters.done}, failed ${counters.failed}`);
}

// ── poll: update Bunny encode status ────────────────────────────────────────
async function poll() {
  const cfg = bunnyFromEnv();
  // Skip videos already marked 'done' in the manifest — polling ALL migrated
  // videos every time grew linearly and blocked the orchestrator for 70+ min
  // per poll round (observed 02:10→03:22 on 2026-07-11, freezing the whole
  // pipeline every 5th round). Manifest reads are paginated because Supabase
  // REST silently clamps any page to 1000 rows (hard-learned backup lesson).
  const done = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: rows } = await sb.from('export_manifest').select('external_id')
      .eq('entity', ENTITY).eq('status', 'done').range(from, from + 999);
    for (const r of rows ?? []) done.add(r.external_id);
    if (!rows || rows.length < 1000) break;
  }
  // Paginated for the same 1000-row clamp reason: .limit(5000) was silently
  // truncated to 1000 and later-migrated videos were never polled.
  const migrated: { id: string; external_id: string; bunny_video_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await sb.from('videos').select('id, external_id, bunny_video_id')
      .eq('source', 'uscreen').not('bunny_video_id', 'is', null).range(from, from + 999);
    migrated.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  let finished = done.size, encoding = 0, failed = 0;
  for (const v of migrated) {
    if (done.has(v.external_id)) continue;
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
