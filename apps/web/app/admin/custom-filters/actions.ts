'use server';

import { revalidatePath } from 'next/cache';
import { addFilterValueAdmin, createFilterAdmin, deleteFilterAdmin, removeFilterValueAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { UUID_RE, type FormState } from '../../../lib/admin-form';

export type FilterFormState = FormState;

/** Bovengrens op het aantal opties in één "Create a filter"-actie; overschrijding = fout, geen stille afkapping. */
const MAX_FILTER_OPTIES = 50;

/** "Create a filter"-dialoog (Filter name *, Filter options — één per regel). */
export async function createFilterAction(_prev: FilterFormState, formData: FormData): Promise<FilterFormState> {
  const { user } = await requireAdmin('editor');
  const name = String(formData.get('name') ?? '').trim();
  // Niet stil afkappen: .slice(0, 50) gooide invoer weg en meldde daarna "Filter created", zodat de
  // gebruiker dacht dat alles opgeslagen was (Codex-review 2026-09-07 B-2). Nu een expliciete fout.
  const values = String(formData.get('options') ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (!name) return { error: 'Filter name is required.', saved: false };
  if (values.length === 0) return { error: 'Add at least one filter option.', saved: false };
  if (values.length > MAX_FILTER_OPTIES) return { error: `Maximum ${MAX_FILTER_OPTIES} filter options; you supplied ${values.length}.`, saved: false };
  try { await createFilterAdmin(name, values, user.id); } catch (err) { return { error: err instanceof Error ? err.message : 'Could not create filter.', saved: false }; }
  revalidatePath('/admin/custom-filters');
  return { error: null, saved: true };
}

export async function addFilterValueAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const filterId = String(formData.get('filter_id') ?? '');
  const value = String(formData.get('value') ?? '').trim();
  if (!UUID_RE.test(filterId) || !value) return;
  await addFilterValueAdmin(filterId, value, user.id);
  revalidatePath('/admin/custom-filters');
}

export async function removeFilterValueAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('editor');
  const valueId = String(formData.get('value_id') ?? '');
  if (!UUID_RE.test(valueId)) return;
  await removeFilterValueAdmin(valueId, user.id);
  revalidatePath('/admin/custom-filters');
}

export async function deleteFilterAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const filterId = String(formData.get('filter_id') ?? '');
  if (!UUID_RE.test(filterId)) return;
  await deleteFilterAdmin(filterId, user.id);
  revalidatePath('/admin/custom-filters');
}
