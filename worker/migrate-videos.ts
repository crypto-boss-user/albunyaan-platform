/**
 * Video migration pipeline: Uscreen/Mux → Bunny Stream.
 *
 * For each Uscreen video not yet migrated:
 *   1. harvest a fresh Mux HLS URL from the admin (CDP :9333; token valid ~159min)
 *   2. create a Bunny video + ask Bunny to FETCH the URL server-side (no local bandwidth)
 *   3. store bunny_video_id on the row; track state in export_manifest
 * Resumable (skips rows with a bunny_video_id / manifest 'fetched'|'done'), polite,
 * batched so we never outrun the token window.
 *
 * Env: cloud.env (Supabase) + BUNNY_LIBRARY_ID + BUNNY_API_KEY.
 * Run:  node --import tsx migrate-videos.ts            # migrate a batch
 *       MIGRATE_LIMIT=50 node --import tsx migrate-videos.ts
 *       node --import tsx migrate-videos.ts --poll     # update encode status
 *       node --import tsx migrate-videos.ts --dry      # harvest only, no Bunny calls
 *
 * MODE=local falls back to ffmpeg HLS→MP4 + direct upload (bandwidth-bound) for any
 * video Bunny's server-side fetch can't handle.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { bunnyFromEnv, createVideo, fetchFromUrl, getVideo, uploadFile, BUNNY_STATUS } from './lib/bunny';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const CDP = 'http://127.0.0.1:9333';
const DRY = process.argv.includes('--dry');
const POLL = process.argv.includes('--poll');
const MODE = process.env.MODE ?? 'fetch';
const LIMIT = Number(process.env.MIGRATE_LIMIT ?? 200);
const ENTITY = 'video_migration';

async function setManifest(extId: string, status: string, err?: string) {
  await sb.from('export_manifest').upsert(
    { entity: ENTITY, external_id: extId, status, last_error: err ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'entity,external_id' },
  );
}

/** Navigate the admin video page and capture its live Mux HLS URL (fresh token). */
async function harvestHls(page: any, extId: string): Promise<string | null> {
  let hls: string | null = null;
  const onResp = (r: any) => { const u = r.url(); if (/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u) && !hls) hls = u; };
  page.on('response', onResp);
  await page.goto(`https://app.uscreen.tv/manage/videos/${extId}/details`, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
  if (page.url().includes('login')) { page.off('response', onResp); throw new Error('USCREEN_LOGGED_OUT'); }
  await page.waitForTimeout(2800);
  page.off('response', onResp);
  return hls;
}

/** Fallback: ffmpeg pulls the highest rendition to a temp MP4, then PUT to Bunny. */
async function localTranscodeUpload(cfg: any, guid: string, hls: string, extId: string) {
  const tmp = path.join(os.tmpdir(), `mig-${extId}.mp4`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', hls, '-map', '0:p:1', '-sn', '-c', 'copy', '-y', tmp], { timeout: 40 * 60_000 });
  if (r.status !== 0 || !fs.existsSync(tmp)) throw new Error('ffmpeg failed');
  await uploadFile(cfg, guid, tmp);
  fs.rmSync(tmp, { force: true });
}

async function migrate() {
  const cfg = DRY ? null : bunnyFromEnv();
  // Pending = uscreen videos with no bunny_video_id yet. Published first (what the site serves).
  const { data: vids, error } = await sb
    .from('videos')
    .select('id, external_id, title, bunny_video_id')
    .eq('source', 'uscreen')
    .is('bunny_video_id', null)
    .order('status', { ascending: true })
    .limit(LIMIT);
  if (error) throw error;
  console.log(`${vids?.length ?? 0} videos to migrate this run (mode=${MODE}${DRY ? ', DRY' : ''})`);

  const browser = await chromium.connectOverCDP(CDP);
  const page = await browser.contexts()[0].newPage();
  let done = 0, failed = 0;
  for (const v of vids ?? []) {
    try {
      const hls = await harvestHls(page, v.external_id);
      if (!hls) { await setManifest(v.external_id, 'failed', 'no_hls'); failed++; continue; }
      await sb.from('videos').update({ uscreen_hls_url: hls }).eq('id', v.id);
      if (DRY) { console.log(`  [dry] ${v.external_id} harvested`); done++; await page.waitForTimeout(1500); continue; }

      const guid = await createVideo(cfg!, v.title);
      if (MODE === 'local') {
        await localTranscodeUpload(cfg!, guid, hls, v.external_id);
      } else {
        const f = await fetchFromUrl(cfg!, guid, hls);
        if (!f.ok) throw new Error(`bunny fetch ${f.status}: ${f.body}`);
      }
      await sb.from('videos').update({ bunny_video_id: guid }).eq('id', v.id);
      await setManifest(v.external_id, 'fetched');
      done++;
      if (done % 10 === 0) console.log(`  migrated ${done} (${failed} failed)`);
      await page.waitForTimeout(1500); // politeness
    } catch (e: any) {
      if (String(e.message).includes('LOGGED_OUT')) { console.log('Uscreen session expired — re-login and rerun.'); break; }
      await setManifest(v.external_id, 'failed', String(e.message).slice(0, 200)); failed++;
    }
  }
  await page.close();
  console.log(`\nRUN DONE: migrated ${done}, failed ${failed}`);
}

/** Poll Bunny encode status for videos we've handed off, mark manifest 'done'. */
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

(POLL ? poll() : migrate()).catch((e) => { console.error(e); process.exit(1); });
