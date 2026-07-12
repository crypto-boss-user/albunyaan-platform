/**
 * verify-playback-lockdown.ts — WS5 end-to-end proof, from OUTSIDE the app.
 *
 * Exercises the three public playback surfaces for a real migrated video:
 *   1. UNSIGNED iframe embed URL  (what any visitor could copy pre-lockdown)
 *   2. SIGNED  iframe embed URL   (what the app emits — token = SHA256_HEX(key+videoId+expires))
 *   3. DIRECT  CDN HLS playlist   (vz-….b-cdn.net/{guid}/playlist.m3u8)
 *
 * Run with MODE=pre  (default) BEFORE flipping the Bunny library: proves the
 *   URLs are the right ones by showing them all OPEN (baseline).
 * Run with MODE=post AFTER enabling Embed View Token Authentication + Block
 *   Direct URL Access: passes only if unsigned+direct are BLOCKED and the
 *   signed embed still loads — the actual lockdown acceptance test.
 *
 * Env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pick a real bunny_video_id),
 * NEXT_PUBLIC_BUNNY_LIBRARY_ID or BUNNY_LIBRARY_ID, BUNNY_CDN_HOST,
 * BUNNY_EMBED_TOKEN_KEY (required for MODE=post; signed check skipped without it).
 *
 * Run:  set -a; source ~/.albunyaan-cc/cloud.env; set +a; \
 *       MODE=post node_modules/.bin/tsx worker/verify-playback-lockdown.ts
 */
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const MODE = process.env.MODE === 'post' ? 'post' : 'pre';
const LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID;
const CDN_HOST = process.env.BUNNY_CDN_HOST;
const TOKEN_KEY = process.env.BUNNY_EMBED_TOKEN_KEY;

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

/** A playback surface is "open" if it answers 2xx AND the body looks like real content. */
async function probe(url: string): Promise<{ status: number; open: boolean; marker: string }> {
  const res = await fetch(url, { redirect: 'follow' });
  const body = await res.text();
  const blockedMarker = /(unauthorized|forbidden|token|expired|access denied|not allowed)/i.test(body.slice(0, 4000));
  // Embed pages answer 200 even when refusing playback — status alone is not truth.
  const looksLikeVideo = /playerConfig|video\.js|playlist\.m3u8|hls|#EXTM3U/i.test(body.slice(0, 20000));
  const open = res.ok && looksLikeVideo && !(!looksLikeVideo && blockedMarker);
  const marker = looksLikeVideo ? 'video-content' : blockedMarker ? 'blocked-marker' : 'neither';
  return { status: res.status, open, marker };
}

async function main(): Promise<void> {
  if (!LIBRARY_ID || !CDN_HOST) throw new Error('BUNNY_LIBRARY_ID / BUNNY_CDN_HOST missing from env');

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db
    .from('videos')
    .select('title, bunny_video_id')
    .eq('status', 'published')
    .not('bunny_video_id', 'is', null)
    .limit(1)
    .single();
  if (error) throw error;
  const guid = (data as { bunny_video_id: string }).bunny_video_id;
  console.log(`MODE=${MODE} · library ${LIBRARY_ID} · probing "${(data as { title: string }).title}" (${guid})\n`);

  const unsignedUrl = `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${guid}`;
  const directUrl = `https://${CDN_HOST}/${guid}/playlist.m3u8`;

  const unsigned = await probe(unsignedUrl);
  console.log(`unsigned embed → ${unsigned.status} (${unsigned.marker})`);
  const direct = await probe(directUrl);
  console.log(`direct HLS     → ${direct.status} (${direct.marker})`);

  let signed: { status: number; open: boolean; marker: string } | null = null;
  if (TOKEN_KEY) {
    const expires = Math.floor(Date.now() / 1000) + 600;
    const token = createHash('sha256').update(`${TOKEN_KEY}${guid}${expires}`).digest('hex');
    signed = await probe(`${unsignedUrl}?token=${token}&expires=${expires}`);
    console.log(`signed embed   → ${signed.status} (${signed.marker})`);
  } else {
    console.log(`signed embed   → SKIPPED (BUNNY_EMBED_TOKEN_KEY not in env)`);
  }
  console.log();

  if (MODE === 'pre') {
    check(unsigned.open, 'baseline: unsigned embed currently loads (URLs are the right ones)');
    // Direct play may already be off library-side (it was found 403 on 2026-07-12);
    // for baseline we only need proof the URL hits a real resource — 404 = wrong URL.
    check(direct.status !== 404, `baseline: direct HLS URL resolves (${direct.open ? 'OPEN — will need the flip' : 'already blocked'})`);
    if (signed) check(signed.open, 'baseline: signed embed loads too (extra params harmless pre-flip)');
  } else {
    check(!unsigned.open, 'LOCKDOWN: unsigned embed is refused');
    check(!direct.open, 'LOCKDOWN: direct HLS playlist is refused');
    if (!TOKEN_KEY) {
      failed += 1;
      console.error('  ✗ FAIL: MODE=post requires BUNNY_EMBED_TOKEN_KEY to prove signed playback still works');
    } else if (signed) {
      check(signed.open, 'LOCKDOWN: signed embed still loads (token formula matches the library)');
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
