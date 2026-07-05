'use server';

/**
 * Server actions — the only write path from the UI to Supabase.
 * PIN verification happens HERE (server), never in the browser.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { removeOverride, setOverride, verifyPin } from '@albunyaan/core/data';
import { LANG_COOKIE, PARENT_COOKIE, PROFILE_COOKIE, isParentUnlocked } from '../lib/session';

export async function setLanguageAction(formData: FormData) {
  const lang = String(formData.get('lang'));
  if (!['en', 'ar', 'nl'].includes(lang)) return;
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

export async function selectProfileAction(formData: FormData) {
  const id = String(formData.get('profileId') ?? '');
  if (!id) return;
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, id, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  revalidatePath('/', 'layout');
  redirect('/catalog');
}

export async function unlockParentsAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const pin = String(formData.get('pin') ?? '');
  const ok = await verifyPin(pin);
  if (!ok) return { error: 'Wrong PIN, try again.' };
  const jar = await cookies();
  jar.set(PARENT_COOKIE, 'ok', { path: '/', maxAge: 60 * 15, httpOnly: true, sameSite: 'lax' });
  revalidatePath('/parents');
  return { error: null };
}

export async function lockParentsAction() {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
  revalidatePath('/parents');
}

export async function addOverrideAction(formData: FormData) {
  if (!(await isParentUnlocked())) return; // server-side gate, not just UI
  const profileId = String(formData.get('profileId') ?? '');
  // target is "<kind>|<uuid>" from a single <select>
  const [targetKind, targetId] = String(formData.get('target') ?? '').split('|');
  const action = String(formData.get('action') ?? '');
  if (!profileId || !targetId) return;
  if (targetKind !== 'video' && targetKind !== 'collection') return;
  if (action !== 'block' && action !== 'allow') return;
  await setOverride({ profileId, targetKind, targetId, action });
  revalidatePath('/parents');
  revalidatePath('/programs', 'layout');
}

export async function removeOverrideAction(formData: FormData) {
  if (!(await isParentUnlocked())) return;
  const id = String(formData.get('overrideId') ?? '');
  if (!id) return;
  await removeOverride(id);
  revalidatePath('/parents');
  revalidatePath('/programs', 'layout');
}
