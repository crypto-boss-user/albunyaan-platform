/**
 * Catalog queries — server-side only (service role, see ./client).
 * Row order comes from collections.raw->row_order, written by worker/seed-catalog.ts
 * from reference/real-site-ia.json (and later by the real importer).
 */
import { createServiceClient } from './client';
import type {
  CatalogRowData,
  CategoryItemRow,
  CategoryRow,
  CollectionRow,
  EpisodeRow,
  SeriesCard,
  VideoRow,
} from './rows';

/**
 * Live-channel category slugs across environments (local seed vs the real
 * scraped catalog) — used only to dress the live row (title, See All target)
 * and to keep that category out of the series rails. The CHANNELS themselves
 * come from videos.status='live' (getLiveRow), so the row works even where
 * the category is missing or (as on prod) has no category-linked videos.
 */
export const LIVE_CATEGORY_SLUGS = ['category-channels', 'channels-live-128768'];

/** Catalog-safe video columns (no raw/private fields) — shared with search.ts. */
export const VIDEO_COLS =
  'id, external_id, source, title, slug, short_description, description, thumbnail_url, thumbnail_hue, duration_seconds, status, access, age_rating, bunny_video_id, resources';

/**
 * Interim public-visibility rule (WS1): only 'published' and 'live' videos are
 * exposed. 'draft'/'scheduled' stay hidden. The public data layer runs on the
 * service-role client (see ./client), which BYPASSES the migration-0006 RLS
 * `status in ('published','live')` policy — so every public read must re-apply
 * this filter in code, on top-level rows AND on embedded episode joins.
 * (Entitlement/signed playback is WS5b; this is the discovery-layer gate.)
 */
export const VISIBLE_STATUSES = ['published', 'live'] as const;

/** True when a (possibly partial) video row is publicly visible per VISIBLE_STATUSES. */
export function isVisibleVideo(v: { status?: string | null } | null | undefined): boolean {
  return !!v && (VISIBLE_STATUSES as readonly string[]).includes(v.status ?? '');
}

interface ItemJoin {
  position: number;
  videos: VideoRow;
}

function toEpisodes(items: ItemJoin[] | null | undefined): EpisodeRow[] {
  return (items ?? [])
    .filter((i) => isVisibleVideo(i.videos))
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ ...i.videos, position: i.position }));
}

/** All catalog rows in IA order: "Channels Live 📡" first, then the series rows. */
export async function getCatalogRows(): Promise<CatalogRowData[]> {
  const db = createServiceClient();

  const [live, collections] = await Promise.all([
    getLiveRow(),
    db
      .from('collections')
      .select(`id, external_id, source, title, slug, description, raw, collection_items ( position, videos ( ${VIDEO_COLS} ) )`)
      .order('slug'),
  ]);
  if (collections.error) throw collections.error;

  type CollJoin = CollectionRow & { collection_items: ItemJoin[] };
  const seriesRows: CatalogRowData[] = (collections.data as unknown as CollJoin[])
    .slice()
    .sort((a, b) => (a.raw?.row_order ?? 999) - (b.raw?.row_order ?? 999))
    .map((c) => ({
      kind: 'series' as const,
      key: c.slug,
      title: c.title,
      seeAllHref: `/programs/${c.slug}`,
      collection: c,
      videos: toEpisodes(c.collection_items),
    }))
    // Drop series with no publicly-visible episode (all draft/scheduled).
    .filter((r) => r.videos.length > 0);

  return live ? [live, ...seriesRows] : seriesRows;
}

/**
 * Category-organized catalog rows matching the real site: "Channels Live" first,
 * then each real category ("New on Albunyaan", "Anasheed", "Age 0-2"…) as a rail
 * of ~18 posters with See All → /categories/[slug]. Empty categories are dropped;
 * ordered by how much content each holds (biggest first). Far lighter than
 * getCatalogRows() (which pulls all 686 series × every episode).
 */
export async function getCategoryRows(perRow = 18): Promise<CatalogRowData[]> {
  const db = createServiceClient();
  const { data: cats, error } = await db
    .from('categories')
    .select('id, external_id, source, name, slug, raw, position');
  if (error) throw error;

  const rows = await Promise.all(
    (cats ?? []).filter((c: any) => !LIVE_CATEGORY_SLUGS.includes(c.slug)).map(async (c: any) => {
      // Each category holds SERIES (collections). Show series cards with the
      // English title the founder set in Uscreen + a poster from an episode.
      const collExtIds: string[] = c.raw?.collections ?? [];
      if (!collExtIds.length) return { c, series: [] as SeriesCard[] };
      const { data } = await db
        .from('collections')
        .select('external_id, title, slug, raw, collection_items ( position, videos ( status, thumbnail_url, thumbnail_hue ) )')
        .eq('source', 'uscreen')
        .in('external_id', collExtIds.slice(0, 60));
      const series: SeriesCard[] = ((data ?? []) as any[])
        .map((col) => {
          // Visible episodes only: draft covers/counts must never reach the rail.
          const items = (col.collection_items ?? [])
            .filter((i: any) => isVisibleVideo(i.videos))
            .sort((a: any, b: any) => a.position - b.position);
          const withPoster = items.find((i: any) => i.videos?.thumbnail_url) ?? items[0];
          // Prefer the series' OWN branded cover (matches the real site); fall back to an episode still.
          const cover = col.raw?.cover_url ?? withPoster?.videos?.thumbnail_url ?? null;
          return {
            title: col.title,
            slug: col.slug,
            thumbnail_url: cover,
            thumbnail_hue: withPoster?.videos?.thumbnail_hue ?? null,
            episodeCount: items.length,
          };
        })
        // Drop series that are entirely draft/scheduled.
        .filter((s) => s.episodeCount > 0);
      return { c, series };
    }),
  );

  const live = await getLiveRow();
  // ORDER FIDELITY (2026-08-06): rails follow Uscreen's own category order
  // (categories.position, 0013) — biggest-first only for legacy rows without it.
  const catRows: CatalogRowData[] = rows
    .filter((r) => r.series.length > 0)
    .sort((a, b) => ((a.c as any).position ?? 999) - ((b.c as any).position ?? 999) || b.series.length - a.series.length)
    .map((r) => ({
      kind: 'category' as const,
      key: r.c.slug,
      title: r.c.name,
      seeAllHref: `/categories/${r.c.slug}`,
      category: r.c as CategoryRow,
      series: r.series.slice(0, perRow),
    }));

  return live ? [live, ...catRows] : catRows;
}

/**
 * The "Channels Live 📡" row. Channels are the videos with status='live' —
 * NOT a category join: on the real catalog the live channels aren't
 * category-linked (and the live category's slug differs per environment), so
 * the category lookup only dresses the row when it exists.
 */
export async function getLiveRow(): Promise<CatalogRowData | null> {
  const db = createServiceClient();
  const [channels, cats] = await Promise.all([
    db.from('videos').select(VIDEO_COLS).eq('status', 'live').order('title'),
    db.from('categories').select('id, external_id, source, name, slug').in('slug', LIVE_CATEGORY_SLUGS),
  ]);
  if (channels.error) throw channels.error;
  if (cats.error) throw cats.error;
  const videos = (channels.data ?? []) as VideoRow[];
  if (videos.length === 0) return null;
  const category = ((cats.data ?? [])[0] ?? null) as CategoryRow | null;
  return {
    kind: 'live',
    key: category?.slug ?? 'channels-live',
    title: category?.name ?? 'Channels Live 📡',
    seeAllHref: category ? `/categories/${category.slug}` : null,
    category,
    videos,
  };
}

export interface CategoryWithVideos extends CategoryRow {
  videos: VideoRow[];
  /** Ordered MIXED contents (0013 category_items) — the faithful Uscreen order.
   *  Empty when the extras import hasn't run yet; `videos` is the fallback. */
  items: CategoryItemRow[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithVideos | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('categories')
    .select(
      `id, external_id, source, name, slug, position,
       category_items ( position, videos ( ${VIDEO_COLS} ), collections ( id, external_id, source, title, slug, description, raw, collection_items ( position, videos ( status, thumbnail_url ) ) ) ),
       video_categories ( videos ( ${VIDEO_COLS} ) )`,
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;

  // ORDER FIDELITY (2026-08-06): category contents keep the EXACT manual order
  // of the original platform via category_items.position — never re-sorted by
  // title/date/id. The alphabetical sort below survives ONLY as the fallback
  // for categories the extras import hasn't reached yet.
  const items: CategoryItemRow[] = (row.category_items ?? [])
    .map((it: any): CategoryItemRow | null => {
      if (it.videos) {
        return isVisibleVideo(it.videos) ? { kind: 'video', position: it.position, video: it.videos as VideoRow } : null;
      }
      if (it.collections) {
        const col = it.collections;
        const eps = (col.collection_items ?? []).filter((ci: any) => isVisibleVideo(ci.videos));
        if (!eps.length) return null; // fully-draft series never reach the grid
        const withPoster = eps.sort((a: any, b: any) => a.position - b.position).find((ci: any) => ci.videos?.thumbnail_url);
        return {
          kind: 'collection', position: it.position,
          collection: { ...col, episodeCount: eps.length, cover: col.raw?.cover_url ?? withPoster?.videos?.thumbnail_url ?? null },
        };
      }
      return null;
    })
    .filter((x: CategoryItemRow | null): x is CategoryItemRow => !!x)
    .sort((a: CategoryItemRow, b: CategoryItemRow) => a.position - b.position);

  const videos = (row.video_categories ?? [])
    .map((j: any) => j.videos)
    .filter(isVisibleVideo)
    .sort((a: VideoRow, b: VideoRow) => a.title.localeCompare(b.title)); // fallback only — see note above
  return { id: row.id, external_id: row.external_id, source: row.source, name: row.name, slug: row.slug, position: row.position ?? null, videos, items };
}

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = createServiceClient();
  // Uscreen site-nav order (0013 position), name as tiebreak/fallback.
  const { data, error } = await db
    .from('categories')
    .select('id, external_id, source, name, slug, position')
    .order('position', { ascending: true, nullsFirst: false })
    .order('name');
  if (error) throw error;
  return data as CategoryRow[];
}

export interface CollectionWithEpisodes extends CollectionRow {
  episodes: EpisodeRow[];
}

export async function getCollectionBySlug(slug: string): Promise<CollectionWithEpisodes | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('collections')
    .select(`id, external_id, source, title, slug, description, raw, collection_items ( position, videos ( ${VIDEO_COLS} ) )`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type Join = CollectionRow & { collection_items: ItemJoin[] };
  const row = data as unknown as Join;
  return { ...row, episodes: toEpisodes(row.collection_items) };
}

export interface VideoWithContext extends VideoRow {
  /** Collection this video belongs to (first membership), if any. */
  collection: (CollectionRow & { position: number }) | null;
}

export async function getVideoBySlug(slug: string): Promise<VideoWithContext | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('videos')
    .select(`${VIDEO_COLS}, collection_items ( position, collections ( id, external_id, source, title, slug, description, raw ) )`)
    .eq('slug', slug)
    // Draft/scheduled video pages must 404, not render (service role bypasses RLS 0006).
    .in('status', [...VISIBLE_STATUSES])
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type Join = VideoRow & { collection_items: { position: number; collections: CollectionRow }[] };
  const row = data as unknown as Join;
  const membership = row.collection_items?.[0] ?? null;
  const { collection_items: _drop, ...video } = row;
  return {
    ...(video as VideoRow),
    collection: membership ? { ...membership.collections, position: membership.position } : null,
  };
}

/** /programs/:slug covers both series (collections) and single videos, like the real site. */
export type Program =
  | { kind: 'series'; collection: CollectionWithEpisodes }
  | { kind: 'video'; video: VideoWithContext };

export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const collection = await getCollectionBySlug(slug);
  if (collection) return { kind: 'series', collection };
  const video = await getVideoBySlug(slug);
  if (video) return { kind: 'video', video };
  return null;
}

export interface VideoLite {
  id: string;
  title: string;
  slug: string;
  status: string;
}

/** Lightweight id/title lists for admin-ish UI (parents dashboard pickers). */
export async function listVideosLite(): Promise<VideoLite[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('videos').select('id, title, slug, status').order('title');
  if (error) throw error;
  return data as VideoLite[];
}

export async function listCollectionsLite(): Promise<{ id: string; title: string; slug: string }[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('collections').select('id, title, slug').order('title');
  if (error) throw error;
  return data as { id: string; title: string; slug: string }[];
}

export async function getCatalogCounts(): Promise<{ videos: number; collections: number; categories: number }> {
  const db = createServiceClient();
  const [v, c, k] = await Promise.all([
    db.from('videos').select('id', { count: 'exact', head: true }),
    db.from('collections').select('id', { count: 'exact', head: true }),
    db.from('categories').select('id', { count: 'exact', head: true }),
  ]);
  return { videos: v.count ?? 0, collections: c.count ?? 0, categories: k.count ?? 0 };
}
