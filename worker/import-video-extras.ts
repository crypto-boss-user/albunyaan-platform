/**
 * Import the harvested video EXTRAS into the DB (descriptions, resources,
 * complete category membership, ordered category contents, tags, subtitles),
 * fixing the four verified fidelity gaps of 2026-08-06:
 *
 *   1. All 15,861 videos had empty description/short_description/resources/
 *      subtitle_tracks (never scraped).
 *   2. Category membership was incomplete (e.g. "Albunyaan App" is in 2
 *      categories on Uscreen, 0 here; the Apps category holds 10+ direct
 *      videos, we had 4) and category DISPLAY ORDER was lost entirely
 *      (the site re-sorted alphabetically).
 *   3. 174 published standalone videos were reachable through nothing.
 *   4. Videos added on Uscreen after the July copy (≈122) were missing rows.
 *
 * Inputs (produced by harvest-video-extras.mjs, download-resources.mjs
 * --upload, scrape-category-order.mjs):
 *   ~/.albunyaan-cc/uscreen-video-details.jsonl
 *   ~/.albunyaan-cc/uscreen-resources-manifest.jsonl
 *   ~/.albunyaan-cc/uscreen-category-order.jsonl
 *   ~/.albunyaan-cc/uscreen-collection-status.jsonl   (existing; storefront slugs)
 *
 * Prereq: supabase/migrations/0013_structure_fidelity.sql applied.
 * Run (from worker/): ALBUNYAAN_DB_DRIVER=supabase node_modules/.bin/tsx import-video-extras.ts
 * Deterministic UUIDs (same scheme as import-uscreen-catalog.ts) → idempotent.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createDb, type DbRow } from './lib/db';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const SOURCE = 'uscreen';
const now = new Date().toISOString();

function uuidFor(name: string): string {
  const h = createHash('sha256').update(`albunyaan:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function hashNum(s: string): number { let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; }
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function readJsonl(f: string): any[] {
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const vid = (id: string) => uuidFor(`videos:uscreen:${id}`);
const cat = (id: string) => uuidFor(`categories:uscreen:${id}`);
const coll = (id: string) => uuidFor(`collections:uscreen:${id}`);

async function main() {
  const db = createDb({ driver: 'supabase' });
  const details = readJsonl(path.join(CC, 'uscreen-video-details.jsonl')).filter((d) => d.id && !d.error);
  const resources = readJsonl(path.join(CC, 'uscreen-resources-manifest.jsonl'));
  const catOrder = readJsonl(path.join(CC, 'uscreen-category-order.jsonl')).filter((c) => c.id && !c.error);
  const collStatus = readJsonl(path.join(CC, 'uscreen-collection-status.jsonl'));
  if (!details.length) throw new Error('uscreen-video-details.jsonl empty/missing — run harvest-video-extras.mjs first');
  console.log(`source: ${details.length} video details, ${resources.length} resources, ${catOrder.length} category orders`);

  const resourceById = new Map<string, any>(resources.map((r) => [String(r.id), r]));

  // permalink → entity maps, for resolving storefront category order
  const videoByPermalink = new Map<string, string>(); // permalink → video external_id
  for (const d of details) if (d.permalink) videoByPermalink.set(String(d.permalink), String(d.id));
  const collByPermalink = new Map<string, string>(); // permalink/slug → collection external_id
  for (const c of collStatus) {
    for (const key of [c.slug, c.permalink, c.seo_slug, c.storefront_slug]) {
      if (key) collByPermalink.set(String(key), String(c.id));
    }
  }
  // Aanvulling: opgeloste storefront-permalinks (resolve-collection-permalinks.mjs;
  // collection-status kent de "collection-…"-permalinks niet).
  for (const r of readJsonl(path.join(CC, 'uscreen-collection-permalinks.jsonl'))) {
    if (r.permalink && r.id) collByPermalink.set(String(r.permalink), String(r.id));
  }

  // Which external_ids already exist? (paginated — Supabase clamps at 1000
  // rows SILENTLY, the house's hardest-won lesson). Existing rows get an
  // extras-only column subset so curated titles, slugs (redirect maps!) and
  // the Variant-B status decisions are NEVER overwritten; only genuinely new
  // ids (the ≈122 post-copy uploads) get full rows.
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  // Niet alleen de ids maar ook de beschermde kolommen ophalen: een upsert
  // MOET title/slug/status meesturen (NOT NULL zonder default), dus voor
  // bestaande rijen schrijven we exact de huidige waarden ongewijzigd terug —
  // zo blijven curated titels/slugs/Variant-B-statussen gegarandeerd intact.
  const existing = new Map<string, { title: string; slug: string; status: string; access: string; thumbnail_hue: number | null }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('videos').select('external_id, title, slug, status, access, thumbnail_hue').eq('source', SOURCE).range(from, from + 999);
    if (error) throw new Error(`videos page read: ${error.message}`);
    for (const r of data ?? []) existing.set(String(r.external_id), r as any);
    if (!data || data.length < 1000) break;
  }
  console.log(`existing video rows: ${existing.size}`);

  // ── 1. video rows: extras for existing, full rows for new uploads ────────
  // Two separate arrays: PostgREST bulk upserts need uniform columns per call.
  const videoExtras: DbRow[] = [];
  const videoNew: DbRow[] = [];
  let newRows = 0;
  for (const d of details) {
    const attached = (d.file_resource_ids ?? [])
      .map((rid: number) => {
        const r = resourceById.get(String(rid));
        return r ? { id: String(rid), title: r.title, extension: r.extension, size: r.size, url: r.url ?? null } : { id: String(rid) };
      });
    const extras: DbRow = {
      id: vid(String(d.id)), source: SOURCE, external_id: String(d.id),
      description: d.description ?? '',
      short_description: d.short_description ?? '',
      tags: d.tags ?? [],
      uscreen_permalink: d.permalink ?? null,
      resources: attached,
      subtitle_tracks: d.subtitles ?? [],
      audio_tracks: d.audio_tracks ?? [],
      seo: { meta_title: d.meta_title ?? '', meta_description: d.meta_description ?? '' },
      updated_at: now,
    };
    if (!existing.has(String(d.id))) {
      newRows++;
      videoNew.push({
        ...extras,
        title: d.title ?? `(video ${d.id})`,
        slug: `${slugify(d.title ?? '') || 'video'}-${d.id}`,
        thumbnail_hue: hashNum(String(d.id)) % 360,
        status: d.published_at ? 'published' : 'draft',
        access: d.free ? 'free' : 'subscription',
        raw: { from: 'extras-harvest', duration: d.duration ?? null },
        created_at: now,
      });
    } else {
      const cur = existing.get(String(d.id))!;
      videoExtras.push({
        ...extras,
        title: cur.title, slug: cur.slug, status: cur.status, access: cur.access,
        thumbnail_hue: cur.thumbnail_hue,
      });
    }
  }
  console.log(`new video rows (post-copy uploads): ${newRows}`);

  // ── 2. complete category membership (video_categories, keyed table) ──────
  const videoCategories: DbRow[] = [];
  const vcSeen = new Set<string>();
  for (const d of details) {
    for (const cid of d.category_ids ?? []) {
      const k = `${cat(String(cid))}:${vid(String(d.id))}`;
      if (!vcSeen.has(k)) { vcSeen.add(k); videoCategories.push({ video_id: vid(String(d.id)), category_id: cat(String(cid)) }); }
    }
  }

  // ── 3. ordered, mixed category contents (category_items) ─────────────────
  const categoryRows: DbRow[] = [];
  const categoryItems: DbRow[] = [];
  let unresolved = 0;
  for (const c of catOrder) {
    categoryRows.push({
      id: cat(String(c.id)), source: SOURCE, external_id: String(c.id),
      name: c.title, slug: `${slugify(c.title) || 'category'}-${c.id}`,
      position: c.position ?? null, content_sort: c.content_sort ?? null,
      updated_at: now,
    });
    (c.items ?? []).forEach((permalink: string, i: number) => {
      const vext = videoByPermalink.get(permalink);
      const cext = vext ? null : collByPermalink.get(permalink);
      if (vext) {
        categoryItems.push({
          id: uuidFor(`cati:uscreen:${c.id}:video:${vext}`), source: SOURCE,
          external_id: `${c.id}:video:${vext}`, category_id: cat(String(c.id)),
          video_id: vid(vext), collection_id: null, position: i,
          raw: { permalink }, created_at: now, updated_at: now,
        });
      } else if (cext) {
        categoryItems.push({
          id: uuidFor(`cati:uscreen:${c.id}:collection:${cext}`), source: SOURCE,
          external_id: `${c.id}:collection:${cext}`, category_id: cat(String(c.id)),
          video_id: null, collection_id: coll(cext), position: i,
          raw: { permalink }, created_at: now, updated_at: now,
        });
      } else {
        unresolved++;
        console.log(`  unresolved permalink in "${String(c.title).slice(0, 30)}": ${permalink}`);
      }
    });
  }

  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const push = async (t: string, rows: DbRow[], conflict?: string[]) => {
    let d = 0;
    for (const c of chunk(rows, 500)) { await db.upsert(t, c, conflict); d += c.length; process.stdout.write(`\r  ${t}: ${d}/${rows.length}`); }
    console.log(`\r  ${t}: ${rows.length} done            `);
  };

  await push('videos', videoExtras);
  if (videoNew.length) await push('videos', videoNew);
  await push('categories', categoryRows);
  await push('category_items', categoryItems);
  if (videoCategories.length) await push('video_categories', videoCategories, ['video_id', 'category_id']);

  console.log('\nDONE:', {
    videos_updated: videoExtras.length,
    videos_new: videoNew.length,
    categories: categoryRows.length,
    category_items: categoryItems.length,
    video_categories: videoCategories.length,
    unresolved_order_permalinks: unresolved,
  });
  console.log('NOTE: unresolved permalinks are usually collections whose storefront slug');
  console.log('is missing from uscreen-collection-status.jsonl — check them by hand.');

  // Dekkingscontrole hoort BIJ de import: "klaar" betekent dat bron, database
  // en weergave gelijk tellen (founder-regel 2026-08-07).
  const { spawnSync } = await import('node:child_process');
  // pad robuust bepalen: dit script wordt zowel vanuit worker/ als vanuit de
  // repo-root gestart, en tsx kan zowel ESM- als CJS-semantiek geven.
  const checker = [
    path.join(process.cwd(), 'verify-coverage.mjs'),
    path.join(process.cwd(), 'worker/verify-coverage.mjs'),
  ].find((p) => fs.existsSync(p));
  if (checker) spawnSync(process.execPath, [checker, '--telegram'], { stdio: 'inherit' });
  else console.log('(dekkingscontrole niet gevonden — draai handmatig: node worker/verify-coverage.mjs)');
}
main().catch((e) => { console.error(e); process.exit(1); });
