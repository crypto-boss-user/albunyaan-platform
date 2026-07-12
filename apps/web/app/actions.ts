'use server';

/**
 * Server actions — the only write path from the UI to Supabase.
 * PIN verification happens HERE (server), never in the browser, and every
 * action is scoped to the LOGGED-IN member's own household — ids arriving
 * from forms/cookies are validated against it, never trusted.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  ensureHousehold,
  getProfileById,
  removeOverride,
  setOverride,
  setPin,
  verifyPin,
  type HouseholdRow,
} from '@albunyaan/core/data';
import {
  LANG_COOKIE,
  PARENT_COOKIE,
  PROFILE_COOKIE,
  getMember,
  getMemberHousehold,
  isParentUnlocked,
} from '../lib/session';

export async function setLanguageAction(formData: FormData) {
  const lang = String(formData.get('lang'));
  if (!['en', 'ar', 'nl'].includes(lang)) return;
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

export async function selectProfileAction(formData: FormData) {
  const household = await getMemberHousehold();
  if (!household) redirect('/login'); // anonymous visitors have no profiles
  const id = String(formData.get('profileId') ?? '');
  if (!id) return;
  // Reject forged/foreign ids: the profile must belong to THIS member's household.
  const profile = await getProfileById(id, household.id).catch(() => null);
  if (!profile) return;

  // Switching INTO an adult profile is a parental-control boundary: without this,
  // a kid could open /profiles, tap the adult avatar, and void every block (the
  // adult profile carries no overrides). If the household has a PIN, require the
  // parent unlock first; a household with no PIN yet has nothing to protect.
  if (profile.kind === 'adult' && household.pin_hash && !(await isParentUnlocked(household.id))) {
    redirect('/parents');
  }

  const jar = await cookies();
  jar.set(PROFILE_COOKIE, profile.id, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  revalidatePath('/', 'layout');
  redirect('/catalog');
}

/** Member's household, or null → callers bail (pages already redirect anon). */
async function requireHousehold(): Promise<HouseholdRow | null> {
  return getMemberHousehold();
}

export async function unlockParentsAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const household = await requireHousehold();
  if (!household) return { error: 'Log in first to open the parent dashboard.' };
  if (!household.pin_hash) return { error: 'Set a PIN first.' };
  const pin = String(formData.get('pin') ?? '');
  const verdict = await verifyPin(household.id, pin);
  if (!verdict.ok) {
    if (verdict.reason === 'locked') {
      const mins = verdict.lockedUntil
        ? Math.max(1, Math.ceil((new Date(verdict.lockedUntil).getTime() - Date.now()) / 60_000))
        : 15;
      return { error: `Too many wrong PINs — try again in ${mins} min.` };
    }
    if (verdict.reason === 'no-pin') return { error: 'Set a PIN first.' };
    return { error: 'Wrong PIN, try again.' };
  }
  const jar = await cookies();
  // Cookie stores WHICH household was unlocked; checks compare it to the
  // member's own household — a value from another family can never match.
  jar.set(PARENT_COOKIE, household.id, { path: '/', maxAge: 60 * 15, httpOnly: true, sameSite: 'lax' });
  revalidatePath('/parents');
  return { error: null };
}

/** First-run PIN setup — only while the household has no PIN yet. */
export async function setPinAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const member = await getMember();
  if (!member) return { error: 'Log in first to open the parent dashboard.' };
  const household = await ensureHousehold(member);
  if (household.pin_hash) return { error: 'A PIN already exists — enter it to unlock.' };

  const pin = String(formData.get('pin') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!/^\d{4}$/.test(pin)) return { error: 'The PIN must be exactly 4 digits.' };
  if (pin !== confirm) return { error: 'The two PINs do not match.' };

  await setPin(household.id, pin);
  const jar = await cookies();
  jar.set(PARENT_COOKIE, household.id, { path: '/', maxAge: 60 * 15, httpOnly: true, sameSite: 'lax' });
  revalidatePath('/parents');
  return { error: null };
}

export async function lockParentsAction() {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
  revalidatePath('/parents');
}

export async function addOverrideAction(formData: FormData) {
  const household = await requireHousehold();
  if (!household) return;
  if (!(await isParentUnlocked(household.id))) return; // server-side gate, not just UI
  const profileId = String(formData.get('profileId') ?? '');
  // target is "<kind>|<uuid>" from a single <select>
  const [targetKind, targetId] = String(formData.get('target') ?? '').split('|');
  const action = String(formData.get('action') ?? '');
  if (!profileId || !targetId) return;
  if (targetKind !== 'video' && targetKind !== 'collection') return;
  if (action !== 'block' && action !== 'allow') return;
  // setOverride re-validates that profileId belongs to household.id.
  await setOverride({ householdId: household.id, profileId, targetKind, targetId, action });
  revalidatePath('/parents');
  revalidatePath('/programs', 'layout');
}

export async function removeOverrideAction(formData: FormData) {
  const household = await requireHousehold();
  if (!household) return;
  if (!(await isParentUnlocked(household.id))) return;
  const id = String(formData.get('overrideId') ?? '');
  if (!id) return;
  await removeOverride(id, household.id); // no-ops on other households' overrides
  revalidatePath('/parents');
  revalidatePath('/programs', 'layout');
}
