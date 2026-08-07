/**
 * QUALITY RE-TRANSFER — undo the library-wide one-rung quality downgrade.
 *
 * ROOT CAUSE (diagnosed 2026-08-06, browser-verified): the transfer pipeline
 * ran `ffmpeg -map 0:p:1` on Mux master playlists. Mux lists renditions
 * BEST-FIRST, so program 1 is the SECOND-best rendition. Every migrated video
 * is one quality rung below its original (1080p→720p, 720p→540p→Bunny caps at
 * 480p, …). Verified: "Film Omar al-Mukhtar" = 720p on Uscreen, 480p-max on
 * Bunny; "Albunyaan App" = 1080p on Uscreen.
 *
 * WHAT THIS DOES, per video that already has a Bunny copy:
 *   1. fetch a FRESH tokenized hls_url via the admin API (bullet_api
 *      videos.details — no page loads, discovered 2026-08-06);
 *   2. ffprobe the master → find the BEST program (max height) and record it
 *      as videos.original_max_height;
 *   3. read the stored copy's height from Bunny → videos.bunny_height;
 *      if stored ≥ original → manifest 'quality_ok', done, no bandwidth spent;
 *   4. else: download the BEST rendition, upload as a NEW Bunny video, wait
 *      until Bunny finishes encoding, then atomically swap
 *      videos.bunny_video_id and delete the old object. On ANY failure the
 *      old (lower-quality but working) copy stays live — fail-closed.
 *
 * Manifest entity: 'video_requality' (statuses: failed | quality_ok | done).
 * Queue order: member-visible first, shortest first (same policy as the
 * original migration; founder-ratified).
 *
 * Run (from worker/):
 *   node_modules/.bin/tsx requality-videos.ts --run [BATCH]   # default 100/round, loops
 *   node_modules/.bin/tsx requality-videos.ts --status        # queue/coverage counts
 * Env: ~/.albunyaan-cc/cloud.env (Supabase + Bunny). CONCURRENCY (default 4).
 * Prereq: twin Chrome on :9333 with live admin session; migration 0013 applied.
 *
 * ⚠ Storage on Bunny roughly DOUBLES while old+new coexist per in-flight video
 *   and grows permanently with the higher renditions. TOP UP THE BUNNY BALANCE
 *   FIRST — an account suspension mid-swap is the worst possible failure mode.
 * ⚠ Do not run at the same time as the migrate-overnight orchestrator: they
 *   share the twin Chrome and the bandwidth budget.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { bunnyFromEnv, createVideo, deleteVideo, uploadFile, type BunnyConfig } from './lib/bunny';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const CDP = 'http://127.0.0.1:9333';
const ENTITY = 'video_requality';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
// --only <extId,extId,…>: beperk de wachtrij tot precies deze video's — voor
// de founder-verplichte kwaliteitspilot (5 bekende HD-video's) vóór elke
// volledige run. Zonder --only geldt de normale member-first/kortste-eerst-wachtrij.
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? String(process.argv[i + 1]).split(',').map((s) => s.trim()).filter(Boolean) : null; })();
const BUNNY_BASE = 'https://video.bunnycdn.com';
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tokenExpSec(hls: string): number | null {
  const m = /[?&]token=([^&]+)/.exec(hls);
  if (!m) return null;
  try {
    const claims = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch { return null; }
}

async function setManifest(extId: string, status: string, err?: string) {
  const { error } = await sb.from('export_manifest').upsert(
    { entity: ENTITY, external_id: extId, status, last_error: err ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'entity,external_id' },
  );
  if (error) console.error(`[${ts()}] manifest write FAILED for ${extId} (${status}): ${error.message}`);
}

/** ffprobe the HLS master → programs with their video heights, best-first. */
function probePrograms(hls: string): Promise<{ index: number; height: number }[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_programs', hls]);
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    const t = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err.slice(0, 200)}`));
      try {
        const j = JSON.parse(out);
        const progs = (j.programs ?? []).map((p: any) => ({
          index: p.program_id ?? p.program_num ?? 0,
          height: Math.max(0, ...(p.streams ?? []).map((s: any) => s.height ?? s.coded_height ?? 0)),
        })).filter((p: any) => p.height > 0);
        // ffprobe program_id equals the playlist order index for HLS; sort best-first.
        progs.sort((a: any, b: any) => b.height - a.height);
        resolve(progs);
      } catch (e: any) { reject(new Error(`ffprobe parse: ${e.message}`)); }
    });
  });
}

/** Bunny video details incl. stored height + encode status (lib/bunny's getVideo lacks height). */
async function bunnyVideo(cfg: BunnyConfig, guid: string): Promise<{ status: number; height: number; length: number }> {
  const res = await fetch(`${BUNNY_BASE}/library/${cfg.libraryId}/videos/${guid}`, {
    headers: { AccessKey: cfg.apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`bunny getVideo ${res.status}`);
  const d = (await res.json()) as any;
  return { status: d.status, height: d.height ?? 0, length: d.length ?? 0 };
}

function runFfmpeg(hls: string, programIndex: number, tmp: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // -map 0:p:<index> — the index is the PLAYLIST-ORDER program number.
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', hls, '-map', `0:p:${programIndex}`, '-sn', '-c', 'copy', '-y', tmp]);
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

interface Item { id: string; external_id: string; title: string; bunny_video_id: string; bunny_height: number | null; duration_seconds: number | null; hls?: string }

async function loadQueue(limit: number): Promise<Item[]> {
  // Paginated skip-set (1000-row clamp!): everything already resolved for this entity.
  const resolved = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('export_manifest').select('external_id,status').eq('entity', ENTITY).range(from, from + 999);
    for (const r of data ?? []) if (['done', 'quality_ok'].includes(r.status)) resolved.add(r.external_id);
    if (!data || data.length < 1000) break;
  }
  const out: Item[] = [];
  for (let from = 0; out.length < limit; from += 1000) {
    let q = sb.from('videos')
      .select('id, external_id, title, bunny_video_id, bunny_height, duration_seconds')
      .eq('source', 'uscreen').not('bunny_video_id', 'is', null)
      .order('member_visible', { ascending: false })
      .order('duration_seconds', { ascending: true, nullsFirst: false })
      .range(from, from + 999);
    if (ONLY) q = q.in('external_id', ONLY);
    const { data, error } = await q;
    if (error) throw error;
    for (const v of data ?? []) if (!resolved.has(v.external_id) && out.length < limit) out.push(v as Item);
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function harvestTokens(items: Item[]): Promise<Item[]> {
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  let page =
    ctx.pages().find((p) => p.url() === 'about:blank') ??
    ctx.pages().find((p) => p.url().includes('app.uscreen.tv')) ??
    (await ctx.newPage());
  if (!page.url().includes('app.uscreen.tv')) {
    await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  if (page.url().includes('login')) throw new Error('USCREEN SESSION DEAD — log in in the twin Chrome first.');
  const ready: Item[] = [];
  for (const v of items) {
    try {
      const r: any = await page.evaluate(async (id: number) => {
        const res = await fetch('/bullet_api/v1/videos.details', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }), redirect: 'manual',
        });
        let json = null; try { json = await res.json(); } catch {}
        return { status: res.status, hls: json?.video?.hls_url ?? null };
      }, Number(v.external_id));
      if (r.status === 401 || r.status === 403) { console.log(`[${ts()}] SESSION LOST mid-harvest — using what we have.`); break; }
      if (r.hls) ready.push({ ...v, hls: r.hls });
      else await setManifest(v.external_id, 'failed', 'no_hls_from_api');
      await sleep(350);
    } catch (e: any) {
      await setManifest(v.external_id, 'failed', `harvest: ${String(e.message).slice(0, 150)}`);
    }
  }
  await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  return ready;
}

async function processOne(cfg: BunnyConfig, v: Item, workerId: number, counters: { done: number; ok: number; failed: number }) {
  const tmp = path.join(os.tmpdir(), `rq-w${workerId}-${v.external_id}.mp4`);
  let newGuid: string | undefined;
  try {
    const progs = await probePrograms(v.hls!);
    if (!progs.length) throw new Error('no video programs in master');
    const best = progs[0];
    await sb.from('videos').update({ original_max_height: best.height }).eq('id', v.id);

    let storedHeight = v.bunny_height;
    if (storedHeight == null) {
      const bv = await bunnyVideo(cfg, v.bunny_video_id);
      storedHeight = bv.height;
      await sb.from('videos').update({ bunny_height: storedHeight }).eq('id', v.id);
    }
    if (storedHeight != null && storedHeight >= best.height) {
      await setManifest(v.external_id, 'quality_ok');
      counters.ok++;
      console.log(`[${ts()}] w${workerId} = ${v.external_id} already at source quality (${storedHeight}p)`);
      return;
    }

    const exp = tokenExpSec(v.hls!);
    const runwayMs = exp ? exp * 1000 - Date.now() - 5 * 60_000 : 40 * 60_000;
    if (runwayMs < 5 * 60_000) throw new Error('token too stale for a safe transfer');
    await runFfmpeg(v.hls!, best.index, tmp, Math.min(150 * 60_000, Math.max(10 * 60_000, runwayMs)));
    if (!fs.existsSync(tmp)) throw new Error('ffmpeg produced no output file');
    const bytes = fs.statSync(tmp).size;

    newGuid = await createVideo(cfg, v.title);
    await uploadFile(cfg, newGuid, tmp);
    fs.rmSync(tmp, { force: true });

    // Wait for Bunny to finish encoding BEFORE the swap: the site must never
    // point at a still-encoding object. status 3/4 = done, 5 = failed.
    let final: { status: number; height: number } | null = null;
    for (let waited = 0; waited < 60 * 60_000; waited += 20_000) {
      await sleep(20_000);
      const s = await bunnyVideo(cfg, newGuid).catch(() => null);
      if (!s) continue;
      if (s.status === 5) throw new Error('bunny encode failed on new object');
      if (s.status >= 3) { final = s; break; }
    }
    if (!final) throw new Error('bunny encode timeout (1h) on new object');

    const oldGuid = v.bunny_video_id;
    const { error } = await sb.from('videos')
      .update({ bunny_video_id: newGuid, bunny_height: final.height, original_max_height: best.height })
      .eq('id', v.id);
    if (error) throw new Error(`db swap failed: ${error.message}`);
    await deleteVideo(cfg, oldGuid).catch((e) => console.log(`[${ts()}]   old-object delete failed for ${v.external_id} (harmless orphan): ${e.message}`));
    await setManifest(v.external_id, 'done');
    counters.done++;
    console.log(`[${ts()}] w${workerId} ✓ ${v.external_id} "${(v.title || '').slice(0, 36)}" ${storedHeight ?? '?'}p→${final.height}p (${(bytes / 1073741824).toFixed(2)}GB)`);
  } catch (e: any) {
    counters.failed++;
    fs.rmSync(tmp, { force: true });
    if (newGuid) await deleteVideo(bunnyFromEnv(), newGuid).catch(() => {}); // no placeholder orphans (0-byte lesson)
    await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200));
    console.log(`[${ts()}] w${workerId} ✗ ${v.external_id}: ${String(e.message).slice(0, 120)}`);
  }
}

async function run(batch: number) {
  const cfg = bunnyFromEnv();
  for (let round = 1; ; round++) {
    const queue = await loadQueue(batch);
    if (!queue.length) { console.log(`[${ts()}] queue empty — all videos resolved for entity '${ENTITY}'.`); break; }
    console.log(`[${ts()}] ROUND ${round}: ${queue.length} videos — harvesting fresh tokens via admin API…`);
    const ready = await harvestTokens(queue);
    console.log(`[${ts()}] ROUND ${round}: ${ready.length} tokens — probing/transferring (concurrency=${CONCURRENCY})…`);
    const counters = { done: 0, ok: 0, failed: 0 };
    const pool = [...ready];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pool.length || 1) }, async (_, i) => {
      while (pool.length) {
        const v = pool.shift();
        if (v) await processOne(cfg, v, i + 1, counters);
      }
    }));
    console.log(`[${ts()}] ROUND ${round} DONE: re-transferred ${counters.done}, already-ok ${counters.ok}, failed ${counters.failed}`);
    if (!ready.length) { console.log(`[${ts()}] nothing harvestable (session dead?) — stopping.`); break; }
  }
}

async function status() {
  const counts: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('export_manifest').select('status').eq('entity', ENTITY).range(from, from + 999);
    for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (!data || data.length < 1000) break;
  }
  const { count: total } = await sb.from('videos').select('id', { count: 'exact', head: true }).eq('source', 'uscreen').not('bunny_video_id', 'is', null);
  console.log({ migrated_total: total, ...counts, todo: (total ?? 0) - Object.entries(counts).filter(([k]) => ['done', 'quality_ok'].includes(k)).reduce((a, [, v]) => a + v, 0) });
}

const argN = Number(process.argv[process.argv.indexOf('--run') + 1]) || 100;
const main = process.argv.includes('--status') ? status()
  : process.argv.includes('--run') ? run(argN)
  : (console.log('Usage: --run [BATCH] | --status'), Promise.resolve());
main.then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
