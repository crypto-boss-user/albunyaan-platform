/**
 * Parental data access — server-side only. Persists kid profiles + per-video/series
 * overrides in Supabase (0002_parental_local.sql) and adapts rows to the pure
 * canWatch() domain logic in ../parental.ts.
 */
import { createHash } from 'node:crypto';
import { canWatch } from '../parental';
import type { ContentOverride, Profile, Video } from '../types';
import { createServiceClient } from './client';
import type { ContentOverrideRow, HouseholdRow, ProfileRow, VideoRow } from './rows';

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin.trim()).digest('hex');
}

export async function getHousehold(): Promise<HouseholdRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('households')
    .select('id, name, pin_hash')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HouseholdRow | null;
}

/** Server-side PIN check against the household's stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  const household = await getHousehold();
  if (!household) return false;
  return hashPin(pin) === household.pin_hash;
}

export async function getProfiles(): Promise<ProfileRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('profiles')
    .select('id, household_id, kind, name, age_band, avatar_hue, daily_limit_minutes')
    .order('created_at');
  if (error) throw error;
  return data as ProfileRow[];
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('profiles')
    .select('id, household_id, kind, name, age_band, avatar_hue, daily_limit_minutes')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function getOverrides(profileId?: string): Promise<ContentOverrideRow[]> {
  const db = createServiceClient();
  let q = db.from('content_overrides').select('id, profile_id, target_kind, target_id, action').order('created_at');
  if (profileId) q = q.eq('profile_id', profileId);
  const { data, error } = await q;
  if (error) throw error;
  return data as ContentOverrideRow[];
}

export async function setOverride(o: {
  profileId: string;
  targetKind: 'video' | 'collection';
  targetId: string;
  action: 'block' | 'allow';
}): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from('content_overrides').upsert(
    {
      profile_id: o.profileId,
      target_kind: o.targetKind,
      target_id: o.targetId,
      action: o.action,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,target_kind,target_id' },
  );
  if (error) throw error;
}

export async function removeOverride(id: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from('content_overrides').delete().eq('id', id);
  if (error) throw error;
}

// ── row → domain adapters (reuse the pure canWatch) ─────────────────────────

export function profileRowToDomain(p: ProfileRow): Profile {
  return {
    id: p.id,
    householdId: p.household_id,
    kind: p.kind,
    name: p.name,
    ageBand: p.age_band,
    avatarHue: p.avatar_hue,
    dailyLimitMinutes: p.daily_limit_minutes,
  };
}

export function videoRowToDomain(v: VideoRow, collectionId: string | null): Video {
  return {
    id: v.id,
    externalId: v.external_id,
    title: v.title,
    slug: v.slug,
    shortDescription: v.short_description,
    thumbnailHue: v.thumbnail_hue ?? 140,
    durationSeconds: v.duration_seconds ?? 0,
    ageRating: v.age_rating,
    status: v.status === 'live' ? 'published' : v.status,
    access: v.access,
    categoryIds: [],
    seriesId: collectionId,
    episodeNumber: null,
  };
}

export function overrideRowToDomain(o: ContentOverrideRow): ContentOverride {
  return {
    profileId: o.profile_id,
    target: { kind: o.target_kind === 'collection' ? 'series' : 'video', id: o.target_id },
    action: o.action,
  };
}

/** DB-backed canWatch: may `profile` watch `video` (member of `collectionId`)? */
export function canProfileWatch(
  profile: ProfileRow,
  video: VideoRow,
  collectionId: string | null,
  overrides: ContentOverrideRow[],
): boolean {
  return canWatch(
    profileRowToDomain(profile),
    videoRowToDomain(video, collectionId),
    overrides.map(overrideRowToDomain),
  );
}

/** Series-level visibility: blocked if the collection itself carries a block. */
export function isCollectionBlocked(profile: ProfileRow, collectionId: string, overrides: ContentOverrideRow[]): boolean {
  if (profile.kind === 'adult') return false;
  return overrides.some(
    (o) => o.profile_id === profile.id && o.target_kind === 'collection' && o.target_id === collectionId && o.action === 'block',
  );
}
