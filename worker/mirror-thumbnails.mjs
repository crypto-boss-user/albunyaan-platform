/**
 * Mirror Uscreen poster images into our OWN Supabase Storage so the catalog
 * owns them (they die when we leave Uscreen). Downloads each alpha.uscreencdn
 * thumbnail, uploads to the `posters` bucket, and rewrites videos.thumbnail_url
 * to the owned public URL. Idempotent: skips already-mirrored (url on our host).
 *
 * Session-independent (reads the CDN over plain HTTP). Rate-limited.
 * Run: node mirror-thumbnails.mjs   (env from ~/.albunyaan-cc/cloud.env)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'posters';
const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } });

async function ensureBucket() {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) await sb.storage.createBucket(BUCKET, { public: true });
}

async function main() {
  await ensureBucket();
  const pageSize = 1000;
  let from = 0, mirrored = 0, skipped = 0, failed = 0;
  for (;;) {
    const { data: vids, error } = await sb
      .from('videos')
      .select('id, external_id, thumbnail_url')
      .not('thumbnail_url', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!vids.length) break;
    for (const v of vids) {
      if (!v.thumbnail_url || v.thumbnail_url.includes(new URL(SB_URL).host)) { skipped++; continue; }
      try {
        const res = await fetch(v.thumbnail_url);
        if (!res.ok) { failed++; continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = (v.thumbnail_url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg').toLowerCase();
        const key = `v/${v.external_id}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(key, buf, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true,
        });
        if (up.error) { failed++; continue; }
        const pub = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
        await sb.from('videos').update({ thumbnail_url: pub }).eq('id', v.id);
        mirrored++;
        if (mirrored % 50 === 0) process.stdout.write(`\r  mirrored ${mirrored} | skipped ${skipped} | failed ${failed}`);
      } catch { failed++; }
      await new Promise((r) => setTimeout(r, 120)); // gentle
    }
    from += pageSize;
  }
  console.log(`\nMIRROR_DONE mirrored=${mirrored} skipped=${skipped} failed=${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
