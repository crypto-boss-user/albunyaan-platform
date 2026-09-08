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

/** Featured category (SR 2b F-preferences: "Featured category = New releases") — de band boven de catalogus, niet als rij. */
export const FEATURED_CATEGORY_SLUG = 'new-releases-125327';

/** Embedded select van een categorie-inhoud (0013 category_items, gemengd video/collectie) — gedeeld door
 *  getCategoryBySlug en getCategoryRows zodat de zichtbaarheidsregel maar één keer bestaat. */
const CATEGORY_ITEMS_SELECT = `category_items ( position, videos ( ${VIDEO_COLS} ), collections ( id, external_id, source, title, slug, description, raw, collection_items ( position, videos ( status, thumbnail_url ) ) ) )`;

/**
 * ORDER FIDELITY (2026-08-06): category contents keep the EXACT manual order of the original platform via
 * category_items.position — never re-sorted. Visible videos only; a fully-draft series never reaches a grid or rail
 * (fail-closed, WS1 discovery gate — B47: niet strippen).
 */
export function toCategoryItems(raw: any[] | null | undefined): CategoryItemRow[] {
  return (raw ?? [])
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
 * Catalog rows as the storefront shows them (SR 4 stap 9; SR 2a catalog__1440/390__en: 24 rijen = alle categorieën met
 * inhoud in Uscreen-volgorde, "Channels Live 📡" eerst, de featured categorie als band erboven): per categorie de
 * eerste `perRow` zichtbare items uit category_items (gemengd video/collectie, exacte handmatige volgorde — 0013).
 * Lege categorieën vallen weg zoals op de storefront; de live-rij blijft altijd staan (leeg = placeholder, B67).
 * Tellingscontrole (1000-rij-clamp, CLAUDE.md): het aantal embedded category_items moet gelijk zijn aan count=exact —
 * anders fail-closed (throw), nooit stil een halve rij.
 */
export async function getCategoryRows(perRow = 18): Promise<CatalogRowData[]> {
  const db = createServiceClient();
  const cats = await getAllCategories();
  const liveCat = cats.find((c) => LIVE_CATEGORY_SLUGS.includes(c.slug)) ?? null;

  const rows = await Promise.all(
    cats
      .filter((c) => !LIVE_CATEGORY_SLUGS.includes(c.slug) && c.slug !== FEATURED_CATEGORY_SLUG)
      .map(async (c) => {
        const [{ data, error }, telling] = await Promise.all([
          db.from('categories').select(CATEGORY_ITEMS_SELECT).eq('id', c.id).maybeSingle(),
          db.from('category_items').select('category_id', { count: 'exact', head: true }).eq('category_id', c.id),
        ]);
        if (error) throw error;
        if (telling.error) throw telling.error;
        const raw = ((data as any)?.category_items ?? []) as any[];
        if (raw.length !== (telling.count ?? 0)) {
          throw new Error(`category_items telling klopt niet voor ${c.slug}: embedded ${raw.length} ≠ count ${telling.count}`);
        }
        return { c, items: toCategoryItems(raw) };
      }),
  );

  const live: CatalogRowData = (await getLiveRow()) ?? {
    kind: 'live',
    key: liveCat?.slug ?? 'channels-live',
    title: liveCat?.name ?? 'Channels Live 📡',
    seeAllHref: liveCat ? `/categories/${liveCat.slug}` : null,
    category: liveCat,
    videos: [],
  };
  const catRows: CatalogRowData[] = rows
    .filter((r) => r.items.length > 0)
    .map((r) => ({
      kind: 'category' as const,
      key: r.c.slug,
      title: r.c.name,
      seeAllHref: `/categories/${r.c.slug}`,
      category: r.c,
      items: r.items.slice(0, perRow),
    }));
  return [live, ...catRows];
}

/** De featured band boven de catalogus: de zichtbare items van de featured categorie, in volgorde. */
export async function getFeaturedItems(): Promise<CategoryItemRow[]> {
  return (await getCategoryBySlug(FEATURED_CATEGORY_SLUG))?.items ?? [];
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
    .select(`id, external_id, source, name, slug, position, ${CATEGORY_ITEMS_SELECT}, video_categories ( videos ( ${VIDEO_COLS} ) )`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;

  const items = toCategoryItems(row.category_items);

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

/** Categorie-tags van een collectie (storefront-programmapagina: "Arabic for Kids · Age 0-2 · Age 2-4"), in categorie-volgorde. */
export async function getCategoriesForCollection(collectionId: string): Promise<CategoryRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('category_items')
    .select('categories ( id, external_id, source, name, slug, position )')
    .eq('collection_id', collectionId);
  if (error) throw error;
  const cats = ((data ?? []) as any[]).map((r) => r.categories as CategoryRow).filter(Boolean);
  return cats.sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name));
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
