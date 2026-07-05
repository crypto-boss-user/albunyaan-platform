/**
 * Server-side session helpers (cookies): UI language, active profile, parent unlock.
 * Replaces the v0 localStorage store — state now lives in Supabase + cookies.
 */
import { cookies } from 'next/headers';
import { getProfileById, getProfiles, type ProfileRow } from '@albunyaan/core/data';

export const LANG_COOKIE = 'albn_lang';
export const PROFILE_COOKIE = 'albn_profile';
export const PARENT_COOKIE = 'albn_parent';

export type Lang = 'en' | 'ar' | 'nl';

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  const v = jar.get(LANG_COOKIE)?.value;
  return v === 'ar' || v === 'nl' ? v : 'en';
}

/** Active profile: cookie id if valid, else the household's first (adult) profile. */
export async function getActiveProfile(): Promise<ProfileRow | null> {
  const jar = await cookies();
  const id = jar.get(PROFILE_COOKIE)?.value;
  if (id) {
    const p = await getProfileById(id).catch(() => null);
    if (p) return p;
  }
  const all = await getProfiles().catch(() => []);
  return all.find((p) => p.kind === 'adult') ?? all[0] ?? null;
}

export async function isParentUnlocked(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(PARENT_COOKIE)?.value === 'ok';
}
