'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addCollectionItem, createCollectionAdmin, deleteCollectionAdmin, removeCollectionItem, setCategoryMembership, setCollectionOrder, updateCollectionAdmin,
} from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { UUID_RE, ids, type FormState } from '../../../lib/admin-form';

export type CollectionFormState = FormState;

/** Nieuwe collectie: eerst het formulier (titel), dan aanmaken (B83: Uscreen maakt direct aan — wij niet). */
export async function createCollectionAction(_prev: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const { user } = await requireAdmin('editor');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: 'Title cannot be empty.', saved: false };
  let created: { id: string };
  try { created = await createCollectionAdmin(title, user.id); } catch (err) { return { error: err instanceof Error ? err.message : 'Could not create collection.', saved: false }; }
  revalidatePath('/admin/collections');
  redirect(`/admin/collections/${created.id}`);
}

export async function updateCollectionAction(_prev: CollectionFormState, formData: FormData): Promise<CollectionFormState> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Missing collection id.', saved: false };
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: 'Title cannot be empty.', saved: false };
  const cover = String(formData.get('cover_url') ?? '').trim();
  if (cover && !/^https:\/\/[^\s]+$/.test(cover)) return { error: 'Cover URL must be an https:// URL.', saved: false };
  try {
    await updateCollectionAdmin(id, { title, description: String(formData.get('description') ?? ''), cover_url: cover || null }, user.id);
    await setCategoryMembership({ collectionId: id }, ids(formData, 'category_ids'), user.id);
  } catch (err) { return { error: err instanceof Error ? err.message : 'Could not save changes.', saved: false }; }
  revalidatePath(`/admin/collections/${id}`);
  revalidatePath('/admin/collections');
  return { error: null, saved: true };
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return;
  await deleteCollectionAdmin(id, user.id);
  revalidatePath('/admin/collections');
  redirect('/admin/collections');
}

export async function reorderCollectionAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const order = String(formData.get('order') ?? '').split(',').filter((s) => UUID_RE.test(s));
  if (!UUID_RE.test(id) || order.length === 0) return;
  await setCollectionOrder(id, order, user.id);
  revalidatePath(`/admin/collections/${id}`);
}

export async function addCollectionItemAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const videoId = String(formData.get('video_id') ?? '');
  if (!UUID_RE.test(id) || !UUID_RE.test(videoId)) return;
  await addCollectionItem(id, videoId, user.id);
  revalidatePath(`/admin/collections/${id}`); // geen redirect: die toonde een verouderde pagina na de action (gemeten 2026-09-06)
}

export async function removeCollectionItemAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const videoId = String(formData.get('video_id') ?? '');
  if (!UUID_RE.test(id) || !UUID_RE.test(videoId)) return;
  await removeCollectionItem(id, videoId, user.id);
  revalidatePath(`/admin/collections/${id}`);
}
