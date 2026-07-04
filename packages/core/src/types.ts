/**
 * Domain types. Conventions per albunyaan-cms-frontend/docs/API_CONTRACT.md:
 * money in cents, timestamps ISO-8601 UTC, IDs opaque strings.
 */

export type AgeRating = 'all' | '7+' | '13+' | '16+';

export type VideoStatus = 'draft' | 'published' | 'scheduled';
export type VideoAccess = 'free' | 'subscription';

export interface Video {
  id: string;
  externalId: string | null; // Uscreen ID, kept for migration QA diffing
  title: string;
  slug: string;
  shortDescription: string;
  thumbnailHue: number; // v0 mock: placeholder gradient hue instead of thumbnailUrl
  durationSeconds: number;
  ageRating: AgeRating;
  status: VideoStatus;
  access: VideoAccess;
  categoryIds: string[];
  seriesId: string | null;
  episodeNumber: number | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  thumbnailHue: number;
  ageRating: AgeRating;
  categoryIds: string[];
}

export type ProfileKind = 'adult' | 'kid';
export type AgeBand = '4-6' | '7-9' | '10-12' | '13+';

export interface Profile {
  id: string;
  householdId: string;
  kind: ProfileKind;
  name: string;
  ageBand: AgeBand | null; // kid profiles only
  avatarHue: number;
  dailyLimitMinutes: number | null; // kid profiles only, null = no limit
}

/** Per-kid-profile override: block wins over everything; allow wins over the age-band filter. */
export interface ContentOverride {
  profileId: string;
  target: { kind: 'video' | 'series'; id: string };
  action: 'block' | 'allow';
}

export interface WatchEvent {
  profileId: string;
  videoId: string;
  watchedAt: string; // ISO-8601 UTC
  progressSeconds: number;
}
