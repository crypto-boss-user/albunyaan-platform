'use server';

import { revalidatePath } from 'next/cache';
import { updateVideoAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';

/** One-click publish/unpublish toggle from the list — editor role and up. */
export async function toggleVideoStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const nextStatus = String(formData.get('nextStatus') ?? '');
  if (!id || (nextStatus !== 'published' && nextStatus !== 'draft')) return;
  await updateVideoAdmin(id, { status: nextStatus }, user.id);
  revalidatePath('/admin/videos');
  revalidatePath(`/admin/videos/${id}`);
}

export interface VideoEditState {
  error: string | null;
  saved: boolean;
}

/** Full edit form on the video detail page — editor role and up. */
export async function updateVideoAction(_prev: VideoEditState, formData: FormData): Promise<VideoEditState> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Missing video id.', saved: false };

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: 'Title cannot be empty.', saved: false };

  const status = String(formData.get('status') ?? '');
  const access = String(formData.get('access') ?? '');
  const ageRating = String(formData.get('age_rating') ?? '');
  if (!['draft', 'published', 'scheduled', 'live'].includes(status)) return { error: 'Invalid status.', saved: false };
  if (!['free', 'subscription'].includes(access)) return { error: 'Invalid access.', saved: false };
  if (!['all', '7+', '13+', '16+'].includes(ageRating)) return { error: 'Invalid age rating.', saved: false };

  try {
    await updateVideoAdmin(
      id,
      {
        title,
        short_description: String(formData.get('short_description') ?? ''),
        description: String(formData.get('description') ?? ''),
        status: status as 'draft' | 'published' | 'scheduled' | 'live',
        access: access as 'free' | 'subscription',
        age_rating: ageRating as 'all' | '7+' | '13+' | '16+',
      },
      user.id,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save changes.', saved: false };
  }

  revalidatePath('/admin/videos');
  revalidatePath(`/admin/videos/${id}`);
  return { error: null, saved: true };
}
