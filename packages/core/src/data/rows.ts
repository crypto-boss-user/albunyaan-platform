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
  pin_hash: string;
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
export type CatalogRowData =
  | { kind: 'live'; key: string; title: string; seeAllHref: string; category: CategoryRow; videos: VideoRow[] }
  | { kind: 'series'; key: string; title: string; seeAllHref: string; collection: CollectionRow; videos: EpisodeRow[] };
