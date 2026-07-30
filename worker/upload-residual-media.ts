/**
 * One-off: upload locally-rescued residual videos to Bunny and record them.
 *
 * Context (2026-07-30 residual-19 session, MASTER-PLAN §A2.3): the 19
 * member-visible videos missing from Bunny (plus non-member 2811589) were all
 * verified ALIVE at the source and pulled to ~/.albunyaan-cc/residual-media/
 * with fresh Mux tokens. 18 were false skip_no_hls strikes from the Jul 22-23
 * burst storm; 2 (2224176, 2811589) are single-rendition streams the pipeline's
 * `-map 0:p:1` can never match (pulled with -map 0:p:0 instead).
 *
 * This script uploads those verified local files and does exactly what the
 * pipeline's transfer success path does: set videos.bunny_video_id + manifest
 * 'fetched' (the VPS poll later marks 'done'). On ANY upload failure it deletes
 * the just-created empty Bunny placeholder (fail-closed, rule 4) and keeps the
 * local file. It never touches uscreen_hls_url and never contacts Uscreen.
 *
 * Run (from worker/):  node_modules/.bin/tsx upload-residual-media.ts          # dry-run
 *                      node_modules/.bin/tsx upload-residual-media.ts --execute
 *
 * Requires a WORKING BUNNY_API_KEY (the 2026-07-30 session found the key 401s
 * — founder must refresh it in cloud.env first). Preflight aborts loudly if
 * the key is still invalid. Keep the local files until a --poll shows 'done'.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { bunnyFromEnv, createVideo, deleteVideo, getVideo, uploadFile } from './lib/bunny';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ENTITY = 'video_migration';
const MEDIA_DIR = path.join(os.homedir(), '.albunyaan-cc/residual-media');
const EXECUTE = process.argv.includes('--execute');
function ts() { return new Date().toISOString().slice(11, 19); }

async function setManifest(extId: string, status: string, err?: string) {
  const { error } = await sb.from('export_manifest').upsert(
    { entity: ENTITY, external_id: extId, status, last_error: err ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'entity,external_id' },
  );
  if (error) console.error(`[${ts()}] manifest write FAILED for ${extId} (${status}): ${error.message}`);
}

async function main() {
  const cfg = bunnyFromEnv();
  const files = fs.readdirSync(MEDIA_DIR).filter((f) => /^\d+\.mp4$/.test(f)).sort();
  if (!files.length) { console.error(`no <id>.mp4 files in ${MEDIA_DIR}`); process.exit(1); }
  console.log(`[${ts()}] ${files.length} local files, mode: ${EXECUTE ? 'EXECUTE' : 'dry-run'}`);

  // Key preflight: getVideo on any tracked guid must not 401.
  const { data: probe } = await sb.from('videos').select('bunny_video_id').not('bunny_video_id', 'is', null).limit(1);
  try {
    await getVideo(cfg, probe![0].bunny_video_id!);
  } catch (e: any) {
    const msg = `Bunny API preflight failed (${e.message}) — BUNNY_API_KEY likely still invalid. Refresh it in ~/.albunyaan-cc/cloud.env (and on the VPS) first.`;
    if (EXECUTE) { console.error(`[${ts()}] ABORT: ${msg}`); process.exit(1); }
    console.warn(`[${ts()}] WARN (dry-run continues): ${msg}`);
  }
  if (EXECUTE) console.log(`[${ts()}] Bunny key preflight OK`);

  let ok = 0, skipped = 0, failed = 0;
  for (const f of files) {
    const extId = f.replace('.mp4', '');
    const { data: rows, error } = await sb.from('videos')
      .select('id, external_id, title, bunny_video_id')
      .eq('source', 'uscreen').eq('external_id', extId).limit(2);
    if (error || !rows?.length) { console.error(`[${ts()}] ✗ ${extId}: DB row not found`); failed++; continue; }
    const v = rows[0];
    if (v.bunny_video_id) { console.log(`[${ts()}] ○ ${extId}: already migrated (${v.bunny_video_id}) — skip`); skipped++; continue; }
    const size = fs.statSync(path.join(MEDIA_DIR, f)).size;
    if (!EXECUTE) { console.log(`[${ts()}] would upload ${extId} "${v.title}" (${(size / 1e6).toFixed(1)}MB)`); continue; }

    let guid: string | null = null;
    try {
      guid = await createVideo(cfg, v.title ?? `uscreen ${extId}`);
      await uploadFile(cfg, guid, path.join(MEDIA_DIR, f));
      const s = await getVideo(cfg, guid);
      if (s.status === 5) throw new Error('bunny reports status 5 (failed) right after upload');
      await sb.from('videos').update({ bunny_video_id: guid }).eq('id', v.id);
      await setManifest(extId, 'fetched');
      console.log(`[${ts()}] ✓ ${extId} "${v.title}" → ${guid} (${(size / 1e6).toFixed(1)}MB)`);
      ok++;
    } catch (e: any) {
      if (guid) await deleteVideo(cfg, guid).catch(() => {});
      console.error(`[${ts()}] ✗ ${extId}: ${String(e.message).slice(0, 200)} (local file kept, manifest untouched)`);
      failed++;
    }
  }
  console.log(`[${ts()}] DONE: ${ok} uploaded, ${skipped} already migrated, ${failed} failed.`);
  if (EXECUTE && ok) console.log('Next: run migrate-videos.ts --poll (or let the VPS poll) until these show done, THEN delete the local files.');
  process.exit(failed ? 1 : 0);
}

main();
