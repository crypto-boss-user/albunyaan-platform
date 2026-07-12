-- 0005_live_watch.sql — WS2: live-channel source fields + per-profile watch progress.
--
-- Purpose: (a) videos with status 'live' (0002 widened the CHECK) need a stream
-- source; (b) resume-watching needs per-profile progress. Both additive.
--
-- Founder-pending: none. live_stream_url / live_provider are intentionally NOT
-- exposed to clients (0006 column grants exclude them) — playback URLs are
-- resolved server-side.
--
-- Conventions unchanged: text + CHECK, never enums; RLS ON, ZERO policies here
-- (the watch_progress read policy arrives in 0006).

-- ── videos: live source ─────────────────────────────────────────────────────

alter table videos add column live_stream_url text;
alter table videos add column live_provider text
  check (live_provider in ('external', 'bunny', 'vps') or live_provider is null);

-- ── watch progress (per kid/adult profile, not per person) ─────────────────

create table watch_progress (
  profile_id uuid not null references profiles (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  progress_seconds integer not null default 0,
  duration_seconds integer, -- denormalized at write time for cheap % complete
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);

alter table watch_progress enable row level security;
-- Intentionally NO policies here: household-scoped SELECT lands in 0006;
-- writes stay server-side (service role) so limits/parental rules apply.
