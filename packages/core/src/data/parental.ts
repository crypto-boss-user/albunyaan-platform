/**
 * Parental data access — server-side only. Persists kid profiles + per-video/series
 * overrides in Supabase (0002_parental_local.sql) and adapts rows to the pure
 * canWatch() domain logic in ../parental.ts.
 *
 * WS3: every read/write is scoped to ONE household (by id or owner person id).
 * There is deliberately NO "first household in the table" helper anymore — that
 * was a cross-tenant leak while the schema was single-family. The legacy demo
 * household (unowned, PIN 1234) still has rows in the DB but no code path here
 * can reach it for a member: everything flows through the member's own
 * household via ensureHousehold()/getHouseholdByOwner().
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { canWatch } from '../parental';
import type { ContentOverride, Profile, Video } from '../types';
import { createServiceClient } from './client';
import type { ContentOverrideRow, HouseholdRow, PersonRow, ProfileRow, VideoRow } from './rows';

const HOUSEHOLD_COLS = 'id, name, pin_hash, owner_person_id, pin_failed_attempts, pin_locked_until';

const SCRYPT_PREFIX = 'scrypt$'; // stored as scrypt$<saltHex>$<hashHex>
const PROFILE_COLS = 'id, household_id, kind, name, age_band, avatar_hue, daily_limit_minutes';
const OVERRIDE_COLS = 'id, profile_id, target_kind, target_id, action';

/** Salted scrypt hash (offline-brute-force resistant). Format: scrypt$<salt>$<hash>. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin.trim(), salt, 32);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Constant-time PIN check against a stored hash — accepts BOTH the new salted
 * scrypt format and legacy bare-SHA-256 hex (pre-0009), so existing PINs keep
 * working; verifyPin upgrades legacy hashes on the next successful unlock.
 */
function pinMatches(pin: string, stored: string): boolean {
  const trimmed = pin.trim();
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const [, saltHex, hashHex] = stored.split('$');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(trimmed, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  const legacy = Buffer.from(createHash('sha256').update(trimmed).digest('hex'));
  const storedBuf = Buffer.from(stored);
  return legacy.length === storedBuf.length && timingSafeEqual(legacy, storedBuf);
}

// ── households ───────────────────────────────────────────────────────────────

export async function getHouseholdById(householdId: string): Promise<HouseholdRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('households')
    .select(HOUSEHOLD_COLS)
    .eq('id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data as HouseholdRow | null;
}

/** The household OWNED by this person (oldest wins if a race ever made two). */
export async function getHouseholdByOwner(personId: string): Promise<HouseholdRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('households')
    .select(HOUSEHOLD_COLS)
    .eq('owner_person_id', personId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HouseholdRow | null;
}

/**
 * Lazily create the member's household on first need (/profiles, /parents):
 * one household (no PIN yet → dashboard prompts to SET one) + one default
 * adult profile named after the person. Idempotent per owner.
 */
export async function ensureHousehold(person: Pick<PersonRow, 'id' | 'email' | 'full_name'>): Promise<HouseholdRow> {
  const existing = await getHouseholdByOwner(person.id);
  if (existing) return existing;

  const db = createServiceClient();
  const displayName = (person.full_name ?? '').trim() || person.email.split('@')[0];
  // pin_hash '' = "no PIN set yet" (column is NOT NULL; hashPin can never
  // produce '', so verifyPin can never match an unset PIN).
  const { data: household, error } = await db
    .from('households')
    .insert({ name: `${displayName}'s household`, pin_hash: '', owner_person_id: person.id })
    .select(HOUSEHOLD_COLS)
    .single();
  if (error) throw error;

  const { error: profileError } = await db.from('profiles').insert({
    household_id: (household as HouseholdRow).id,
    kind: 'adult',
    name: displayName,
    age_band: null,
    avatar_hue: 140,
    daily_limit_minutes: null,
  });
  if (profileError) throw profileError;

  // Guard against a create-race between two concurrent first requests: the
  // OLDEST household for this owner is canonical, so re-read instead of
  // trusting our own insert blindly.
  return (await getHouseholdByOwner(person.id)) ?? (household as HouseholdRow);
}

/** Set (or replace) the household PIN — callers gate WHO may do this. */
export async function setPin(householdId: string, pin: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from('households')
    .update({
      pin_hash: hashPin(pin),
      pin_failed_attempts: 0,
      pin_locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', householdId);
  if (error) throw error;
}

export type PinVerdict =
  | { ok: true }
  | { ok: false; reason: 'no-pin' | 'invalid' | 'locked'; lockedUntil: string | null };

/**
 * Server-side PIN check against ONE household's stored hash, with brute-force
 * lockout (the 5-attempts / 15-minute policy lives in reserve_pin_attempt, 0009).
 * A household without a PIN (pin_hash '' or NULL) can never verify — set one first.
 *
 * The attempt slot is reserved ATOMICALLY in the DB before the guess is checked:
 * on serverless, concurrent guesses run in separate processes, so an app-side
 * read-check-write counter would give a parallel burst unlimited free tries.
 */
export async function verifyPin(householdId: string, pin: string): Promise<PinVerdict> {
  const household = await getHouseholdById(householdId);
  if (!household?.pin_hash) return { ok: false, reason: 'no-pin', lockedUntil: null };

  const db = createServiceClient();
  const { data, error } = await db.rpc('reserve_pin_attempt', { p_household_id: householdId });
  if (error) throw error;
  const slot = data as { allowed: boolean; reason?: string; locked_until?: string };
  if (!slot.allowed) {
    if (slot.reason === 'locked') return { ok: false, reason: 'locked', lockedUntil: slot.locked_until ?? null };
    return { ok: false, reason: 'invalid', lockedUntil: null }; // household vanished mid-flight
  }

  if (!pinMatches(pin, household.pin_hash)) return { ok: false, reason: 'invalid', lockedUntil: null };

  // Success: clear the attempt window and transparently upgrade a legacy
  // bare-SHA-256 hash to salted scrypt — the plaintext only exists right here.
  const rehash = household.pin_hash.startsWith(SCRYPT_PREFIX) ? {} : { pin_hash: hashPin(pin) };
  const { error: clearError } = await db
    .from('households')
    .update({ pin_failed_attempts: 0, pin_locked_until: null, ...rehash, updated_at: new Date().toISOString() })
    .eq('id', householdId);
  if (clearError) throw clearError;
  return { ok: true };
}

// ── profiles ─────────────────────────────────────────────────────────────────

export async function getProfiles(householdId: string): Promise<ProfileRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('household_id', householdId)
    .order('created_at');
  if (error) throw error;
  return data as ProfileRow[];
}

/**
 * One profile by id. Pass `householdId` whenever the id came from the client
 * (cookie/form) so a forged id from another household resolves to null.
 */
export async function getProfileById(id: string, householdId?: string): Promise<ProfileRow | null> {
  const db = createServiceClient();
  let q = db.from('profiles').select(PROFILE_COLS).eq('id', id);
  if (householdId) q = q.eq('household_id', householdId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

// ── content overrides ────────────────────────────────────────────────────────

export async function getOverridesForProfile(profileId: string): Promise<ContentOverrideRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('content_overrides')
    .select(OVERRIDE_COLS)
    .eq('profile_id', profileId)
    .order('created_at');
  if (error) throw error;
  return data as ContentOverrideRow[];
}

export async function getOverridesForHousehold(householdId: string): Promise<ContentOverrideRow[]> {
  const profiles = await getProfiles(householdId);
  if (profiles.length === 0) return [];
  const db = createServiceClient();
  const { data, error } = await db
    .from('content_overrides')
    .select(OVERRIDE_COLS)
    .in('profile_id', profiles.map((p) => p.id))
    .order('created_at');
  if (error) throw error;
  return data as ContentOverrideRow[];
}

/** Upsert an override — refuses profile ids outside `householdId` (forged forms). */
export async function setOverride(o: {
  householdId: string;
  profileId: string;
  targetKind: 'video' | 'collection';
  targetId: string;
  action: 'block' | 'allow';
}): Promise<void> {
  const profile = await getProfileById(o.profileId, o.householdId);
  if (!profile) throw new Error('setOverride: profile does not belong to this household');
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

/** Delete an override — only if it belongs to a profile of `householdId`. */
export async function removeOverride(id: string, householdId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('content_overrides')
    .select('id, profiles!inner(household_id)')
    .eq('id', id)
    .eq('profiles.household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return; // not this household's override — silently ignore
  const { error: delError } = await db.from('content_overrides').delete().eq('id', id);
  if (delError) throw delError;
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

/**
 * DB-backed canWatch: may `profile` watch `video` (member of `collectionId`)?
 * `profile` may be null — an anonymous visitor is an unrestricted default
 * viewer (public catalog surface); parental filtering only exists per-profile.
 */
export function canProfileWatch(
  profile: ProfileRow | null,
  video: VideoRow,
  collectionId: string | null,
  overrides: ContentOverrideRow[],
): boolean {
  if (!profile) return true;
  return canWatch(
    profileRowToDomain(profile),
    videoRowToDomain(video, collectionId),
    overrides.map(overrideRowToDomain),
  );
}

/** Series-level visibility: blocked if the collection itself carries a block. */
export function isCollectionBlocked(
  profile: ProfileRow | null,
  collectionId: string,
  overrides: ContentOverrideRow[],
): boolean {
  if (!profile || profile.kind === 'adult') return false;
  return overrides.some(
    (o) => o.profile_id === profile.id && o.target_kind === 'collection' && o.target_id === collectionId && o.action === 'block',
  );
}
