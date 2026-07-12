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
  /** Consecutive wrong-PIN count (0009); reset on success, drives lockout. */
  pin_failed_attempts?: number;
  /** When set and in the future, PIN verification is locked out (0009). */
  pin_locked_until?: string | null;
}

/** A member: a `people` row linked to an auth.users account (0003 trigger). */
export interface PersonRow {
  id: string;
  email: string;
  full_name: string | null;
  auth_user_id: string | null;
  legacy_cohort: string | null;
  /** Stripe Customer id (cus_…) — set by checkout or the audit backfill; null until first native billing contact. */
  stripe_customer_id: string | null;
}

/** A `plans` row as billing reads it (0001 schema; Stripe-native rows use source 'native'). */
export interface PlanRow {
  id: string;
  external_id: string;
  source: string;
  title: string;
  platform: 'web' | 'ios' | 'android' | 'tv';
  amount_cents: number;
  currency: string;
  billing_period: 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'onetime';
  visibility: 'public' | 'private';
  stripe_price_id: string | null;
}

/** An `entitlements` row (0004) — the single source of "can this person watch?". */
export interface EntitlementRow {
  id: string;
  person_id: string;
  plan_id: string | null;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  provider: 'stripe' | 'apple' | 'google' | 'voucher' | 'legacy_free';
  /** Stripe subscription id / store transaction ref / voucher redemption key. */
  provider_ref: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/** Entitlement plus its (optional) plan, for the account billing panel. */
export interface EntitlementWithPlan extends EntitlementRow {
  plan: Pick<PlanRow, 'id' | 'title' | 'billing_period' | 'amount_cents' | 'currency'> | null;
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
