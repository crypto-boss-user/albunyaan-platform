/**
 * Admin video management — server-side only (service role). Unlike catalog.ts,
 * these reads are DELIBERATELY unfiltered by status: an admin must see draft/
 * scheduled videos to publish them. Never import this from a public page.
 */
import { createServiceClient } from './client';
import { logAdminAction } from './admins';
import type { VideoRow } from './rows';

const ADMIN_VIDEO_COLS =
  'id, external_id, source, title, slug, short_description, description, thumbnail_url, thumbnail_hue, duration_seconds, status, access, age_rating, age_rating_source, bunny_video_id, updated_at';

export interface AdminVideoRow extends VideoRow {
  age_rating_source: 'unrated' | 'human' | 'batch_classified';
  updated_at: string;
}

export interface AdminVideoListParams {
  q?: string;
  status?: VideoRow['status'];
  page?: number; // 1-based
  perPage?: number;
}

export interface AdminVideoListResult {
  videos: AdminVideoRow[];
  total: number;
  page: number;
  perPage: number;
}

/** Paginated, searchable video list for the admin console (any status). */
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
  const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, to);
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
  status?: VideoRow['status'];
  access?: VideoRow['access'];
  age_rating?: VideoRow['age_rating'];
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
