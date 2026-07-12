/**
 * Server-side session helpers (cookies): UI language, active profile, parent unlock,
 * and — since WS3 — the Supabase auth session (magic-link members).
 *
 * Tenancy rule: a profile is only ever served from the LOGGED-IN member's own
 * household. Anonymous visitors get a null profile (unrestricted default view of
 * the public catalog); there is NO fallback to "some household in the table".
 */
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import {
  getHouseholdByOwner,
  getPersonByAuthUserId,
  getProfileById,
  getProfiles,
  type HouseholdRow,
  type PersonRow,
  type ProfileRow,
} from '@albunyaan/core/data';
import { getServerSupabase } from './supabase/server';

export const LANG_COOKIE = 'albn_lang';
export const PROFILE_COOKIE = 'albn_profile';
export const PARENT_COOKIE = 'albn_parent';

export type Lang = 'en' | 'ar' | 'nl';

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  const v = jar.get(LANG_COOKIE)?.value;
  return v === 'ar' || v === 'nl' ? v : 'en';
}

/** The verified Supabase auth user, or null. Cached per request. */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * The member (people row) behind the auth session, or null — null both for
 * anonymous visitors and for auth users whose person link is missing.
 */
export const getMember = cache(async (): Promise<PersonRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  return getPersonByAuthUserId(user.id).catch(() => null);
});

/** The member's household (no lazy creation here — see ensureHousehold on pages). */
export const getMemberHousehold = cache(async (): Promise<HouseholdRow | null> => {
  const member = await getMember();
  if (!member) return null;
  return getHouseholdByOwner(member.id).catch(() => null);
});

/**
 * Active profile:
 *  - anonymous (or unlinked/household-less member) → null — the app treats null
 *    as an unrestricted default viewer; /profiles and /parents redirect to /login.
 *  - logged-in member → the albn_profile cookie's profile ONLY IF it belongs to
 *    the member's own household (forged/stale ids resolve to null and are
 *    ignored), else the household's first adult profile, else null.
 */
export async function getActiveProfile(): Promise<ProfileRow | null> {
  const household = await getMemberHousehold();
  if (!household) return null;

  const jar = await cookies();
  const id = jar.get(PROFILE_COOKIE)?.value;
  if (id) {
    const p = await getProfileById(id, household.id).catch(() => null);
    if (p) return p;
  }
  const all = await getProfiles(household.id).catch(() => []);
  return all.find((p) => p.kind === 'adult') ?? all[0] ?? null;
}

/**
 * Parent unlock is scoped: the cookie stores WHICH household was unlocked and
 * only counts when it matches the given (member-owned) household.
 */
export async function isParentUnlocked(householdId: string): Promise<boolean> {
  const jar = await cookies();
  return jar.get(PARENT_COOKIE)?.value === householdId;
}
