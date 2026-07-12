/**
 * Builds an old-Uscreen-URL -> new-platform-URL redirect map for cutover.
 *
 * The old site's `/programs/:slug` URLs cover TWO different content types
 * that both need their own lookup:
 *   - series/collections: `/programs/:oldslug/collection_homepage?...`
 *     returns `data-program-id="1692483"` -> matches
 *     `collections.raw->>uscreen_id` -> new URL `/programs/:newslug`.
 *   - standalone videos (this partial 302s for them instead of 200):
 *     `/programs/:oldslug/program_content?...` returns the same
 *     `data-program-id="..."` attribute -> matches `videos.external_id`
 *     -> new URL `/watch/:newslug`.
 * Both are plain unauthenticated GETs against small Turbo-Stream partials,
 * not the full SPA page.
 *
 * Read-only against both the live old site (plain content pages, not stream
 * URLs — unrelated to the IPTV single-login risk) and our own DB. Writes a
 * JSON report only; does NOT touch next.config.ts or deploy anything. This
 * is meant to be re-run fresh right before actual cutover (the old site
 * keeps changing until then) — treat any report from today as a proof of
 * mechanism, not a final map.
 *
 * Run: node build-redirect-map.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OLD_ORIGIN = 'https://albunyaan.tv';
const CONCURRENCY = 6;
const DELAY_MS = 150; // be a polite guest on someone else's live site

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (redirect-map builder; read-only)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function oldProgramSlugs() {
  const xml = await fetchText(`${OLD_ORIGIN}/sitemap.xml`);
  const slugs = [...xml.matchAll(/<loc>https:\/\/albunyaan\.tv\/programs\/([a-zA-Z0-9_-]+)<\/loc>/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

async function fetchStatusAndText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (redirect-map builder; read-only)' } });
  return { status: res.status, text: res.ok ? await res.text() : '' };
}

/** Returns { kind: 'collection'|'video', programId } or null if neither partial yields an id. */
async function resolveOldSlug(oldSlug) {
  const collection = await fetchStatusAndText(`${OLD_ORIGIN}/programs/${oldSlug}/collection_homepage?playlist_position=sidebar&preview=false`);
  if (collection.status === 200) {
    const m = collection.text.match(/data-program-id="(\d+)"/);
    if (m) return { kind: 'collection', programId: m[1] };
  }
  await sleep(DELAY_MS);
  const video = await fetchStatusAndText(`${OLD_ORIGIN}/programs/${oldSlug}/program_content?playlist_position=sidebar&preview=false`);
  if (video.status === 200) {
    const m = video.text.match(/data-program-id="(\d+)"/);
    if (m) return { kind: 'video', programId: m[1] };
  }
  return null;
}

/** Runs `worker(item)` over `items` with bounded concurrency, returns results in input order. */
async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e.message };
      }
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
  return results;
}

async function main() {
  console.log('Fetching old sitemap.xml...');
  const oldSlugs = await oldProgramSlugs();
  console.log(`  ${oldSlugs.length} program URLs in the old sitemap`);

  console.log('Fetching collections + videos tables (new platform)...');
  // PostgREST clamps any single response to 1000 rows regardless of .limit() —
  // videos has 15k+ rows, so this MUST paginate or silently truncate (same
  // gotcha backup-catalog.py works around).
  async function fetchAllRows(table, columns) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }
  const [collections, videos] = await Promise.all([
    fetchAllRows('collections', 'id, slug, title, raw'),
    fetchAllRows('videos', 'id, slug, title, external_id'),
  ]);
  const collectionsByUscreenId = new Map(collections.map((c) => [String(c.raw?.uscreen_id ?? ''), c]));
  const videosByExternalId = new Map(videos.map((v) => [String(v.external_id ?? ''), v]));
  console.log(`  ${collections.length} collections, ${videos.length} videos`);

  console.log(`Resolving old-slug -> program-id for ${oldSlugs.length} pages (concurrency ${CONCURRENCY}, 2 requests/slug)...`);
  const results = await pool(oldSlugs, async (oldSlug) => ({ oldSlug, resolved: await resolveOldSlug(oldSlug) }));

  const matched = [];
  const unmatchedNoId = [];
  const unmatchedNoDbRow = [];
  results.forEach((r, i) => {
    const oldSlug = oldSlugs[i];
    if (!r.ok) { unmatchedNoId.push({ oldSlug, error: r.error }); return; }
    const { resolved } = r.value;
    if (!resolved) { unmatchedNoId.push({ oldSlug, error: 'no data-program-id in either partial' }); return; }
    const { kind, programId } = resolved;
    const row = kind === 'collection' ? collectionsByUscreenId.get(programId) : videosByExternalId.get(programId);
    if (!row) { unmatchedNoDbRow.push({ oldSlug, kind, programId }); return; }
    // /programs/:slug handles BOTH series and single videos on the new platform
    // (getProgramBySlug checks collections then falls back to videos) — same
    // top-level path either way, just a different slug namespace.
    matched.push({ oldPath: `/programs/${oldSlug}`, newPath: `/programs/${row.slug}`, kind, programId, title: row.title });
  });

  const report = {
    generatedAt: new Date().toISOString(),
    totals: { oldSlugsInSitemap: oldSlugs.length, matched: matched.length, unmatchedNoId: unmatchedNoId.length, unmatchedNoDbRow: unmatchedNoDbRow.length },
    matched,
    unmatchedNoId,
    unmatchedNoDbRow,
  };

  const outPath = path.join(os.homedir(), '.albunyaan-cc/redirect-map-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nmatched: ${matched.length} / ${oldSlugs.length}`);
  console.log(`unmatched (no program id found on old page): ${unmatchedNoId.length}`);
  console.log(`unmatched (id found but no DB row): ${unmatchedNoDbRow.length}`);
  console.log(`report -> ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
