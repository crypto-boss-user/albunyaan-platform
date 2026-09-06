'use server';

import { revalidatePath } from 'next/cache';
import { bulkSetVideoStatus, setVideoCategories, setVideoFilterValues, updateVideoAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { UUID_RE } from '../../../lib/admin-form';

/** One-click publish/unpublish toggle from the list (rijmenu ⋯) — editor role and up. */
export async function toggleVideoStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const nextStatus = String(formData.get('nextStatus') ?? '');
  if (!id || (nextStatus !== 'published' && nextStatus !== 'draft')) return;
  await updateVideoAdmin(id, { status: nextStatus }, user.id);
  revalidatePath('/admin/videos');
  revalidatePath(`/admin/videos/${id}`);
}

/** Bulk publish/unpublish of the selected rows (Uscreen bulk action) — editor role and up. */
export async function bulkVideoStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const nextStatus = String(formData.get('nextStatus') ?? '');
  if (nextStatus !== 'published' && nextStatus !== 'draft') return;
  const ids = formData.getAll('ids').map(String).filter((s) => UUID_RE.test(s));
  if (ids.length === 0) return;
  await bulkSetVideoStatus(ids, nextStatus, user.id);
  revalidatePath('/admin/videos');
}

export interface VideoEditState {
  error: string | null;
  saved: boolean;
}

/** Full edit form on the video detail page (Uscreen-velden, AD 1.2) — editor role and up. */
export async function updateVideoAction(_prev: VideoEditState, formData: FormData): Promise<VideoEditState> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Missing video id.', saved: false };

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: 'Title cannot be empty.', saved: false };
  const shortDescription = String(formData.get('short_description') ?? '').slice(0, 140);

  const status = String(formData.get('status') ?? '');
  const access = String(formData.get('access') ?? '');
  const ageRating = String(formData.get('age_rating') ?? '');
  if (!['draft', 'published', 'scheduled', 'live'].includes(status)) return { error: 'Invalid visibility.', saved: false };
  if (!['free', 'subscription'].includes(access)) return { error: 'Invalid access.', saved: false };
  if (!['all', '7+', '13+', '16+'].includes(ageRating)) return { error: 'Invalid age rating.', saved: false };

  const publishAtRaw = String(formData.get('publish_at') ?? '').trim();
  let publishAt: string | null = null;
  if (status === 'scheduled') {
    // datetime-local zonder zone → als UTC lezen (het formulier toont UTC; koude review M-1)
    const d = publishAtRaw ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(publishAtRaw) ? publishAtRaw : `${publishAtRaw}:00Z`) : null;
    if (!d || Number.isNaN(d.getTime())) return { error: 'Scheduled needs a valid date and time.', saved: false };
    publishAt = d.toISOString();
  }

  const thumbnailRaw = String(formData.get('thumbnail_url') ?? '').trim();
  if (thumbnailRaw && !/^https:\/\/[^\s]+$/.test(thumbnailRaw)) return { error: 'Cover URL must be an https:// URL.', saved: false };

  const seoTitle = String(formData.get('seo_title') ?? '').trim().slice(0, 60);
  const seoDescription = String(formData.get('seo_description') ?? '').trim().slice(0, 170);

  const categoryIds = formData.getAll('category_ids').map(String).filter((s) => UUID_RE.test(s));
  const filterValueIds = formData.getAll('filter_value_ids').map(String).filter((s) => UUID_RE.test(s));

  try {
    await updateVideoAdmin(
      id,
      {
        title,
        short_description: shortDescription,
        description: String(formData.get('description') ?? ''),
        thumbnail_url: thumbnailRaw || null,
        status: status as 'draft' | 'published' | 'scheduled' | 'live',
        publish_at: publishAt,
        access: access as 'free' | 'subscription',
        age_rating: ageRating as 'all' | '7+' | '13+' | '16+',
        seo: { meta_title: seoTitle, meta_description: seoDescription },
      },
      user.id,
    );
    await setVideoCategories(id, categoryIds, user.id);
    await setVideoFilterValues(id, filterValueIds, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save changes.', saved: false };
  }

  revalidatePath('/admin/videos');
  revalidatePath(`/admin/videos/${id}`);
  return { error: null, saved: true };
}
