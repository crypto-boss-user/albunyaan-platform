'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CATEGORY_CONTENT_SORTS, createCategoryAdmin, deleteCategoryAdmin, getCollectionForAdmin, getVideoCategoryIds, removeCategoryItem, setCategoriesOrder, setCategoryItemsOrder, setCategoryMembership, updateCategoryAdmin,
  type CategoryContentSort,
} from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { UUID_RE, type FormState } from '../../../lib/admin-form';

export type CategoryFormState = FormState;

export async function createCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const { user } = await requireAdmin('editor');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Category title cannot be empty.', saved: false };
  let created: { id: string };
  try { created = await createCategoryAdmin(name, user.id); } catch (err) { return { error: err instanceof Error ? err.message : 'Could not create category.', saved: false }; }
  revalidatePath('/admin/categories');
  redirect(`/admin/categories/${created.id}`);
}

export async function updateCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Missing category id.', saved: false };
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Category title cannot be empty.', saved: false };
  const position = Number(formData.get('position'));
  if (!Number.isInteger(position) || position < 1) return { error: 'Position must be a whole number ≥ 1.', saved: false };
  const sort = String(formData.get('content_sort') ?? 'manual');
  if (!(CATEGORY_CONTENT_SORTS as readonly string[]).includes(sort)) return { error: 'Invalid sort.', saved: false };
  try { await updateCategoryAdmin(id, { name, position, content_sort: sort as CategoryContentSort }, user.id); } catch (err) { return { error: err instanceof Error ? err.message : 'Could not save changes.', saved: false }; }
  revalidatePath(`/admin/categories/${id}`);
  revalidatePath('/admin/categories');
  return { error: null, saved: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return;
  await deleteCategoryAdmin(id, user.id);
  revalidatePath('/admin/categories');
  redirect('/admin/categories');
}

/** Site-nav-volgorde (Reorder-handvatten op de lijst). */
export async function reorderCategoriesAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const order = String(formData.get('order') ?? '').split(',').filter((s) => UUID_RE.test(s));
  if (order.length === 0) return;
  await setCategoriesOrder(order, user.id);
  revalidatePath('/admin/categories');
}

/** Content-volgorde binnen een categorie (Manage content). */
export async function reorderCategoryItemsAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const order = String(formData.get('order') ?? '').split(',').filter((s) => UUID_RE.test(s));
  if (!UUID_RE.test(id) || order.length === 0) return;
  await setCategoryItemsOrder(id, order, user.id);
  revalidatePath(`/admin/categories/${id}`);
}

/** Add content: één video of collectie bovenaan plaatsen (Uscreen: "New content will be added to the top of the list"). */
export async function addCategoryContentAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const videoId = String(formData.get('video_id') ?? '');
  const collectionId = String(formData.get('collection_id') ?? '');
  if (!UUID_RE.test(id)) return;
  const target: { videoId: string } | { collectionId: string } | null = UUID_RE.test(videoId) ? { videoId } : UUID_RE.test(collectionId) ? { collectionId } : null;
  if (!target) return;
  const current = 'videoId' in target ? await getVideoCategoryIds(target.videoId) : ((await getCollectionForAdmin(target.collectionId))?.categoryIds ?? []);
  await setCategoryMembership(target, Array.from(new Set([...current, id])), user.id);
  revalidatePath(`/admin/categories/${id}`); // geen redirect (zie collections/actions.ts)
}

export async function removeCategoryItemAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const id = String(formData.get('id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  if (!UUID_RE.test(id) || !UUID_RE.test(itemId)) return;
  await removeCategoryItem(id, itemId, user.id);
  revalidatePath(`/admin/categories/${id}`);
}
