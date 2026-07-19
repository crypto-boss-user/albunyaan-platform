-- 0001_data_liberation.sql — Phase 1 "Data Liberation" schema.
-- Source of truth per PRD §5: ~/projects/albunyaan-funnel/docs/prd/phase-1-data-liberation.md
--
-- STATUS: FILE ONLY — do NOT apply to any live project yet (no Supabase project exists;
-- creation is gated on founder approval / Phase 0). The earlier overnight scaffold draft
-- (households/profiles/parental tables, Phase 3 scope) was re-homed to
-- supabase/drafts/0001_init.draft.sql so it can never collide with this migration.
--
-- Conventions (API_CONTRACT.md): money in cents, timestamps timestamptz (UTC),
-- IDs opaque strings. Every IMPORTED table carries:
--   external_id text  — Uscreen's ID (or the documented fallback key)
--   source text       — default 'uscreen'
--   raw jsonb         — the untouched source record (CSV row / API JSON / parsed page)
--   unique (source, external_id) — all importers upsert on this; reruns are idempotent.
--
-- RLS: ON for every table, ZERO policies = deny-by-default for anon/authenticated.
-- The service role bypasses RLS, so workers/Edge Functions (service key) are the only
-- writers/readers. No public surface exists in Phase 1 — do not add policies here.

create extension if not exists "pgcrypto";

-- ── content ────────────────────────────────────────────────────────────────

create table videos (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  title text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '', -- rich-text HTML as Uscreen stores it
  thumbnail_url text,
  duration_seconds integer,
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  publish_at timestamptz,
  access text not null default 'subscription' check (access in ('free', 'subscription')),
  -- Uscreen's own playback URLs, captured for Phase 2/6 download planning (PRD §3):
  uscreen_video_url text,
  uscreen_hls_url text,
  -- filled in Phase 2/6 (API_CONTRACT forward-compat):
  bunny_video_id text unique,
  resources jsonb not null default '[]',        -- attached files/PDFs
  subtitle_tracks jsonb not null default '[]',
  audio_tracks jsonb not null default '[]',
  seo jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index videos_status_idx on videos (status);

create table categories (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  title text not null,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

-- Ordered membership — ordering drives browse UX later (PRD §3).
create table collection_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null, -- Uscreen item id, or '<collection>:<video>' fallback (importer records which)
  source text not null default 'uscreen',
  raw jsonb,
  collection_id uuid not null references collections(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  unique (collection_id, video_id)
);
create index collection_items_order_idx on collection_items (collection_id, position);

-- Custom filters, e.g. type=lecture, subject=fiqh (API_CONTRACT §3.9).
create table filters (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table filter_values (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  filter_id uuid not null references filters(id) on delete cascade,
  value text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  unique (filter_id, slug)
);

create table video_filter_values (
  video_id uuid not null references videos(id) on delete cascade,
  filter_value_id uuid not null references filter_values(id) on delete cascade,
  primary key (video_id, filter_value_id)
);

create table authors (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  name text not null,
  slug text not null unique,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table video_authors (
  video_id uuid not null references videos(id) on delete cascade,
  author_id uuid not null references authors(id) on delete cascade,
  primary key (video_id, author_id)
);

create table video_categories (
  video_id uuid not null references videos(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (video_id, category_id)
);

-- ── audience ───────────────────────────────────────────────────────────────

create table people (
  id uuid primary key default gen_random_uuid(),
  external_id text not null, -- Uscreen User ID (People export has it on every row)
  source text not null default 'uscreen',
  raw jsonb,
  email text not null unique, -- normalized: trimmed + lowercased by the importer
  full_name text,
  language text not null default 'en',
  stripe_customer_id text unique,
  legacy_cohort text, -- null | 'uscreen_paying' | 'uscreen_free_api' | 'uscreen_iap' (Phase 9 cohorts)
  signup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  title text not null,
  description text not null default '',
  platform text not null default 'web' check (platform in ('web', 'ios', 'android', 'tv')),
  amount_cents integer not null, -- money in cents, always
  currency text not null default 'EUR',
  billing_period text not null check (billing_period in ('monthly', 'quarterly', 'semiannual', 'yearly', 'onetime')),
  trial_days integer not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  stripe_price_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- The People CSV export has no subscription id; the importer uses the person's
  -- User ID as external_id and records that choice (PRD §4c: record which key was used).
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  person_id uuid references people(id) on delete cascade,
  plan_id uuid references plans(id),
  plan_title text, -- verbatim plan string from the export until plans are linked
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'churned')),
  started_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  churned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);
create index subscriptions_person_idx on subscriptions (person_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  -- Lead export shape unverified (PRD §9 Q6); if it lacks an ID, the importer
  -- falls back to the normalized email as external_id and records that.
  external_id text not null,
  source text not null default 'uscreen',
  raw jsonb,
  email text not null unique, -- normalized
  full_name text,
  captured_at timestamptz,
  source_tag text, -- winback segmentation (PRD §9 Q6)
  utm jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

-- ── live sync + migration bookkeeping ──────────────────────────────────────

-- Store-first webhook inbox (PRD §6): every delivery lands here raw, always.
create table uscreen_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique, -- idempotency key (Uscreen delivery/event id, or payload hash fallback)
  event_type text not null,
  external_id text, -- the Uscreen object the event is about, when extractable
  payload jsonb not null, -- raw payload, always kept
  status text not null default 'stored' check (status in ('stored', 'processed', 'unhandled', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index uscreen_events_status_idx on uscreen_events (status);

-- Resumable export manifest (PRD §4b): one row per item, two-stage export.
-- Crash/expiry mid-run → rerun picks up pending/failed only.
create table export_manifest (
  id uuid primary key default gen_random_uuid(),
  entity text not null, -- 'videos' | 'categories' | 'collections' | 'people' | ...
  external_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'fetched', 'parsed', 'upserted', 'failed')),
  attempts integer not null default 0,
  last_error text,
  raw_path text, -- raw HTML/JSON saved to disk BEFORE parsing; parser fixes never re-fetch
  updated_at timestamptz not null default now(),
  unique (entity, external_id)
);
create index export_manifest_todo_idx on export_manifest (entity, status);

-- ── RLS: deny-by-default, service-role only (emdb lesson: never an open anon surface) ──
-- Enabling RLS with NO policies denies everything to anon/authenticated roles.
-- The service role bypasses RLS — that is the ONLY intended access path in Phase 1.

alter table videos enable row level security;
alter table categories enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table filters enable row level security;
alter table filter_values enable row level security;
alter table video_filter_values enable row level security;
alter table authors enable row level security;
alter table video_authors enable row level security;
alter table video_categories enable row level security;
alter table people enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table leads enable row level security;
alter table uscreen_events enable row level security;
alter table export_manifest enable row level security;

-- Intentionally NO policies: deny-by-default. Public catalog policies arrive in Phase 3+
-- in their own migration, never here.
