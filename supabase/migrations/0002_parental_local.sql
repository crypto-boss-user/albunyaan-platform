-- 0002_parental_local.sql — additive migration for the local parity clone.
-- Adds (a) what the storefront needs on videos (live status, age rating, placeholder
-- poster hue) and (b) the household/parental tables per the PRD household model
-- (compatible with the shapes drafted in supabase/drafts/0001_init.draft.sql).
--
-- Deviation (founder-approved): the videos.status CHECK from 0001 is WIDENED to
-- accept 'live' for live TV channels. Everything else is purely additive.
--
-- RLS convention unchanged: RLS ON, ZERO policies = deny-by-default.
-- The service role (server components / server actions / workers) is the only reader/writer.

-- ── videos: live status + storefront fields ────────────────────────────────

alter table videos drop constraint videos_status_check;
alter table videos add constraint videos_status_check
  check (status in ('draft', 'published', 'scheduled', 'live'));

alter table videos add column age_rating text not null default 'all'
  check (age_rating in ('all', '7+', '13+', '16+'));

-- Placeholder poster color (no imagery yet → trivially manhaj-safe, mirrors v0).
alter table videos add column thumbnail_hue integer;

-- ── household / parental model ──────────────────────────────────────────────

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null, -- sha256 hex of the parent PIN; verified server-side only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null check (kind in ('adult', 'kid')),
  name text not null,
  age_band text check (age_band in ('4-6', '7-9', '10-12', '13+')), -- kid profiles only
  avatar_hue integer not null default 140,
  daily_limit_minutes integer, -- kid profiles only, null = no limit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_household_idx on profiles (household_id);

-- Per-kid-profile override: block wins over everything; allow wins over the
-- age-band filter (semantics: packages/core/src/parental.ts canWatch()).
-- target_kind 'collection' plays the role of the domain-level 'series' target.
create table content_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('video', 'collection')),
  target_id uuid not null,
  action text not null check (action in ('block', 'allow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, target_kind, target_id)
);
create index content_overrides_profile_idx on content_overrides (profile_id);

-- ── RLS: deny-by-default, service-role only (same as 0001) ─────────────────

alter table households enable row level security;
alter table profiles enable row level security;
alter table content_overrides enable row level security;

-- Intentionally NO policies. Public/authenticated policies arrive in Phase 3+
-- in their own migration, never here.
