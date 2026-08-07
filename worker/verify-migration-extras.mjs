/**
 * READ-ONLY verification of the fidelity items reported 2026-08-06:
 * order, quality, descriptions, resources, subtitles, comments, reachability.
 * Prints a plain-language summary; writes nothing anywhere.
 *
 * Run (from worker/, env loaded from ~/.albunyaan-cc/cloud.env):
 *   node verify-migration-extras.mjs
 * Bunny checks are skipped automatically when BUNNY_API_KEY is absent.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function count(table, mod = (q) => q) {
  const { count: c, error } = await mod(sb.from(table).select('id', { count: 'exact', head: true }));
  if (error) return `ERR ${error.message.slice(0, 60)}`;
  return c ?? 0;
}
/** Paginated id-set fetch — Supabase clamps every page at 1000 rows, silently. */
async function idSet(table, col, mod = (q) => q) {
  const out = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await mod(sb.from(table).select(col)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const r of data ?? []) out.add(r[col]);
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  console.log('— Verificatie extra migratie-onderdelen (alleen-lezen) —\n');
  const total = await count('videos', (q) => q.eq('source', 'uscreen'));
  console.log(`videos (uscreen):                    ${total}`);
  console.log(`  met beschrijving:                  ${await count('videos', (q) => q.eq('source', 'uscreen').neq('description', ''))}`);
  console.log(`  met korte beschrijving:            ${await count('videos', (q) => q.eq('source', 'uscreen').neq('short_description', ''))}`);
  console.log(`  met bijlagen (resources):          ${await count('videos', (q) => q.eq('source', 'uscreen').neq('resources', '[]'))}`);
  console.log(`  met ondertitels (metadata):        ${await count('videos', (q) => q.eq('source', 'uscreen').neq('subtitle_tracks', '[]'))}`);
  console.log(`  met tags/zoekwoorden:              ${await count('videos', (q) => q.eq('source', 'uscreen').neq('tags', '[]'))}`);
  console.log(`  met uscreen_permalink:             ${await count('videos', (q) => q.eq('source', 'uscreen').not('uscreen_permalink', 'is', null))}`);

  console.log(`\ncategorie-structuur:`);
  console.log(`  categorieën met positie:           ${await count('categories', (q) => q.not('position', 'is', null))}`);
  console.log(`  geordende categorie-items:         ${await count('category_items')}`);
  console.log(`  comments (ta3lieqaat):             ${await count('video_comments')}`);

  // Reachability: published standalone videos hanging in nothing.
  const pub = await idSet('videos', 'id', (q) => q.eq('source', 'uscreen').eq('status', 'published'));
  const inColl = await idSet('collection_items', 'video_id');
  const inCat = await idSet('video_categories', 'video_id');
  const inCatItems = await idSet('category_items', 'video_id', (q) => q.not('video_id', 'is', null));
  const orphans = [...pub].filter((id) => !inColl.has(id) && !inCat.has(id) && !inCatItems.has(id));
  console.log(`\nbereikbaarheid:`);
  console.log(`  gepubliceerde losse video's die NERGENS in hangen: ${orphans.length} (was 174 op 2026-08-06)`);

  // Quality: stored vs original heights.
  console.log(`\nkwaliteit (hoogte opgeslagen kopie vs origineel):`);
  const withBoth = await count('videos', (q) => q.eq('source', 'uscreen').not('original_max_height', 'is', null).not('bunny_height', 'is', null));
  console.log(`  video's met beide waardes bekend:  ${withBoth}`);
  let downgraded = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('videos').select('original_max_height,bunny_height')
      .eq('source', 'uscreen').not('original_max_height', 'is', null).not('bunny_height', 'is', null)
      .range(from, from + 999);
    for (const r of data ?? []) if ((r.bunny_height ?? 0) < (r.original_max_height ?? 0)) downgraded++;
    if (!data || data.length < 1000) break;
  }
  console.log(`  daarvan nog steeds LAGER dan origineel: ${downgraded}  ← moet naar 0 via requality-videos.ts`);

  // Requality progress from the manifest.
  const counts = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('export_manifest').select('status').eq('entity', 'video_requality').range(from, from + 999);
    for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (!data || data.length < 1000) break;
  }
  console.log(`\nrequality-voortgang (manifest):      ${JSON.stringify(counts)}`);
  console.log('\nLet op: dit rapport bewijst DEKKING in de database, niet dat elk bestand');
  console.log('inhoudelijk klopt — de bestaande audit-migration.mjs (duurcontrole) blijft de');
  console.log('controle op half overgezette bestanden.');
}
main().catch((e) => { console.error(e); process.exit(1); });
