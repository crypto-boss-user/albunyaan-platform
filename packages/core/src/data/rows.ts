/** Typed rows for the Phase-1 schema (+ 0002 additions) as the data layer reads them. */

import type { AgeBand, AgeRating, ProfileKind } from '../types';

export interface VideoRow {
  id: string;
  external_id: string;
  source: string;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  thumbnail_url: string | null;
  thumbnail_hue: number | null;
  duration_seconds: number | null;
  status: 'draft' | 'published' | 'scheduled' | 'live';
  access: 'free' | 'subscription';
  age_rating: AgeRating;
  /** Bunny Stream video guid — set once the media migration has moved this file off Uscreen. */
  bunny_video_id: string | null;
}

export interface CategoryRow {
  id: string;
  external_id: string;
  source: string;
  name: string;
  slug: string;
}

export interface CollectionRow {
  id: string;
  external_id: string;
  source: string;
  title: string;
  slug: string;
  description: string;
  raw: { row_order?: number } | null;
}

export interface HouseholdRow {
  id: string;
  name: string;
  /** '' (or NULL) until the owner sets a PIN — the parents dashboard prompts to SET one first. */
  pin_hash: string | null;
  /** People.id of the member who owns this household; NULL only on the legacy demo rows. */
  owner_person_id: string | null;
}

/** A member: a `people` row linked to an auth.users account (0003 trigger). */
export interface PersonRow {
  id: string;
  email: string;
  full_name: string | null;
  auth_user_id: string | null;
  legacy_cohort: string | null;
}

export interface ProfileRow {
  id: string;
  household_id: string;
  kind: ProfileKind;
  name: string;
  age_band: AgeBand | null;
  avatar_hue: number;
  daily_limit_minutes: number | null;
}

export interface ContentOverrideRow {
  id: string;
  profile_id: string;
  target_kind: 'video' | 'collection';
  target_id: string;
  action: 'block' | 'allow';
}

/** An episode inside a series row: the video plus its position in the collection. */
export interface EpisodeRow extends VideoRow {
  position: number;
}

/** One storefront catalog row, in IA order. */
/** A series shown as a single card in a category rail (English title + poster + count). */
export interface SeriesCard {
  title: string;
  slug: string;
  thumbnail_url: string | null;
  thumbnail_hue: number | null;
  episodeCount: number;
}

export type CatalogRowData =
  | { kind: 'live'; key: string; title: string; seeAllHref: string; category: CategoryRow; videos: VideoRow[] }
  | { kind: 'category'; key: string; title: string; seeAllHref: string; category: CategoryRow; series: SeriesCard[] }
  | { kind: 'series'; key: string; title: string; seeAllHref: string; collection: CollectionRow; videos: EpisodeRow[] };
