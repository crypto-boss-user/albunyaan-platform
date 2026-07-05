/**
 * seed-catalog.ts — populate the LOCAL Supabase with a shadow of the real
 * albunyaan.tv catalog, from reference/real-site-ia.json.
 *
 *   pnpm --filter @albunyaan/worker seed-catalog
 *
 * Goes through the SAME upsert path as the real importers (lib/db.ts, upsert on
 * (source, external_id)), with source='uscreen-shadow' — so the real Uscreen
 * export later lands in the same tables and replaces this seamlessly (the
 * source column distinguishes shadow rows; delete where source='uscreen-shadow').
 *
 * Idempotent: deterministic UUIDs derived from external_ids; reruns upsert.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './lib/db';

// ── env ──────────────────────────────────────────────────────────────────────

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(workerDir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SOURCE = 'uscreen-shadow';
const SEEDED_FROM = 'reference/real-site-ia.json';

// ── deterministic helpers ────────────────────────────────────────────────────

/** Deterministic UUIDv4-shaped id from a stable name (idempotent reruns). */
function uuidFor(name: string): string {
  const h = createHash('sha256').update(`albunyaan:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function hashNum(s: string): number {
  let n = 0;
  for (const c of s) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

/** "Mazen & Tha3loob | (AR)" → "mazen-tha3loob" */
function slugify(title: string): string {
  return title
    .replace(/\|.*$/, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const now = () => new Date().toISOString();

// ── IA reference ─────────────────────────────────────────────────────────────

const ia = JSON.parse(
  fs.readFileSync(path.join(workerDir, '..', 'reference', 'real-site-ia.json'), 'utf8'),
) as {
  catalogRows: string[];
  liveCategory: { title: string; slug: string; channels: string[] };
};

/** Series whose subject matter reads older than pure-toddler content. */
const SEVEN_PLUS = new Set(['the-narrator', 'men-around-the-messenger', 'ibn-maged']);

// ── build rows ───────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const collections: Row[] = [];
const videos: Row[] = [];
const collectionItems: Row[] = [];
const categories: Row[] = [];
const videoCategories: Row[] = [];

// 15 series → collections + 6–10 episodes each
ia.catalogRows.forEach((title, i) => {
  const slug = slugify(title);
  const clean = title.replace(/\s*\|.*$/, '');
  const collectionId = uuidFor(`collections:shadow:${slug}`);
  const baseHue = (i * 24 + 80) % 360;
  const ageRating = SEVEN_PLUS.has(slug) ? '7+' : 'all';

  collections.push({
    id: collectionId,
    external_id: `shadow:${slug}`,
    source: SOURCE,
    raw: { seeded_from: SEEDED_FROM, row_order: i, ia_title: title },
    title,
    slug,
    description: `${clean} — an Arabic-language kids' series from the Albunyaan library. Curated episode by episode to be free of music and unsafe scenes, safe for the whole family.`,
    updated_at: now(),
  });

  const episodeCount = 6 + (hashNum(slug) % 5); // 6–10, deterministic
  for (let n = 1; n <= episodeCount; n++) {
    const epSlug = `${slug}-episode-${n}`;
    const videoId = uuidFor(`videos:shadow:${epSlug}`);
    videos.push({
      id: videoId,
      external_id: `shadow:${epSlug}`,
      source: SOURCE,
      raw: { seeded_from: SEEDED_FROM, series: slug, episode: n },
      title: `${clean} — Episode ${n} (AR)`,
      slug: epSlug,
      short_description: `Episode ${n} of ${clean} — safe Arabic-language viewing for children.`,
      description: `<p>Episode ${n} of <strong>${clean}</strong>. Part of the Albunyaan kids' library: no music, no unsafe scenes, reviewed before publishing.</p>`,
      thumbnail_hue: (baseHue + n * 6) % 360,
      duration_seconds: 480 + ((hashNum(epSlug) + n * 97) % 1021),
      status: 'published',
      access: 'subscription',
      age_rating: ageRating,
      updated_at: now(),
    });
    collectionItems.push({
      id: uuidFor(`collection_items:shadow:${slug}:${epSlug}`),
      external_id: `shadow:${slug}:${epSlug}`,
      source: SOURCE,
      raw: { seeded_from: SEEDED_FROM },
      collection_id: collectionId,
      video_id: videoId,
      position: n,
      updated_at: now(),
    });
  }
});

// Live channels category + 21 live "videos"
const liveCategoryId = uuidFor(`categories:shadow:${ia.liveCategory.slug}`);
categories.push({
  id: liveCategoryId,
  external_id: `shadow:${ia.liveCategory.slug}`,
  source: SOURCE,
  raw: { seeded_from: SEEDED_FROM, ia_title: ia.liveCategory.title },
  name: ia.liveCategory.title, // "Channels Live 📡"
  slug: ia.liveCategory.slug, // "category-channels"
  updated_at: now(),
});

ia.liveCategory.channels.forEach((channel, i) => {
  const slug = slugify(channel);
  const videoId = uuidFor(`videos:shadow:${slug}`);
  videos.push({
    id: videoId,
    external_id: `shadow:${slug}`,
    source: SOURCE,
    raw: { seeded_from: SEEDED_FROM, live_channel: true },
    title: channel,
    slug,
    short_description: `${channel.replace(/\s*\|.*$/, '')} — streaming live, 24/7.`,
    description: `<p><strong>${channel.replace(/\s*\|.*$/, '')}</strong> — a curated live TV channel, rebroadcast around the clock.</p>`,
    thumbnail_hue: (i * 17 + 200) % 360,
    duration_seconds: null,
    status: 'live',
    access: 'free',
    age_rating: 'all',
    updated_at: now(),
  });
  videoCategories.push({ video_id: videoId, category_id: liveCategoryId });
});

// A browsable "Kids Series" category holding every episode
const kidsCategoryId = uuidFor('categories:shadow:kids-series');
categories.push({
  id: kidsCategoryId,
  external_id: 'shadow:kids-series',
  source: SOURCE,
  raw: { seeded_from: SEEDED_FROM },
  name: 'Kids Series',
  slug: 'kids-series',
  updated_at: now(),
});
for (const v of videos) {
  if ((v.raw as { live_channel?: boolean }).live_channel) continue;
  videoCategories.push({ video_id: v.id, category_id: kidsCategoryId });
}

// Demo household + profiles + one seeded parental block (parity with v0 demo)
const householdId = uuidFor('households:demo');
const profileRows: Row[] = [
  { id: uuidFor('profiles:demo:abu-yusuf'), household_id: householdId, kind: 'adult', name: 'Abu Yusuf', age_band: null, avatar_hue: 140, daily_limit_minutes: null, updated_at: now() },
  { id: uuidFor('profiles:demo:yusuf'), household_id: householdId, kind: 'kid', name: 'Yusuf', age_band: '7-9', avatar_hue: 95, daily_limit_minutes: 60, updated_at: now() },
  { id: uuidFor('profiles:demo:maryam'), household_id: householdId, kind: 'kid', name: 'Maryam', age_band: '4-6', avatar_hue: 45, daily_limit_minutes: 45, updated_at: now() },
];
const overrideRows: Row[] = [
  {
    id: uuidFor('content_overrides:demo:yusuf:the-narrator-episode-1'),
    profile_id: uuidFor('profiles:demo:yusuf'),
    target_kind: 'video',
    target_id: uuidFor('videos:shadow:the-narrator-episode-1'),
    action: 'block',
    updated_at: now(),
  },
];

// ── run ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = createDb({ driver: 'supabase' });

  await db.upsert('categories', categories);
  await db.upsert('collections', collections);
  await db.upsert('videos', videos);
  await db.upsert('collection_items', collectionItems);
  await db.upsert('video_categories', videoCategories, ['video_id', 'category_id']);
  await db.upsert('households', [
    {
      id: householdId,
      name: 'Demo household',
      pin_hash: createHash('sha256').update('1234').digest('hex'),
      updated_at: now(),
    },
  ], ['id']);
  await db.upsert('profiles', profileRows, ['id']);
  await db.upsert('content_overrides', overrideRows, ['id']);
  await db.flush();

  const counts: Record<string, number> = {};
  for (const t of ['videos', 'categories', 'collections', 'collection_items', 'video_categories', 'households', 'profiles', 'content_overrides']) {
    counts[t] = await db.count(t);
  }
  console.log('Seed complete (source=uscreen-shadow). Row counts in DB:');
  for (const [t, c] of Object.entries(counts)) console.log(`  ${t.padEnd(18)} ${c}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
