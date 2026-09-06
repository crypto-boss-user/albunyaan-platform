/**
 * Admin video management — server-side only (service role). Unlike catalog.ts,
 * these reads are DELIBERATELY unfiltered by status: an admin must see draft/
 * scheduled videos to publish them. Never import this from a public page.
 *
 * AD 1.2 (2026-09-06): lijst en detail in de Uscreen-vorm (AD0-inventaris §2.1) — sortering, rijen per pagina, bulk publish/
 * unpublish, categorie-toewijzing via category_items, cover-URL (posters-bucket = het archief), SEO-velden, publish_at.
 */
import { createServiceClient } from './client';
import { logAdminAction } from './admins';
import type { VideoRow } from './rows';

const ADMIN_VIDEO_COLS =
  'id, external_id, source, title, slug, short_description, description, thumbnail_url, thumbnail_hue, duration_seconds, status, publish_at, access, age_rating, age_rating_source, bunny_video_id, seo, subtitle_tracks, audio_tracks, created_at, updated_at';

export interface AdminVideoRow extends VideoRow {
  age_rating_source: 'unrated' | 'human' | 'batch_classified';
  publish_at: string | null;
  /** Sleutels zoals de importeur ze schrijft (worker/import-video-extras.ts): meta_title / meta_description. */
  seo: { meta_title?: string; meta_description?: string; [k: string]: unknown } | null;
  subtitle_tracks: unknown[];
  audio_tracks: unknown[];
  created_at: string;
  updated_at: string;
}

export type AdminVideoSort = 'newest' | 'oldest' | 'title_asc' | 'title_desc';
export const ADMIN_VIDEO_SORTS: { key: AdminVideoSort; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'title_asc', label: 'Title A→Z' },
  { key: 'title_desc', label: 'Title Z→A' },
];

export interface AdminVideoListParams {
  q?: string;
  status?: VideoRow['status'];
  sort?: AdminVideoSort;
  page?: number; // 1-based
  perPage?: number;
}

export interface AdminVideoListResult {
  videos: AdminVideoRow[];
  total: number;
  page: number;
  perPage: number;
}

/** Paginated, searchable, sortable video list for the admin console (any status). */
export async function listVideosForAdmin(params: AdminVideoListParams = {}): Promise<AdminVideoListResult> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 30));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const db = createServiceClient();
  let query = db.from('videos').select(ADMIN_VIDEO_COLS, { count: 'exact' });
  if (params.status) query = query.eq('status', params.status);
  if (params.q?.trim()) {
    const pattern = `%${params.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.ilike('title', pattern);
  }
  switch (params.sort ?? 'newest') {
    case 'oldest': query = query.order('created_at', { ascending: true }); break;
    case 'title_asc': query = query.order('title', { ascending: true }); break;
    case 'title_desc': query = query.order('title', { ascending: false }); break;
    default: query = query.order('created_at', { ascending: false });
  }
  const { data, error, count } = await query.order('id').range(from, to);
  if (error) throw error;
  return { videos: (data ?? []) as AdminVideoRow[], total: count ?? 0, page, perPage };
}

export async function getVideoForAdmin(id: string): Promise<AdminVideoRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from('videos').select(ADMIN_VIDEO_COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminVideoRow | null;
}

export interface VideoAdminPatch {
  title?: string;
  short_description?: string;
  description?: string;
  thumbnail_url?: string | null;
  status?: VideoRow['status'];
  publish_at?: string | null;
  access?: VideoRow['access'];
  age_rating?: VideoRow['age_rating'];
  seo?: { meta_title?: string; meta_description?: string };
}

/**
 * Apply an admin edit + audit it. Setting age_rating also stamps
 * age_rating_source='human' (0007) — this is how a batch-classified or
 * unrated video becomes provenance-tracked as reviewed.
 */
export async function updateVideoAdmin(id: string, patch: VideoAdminPatch, actorAuthUserId: string): Promise<AdminVideoRow> {
  const before = await getVideoForAdmin(id);
  if (!before) throw new Error(`updateVideoAdmin: video ${id} not found`);

  const db = createServiceClient();
  const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.age_rating) row.age_rating_source = 'human';
  if (patch.seo) row.seo = { ...(before.seo ?? {}), ...patch.seo }; // merge: andere seo-sleutels uit de import blijven staan (koude review I-1)

  const { data, error } = await db.from('videos').update(row).eq('id', id).select(ADMIN_VIDEO_COLS).single();
  if (error) throw new Error(`updateVideoAdmin: ${error.message}`);

  await logAdminAction({
    actorAuthUserId,
    action: 'video.update',
    entity: 'videos',
    entityId: id,
    before,
    after: data,
  });
  return data as AdminVideoRow;
}

/** Bulk publish/unpublish from the list (Uscreen bulk action). Only rows that actually change are written and audited. */
export async function bulkSetVideoStatus(ids: string[], status: 'published' | 'draft', actorAuthUserId: string): Promise<number> {
  const unique = Array.from(new Set(ids)).filter(Boolean).slice(0, 100);
  if (unique.length === 0) return 0;
  const db = createServiceClient();
  const { data: before, error: readErr } = await db.from('videos').select('id, status').in('id', unique);
  if (readErr) throw new Error(`bulkSetVideoStatus: ${readErr.message}`);
  const targets = (before ?? []).filter((v) => v.status !== status).map((v) => v.id);
  if (targets.length === 0) return 0;
  const { error } = await db.from('videos').update({ status, updated_at: new Date().toISOString() }).in('id', targets);
  if (error) throw new Error(`bulkSetVideoStatus: ${error.message}`);
  // entityId kort houden: de btree-index (entity, entity_id) weigert lange sleutels; de ids staan in het jsonb (koude review I-2)
  await logAdminAction({ actorAuthUserId, action: 'video.bulk_status', entity: 'videos', entityId: `bulk:${targets.length}`, before: { count: targets.length }, after: { status, ids: targets } });
  return targets.length;
}

/** Categories a video is DIRECTLY placed in (category_items.video_id — Uscreen "Organize › Categories"). */
export async function getVideoCategoryIds(videoId: string): Promise<string[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('category_items').select('category_id').eq('video_id', videoId);
  if (error) throw error;
  return (data ?? []).map((r) => r.category_id as string);
}

/**
 * Replace a video's direct category placements. New placements go to the TOP of the category (Uscreen: "New content will be
 * added to the top of the list") = min(position) − 1; removed placements are deleted. Audited with before/after ids.
 */
export async function setVideoCategories(videoId: string, categoryIds: string[], actorAuthUserId: string): Promise<{ added: number; removed: number }> {
  const db = createServiceClient();
  const video = await getVideoForAdmin(videoId);
  if (!video) throw new Error(`setVideoCategories: video ${videoId} not found`);
  const wanted = new Set(categoryIds);
  const current = new Set(await getVideoCategoryIds(videoId));
  const toAdd = [...wanted].filter((c) => !current.has(c));
  const toRemove = [...current].filter((c) => !wanted.has(c));

  for (const categoryId of toAdd) {
    const { data: cat, error: catErr } = await db.from('categories').select('external_id').eq('id', categoryId).maybeSingle();
    if (catErr || !cat) throw new Error(`setVideoCategories: category ${categoryId} not found`);
    const { data: top, error: topErr } = await db.from('category_items').select('position').eq('category_id', categoryId).order('position', { ascending: true }).limit(1);
    if (topErr) throw new Error(`setVideoCategories: ${topErr.message}`);
    const position = top && top.length ? (top[0].position as number) - 1 : 0;
    const { error } = await db.from('category_items').insert({
      external_id: `${cat.external_id}:video:${video.external_id}`,
      source: video.source,
      category_id: categoryId,
      video_id: videoId,
      position,
    });
    if (error) throw new Error(`setVideoCategories: ${error.message}`);
  }
  if (toRemove.length) {
    const { error } = await db.from('category_items').delete().eq('video_id', videoId).in('category_id', toRemove);
    if (error) throw new Error(`setVideoCategories: ${error.message}`);
  }
  if (toAdd.length || toRemove.length) {
    await logAdminAction({ actorAuthUserId, action: 'video.categories', entity: 'videos', entityId: videoId, before: { categoryIds: [...current] }, after: { categoryIds: [...wanted] } });
  }
  return { added: toAdd.length, removed: toRemove.length };
}
