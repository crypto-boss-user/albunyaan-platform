/**
 * Catalog queries — server-side only (service role, see ./client).
 * Row order comes from collections.raw->row_order, written by worker/seed-catalog.ts
 * from reference/real-site-ia.json (and later by the real importer).
 */
import { createServiceClient } from './client';
import type {
  CatalogRowData,
  CategoryRow,
  CollectionRow,
  EpisodeRow,
  VideoRow,
} from './rows';

export const LIVE_CATEGORY_SLUG = 'category-channels';

const VIDEO_COLS =
  'id, external_id, source, title, slug, short_description, description, thumbnail_url, thumbnail_hue, duration_seconds, status, access, age_rating';

interface ItemJoin {
  position: number;
  videos: VideoRow;
}

function toEpisodes(items: ItemJoin[] | null | undefined): EpisodeRow[] {
  return (items ?? [])
    .slice()
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
    }));

  return live ? [live, ...seriesRows] : seriesRows;
}

/** The "Channels Live 📡" row (category slug `category-channels`). */
export async function getLiveRow(): Promise<CatalogRowData | null> {
  const category = await getCategoryBySlug(LIVE_CATEGORY_SLUG);
  if (!category) return null;
  return {
    kind: 'live',
    key: category.slug,
    title: category.name,
    seeAllHref: `/categories/${category.slug}`,
    category,
    videos: category.videos,
  };
}

export interface CategoryWithVideos extends CategoryRow {
  videos: VideoRow[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithVideos | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('categories')
    .select(`id, external_id, source, name, slug, video_categories ( videos ( ${VIDEO_COLS} ) )`)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type Join = CategoryRow & { video_categories: { videos: VideoRow }[] };
  const row = data as unknown as Join;
  const videos = (row.video_categories ?? [])
    .map((j) => j.videos)
    .sort((a, b) => a.title.localeCompare(b.title));
  return { id: row.id, external_id: row.external_id, source: row.source, name: row.name, slug: row.slug, videos };
}

export async function getAllCategories(): Promise<CategoryRow[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('categories').select('id, external_id, source, name, slug').order('name');
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
