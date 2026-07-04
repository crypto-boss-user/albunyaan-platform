-- Albunyaan Platform — draft initial schema (2026-07-04, overnight scaffold).
-- STATUS: DRAFT pending founder approval of docs/prd/phase-1-data-liberation.md,
-- feature-parental-controls.md and feature-downloads.md. Do not apply to a live project yet.
-- Conventions per API_CONTRACT.md: money in cents, timestamps UTC, opaque ids.
-- Every migrated row carries external_id (Uscreen id) + source + raw jsonb for QA diffing.

create extension if not exists "pgcrypto";

-- ── content ────────────────────────────────────────────────────────────────

create type video_status as enum ('draft', 'published', 'scheduled');
create type video_access as enum ('free', 'subscription');
create type age_rating as enum ('all', '7+', '13+', '16+');

create table categories (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  slug text not null unique,
  source text not null default 'native', -- 'native' | 'uscreen'
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table series (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  age_rating age_rating not null default 'all',
  source text not null default 'native',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '', -- rich-text HTML
  thumbnail_url text,
  duration_seconds integer,
  status video_status not null default 'draft',
  publish_at timestamptz,
  access video_access not null default 'subscription',
  age_rating age_rating not null default 'all',
  age_rating_source text not null default 'unrated', -- 'unrated' | 'batch_classified' | 'human'
  series_id uuid references series(id),
  episode_number integer,
  bunny_video_id text unique,
  bunny_status text, -- null | 'uploading' | 'encoding' | 'ready' | 'failed'
  custom_filters jsonb not null default '{}',
  seo jsonb not null default '{}',
  source text not null default 'native',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table video_categories (
  video_id uuid not null references videos(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (video_id, category_id)
);

create index videos_status_idx on videos(status);
create index videos_series_idx on videos(series_id);

-- per-locale metadata (en / ar / nl), machine-translated + human spot-checked
create table content_translations (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'nl')),
  title text not null,
  short_description text not null default '',
  description text not null default '',
  translation_source text not null default 'machine', -- 'machine' | 'human'
  unique (video_id, locale)
);

-- ── households, profiles, parental controls ────────────────────────────────

create type profile_kind as enum ('adult', 'kid');
create type age_band as enum ('4-6', '7-9', '10-12', '13+');
create type override_action as enum ('block', 'allow');

create table households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null, -- references auth.users(id) in the live project
  parent_pin_hash text, -- bcrypt/argon2 hash, never plaintext
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind profile_kind not null,
  name text not null,
  age_band age_band, -- kid profiles only
  avatar_hue integer not null default 140,
  daily_limit_minutes integer, -- kid profiles only, null = no limit
  created_at timestamptz not null default now(),
  constraint kid_needs_band check (kind = 'adult' or age_band is not null)
);

-- block wins over allow; allow overrides the age-band filter (see packages/core/src/parental.ts)
create table profile_content_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('video', 'series')),
  target_id uuid not null,
  action override_action not null,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (profile_id, target_kind, target_id)
);

create table watch_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  progress_seconds integer not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);

-- ── people, plans, entitlements, vouchers ──────────────────────────────────

create table people (
  id uuid primary key default gen_random_uuid(),
  external_id text unique, -- Uscreen person id
  auth_user_id uuid unique, -- linked once they activate via magic link
  email text not null unique,
  full_name text,
  language text not null default 'en',
  stripe_customer_id text unique,
  legacy_cohort text, -- null | 'uscreen_paying' | 'uscreen_free_api' | 'uscreen_iap'
  source text not null default 'native',
  raw jsonb,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  description text not null default '',
  platform text not null default 'web' check (platform in ('web', 'ios', 'android', 'tv')),
  amount_cents integer not null,
  currency text not null default 'EUR',
  billing_period text not null check (billing_period in ('monthly', 'quarterly', 'semiannual', 'yearly', 'onetime')),
  trial_days integer not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  stripe_price_id text unique,
  created_at timestamptz not null default now()
);

create type entitlement_status as enum ('active', 'trialing', 'past_due', 'canceled', 'expired');

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  plan_id uuid references plans(id),
  status entitlement_status not null,
  provider text not null check (provider in ('stripe', 'apple', 'google', 'voucher', 'legacy_free')),
  provider_ref text, -- stripe subscription id / RevenueCat entitlement / voucher code
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entitlements_person_idx on entitlements(person_id);

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_id uuid references plans(id),
  duration_days integer not null,
  max_redemptions integer not null default 1,
  redemption_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled', 'expired')),
  expires_at timestamptz,
  sponsor_label text,
  created_at timestamptz not null default now(),
  last_redeemed_at timestamptz
);

-- ── migration bookkeeping (Phase 1 data liberation) ────────────────────────

create table export_manifest (
  id uuid primary key default gen_random_uuid(),
  entity text not null, -- 'video' | 'person' | 'category' | ...
  external_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'exported', 'downloaded', 'uploaded', 'verified', 'failed')),
  detail text,
  updated_at timestamptz not null default now(),
  unique (entity, external_id)
);

create table uscreen_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- signup / payment / cancellation / ...
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false
);

-- ── RLS: deny-by-default from day one (emdb lesson: never ship an open anon write) ──

alter table categories enable row level security;
alter table series enable row level security;
alter table videos enable row level security;
alter table video_categories enable row level security;
alter table content_translations enable row level security;
alter table households enable row level security;
alter table profiles enable row level security;
alter table profile_content_overrides enable row level security;
alter table watch_progress enable row level security;
alter table people enable row level security;
alter table plans enable row level security;
alter table entitlements enable row level security;
alter table vouchers enable row level security;
alter table export_manifest enable row level security;
alter table uscreen_events enable row level security;

-- Public catalog read (published videos + categories/series) — everything else service-role only.
create policy "public read published videos" on videos for select using (status = 'published');
create policy "public read categories" on categories for select using (true);
create policy "public read series" on series for select using (true);
create policy "public read video_categories" on video_categories for select using (true);
create policy "public read translations" on content_translations for select using (true);
-- Household-member policies (profiles, overrides, watch_progress) land with Supabase Auth wiring
-- in Phase 3 — they need auth.uid() and are intentionally absent from this draft.
