-- 0013_structure_fidelity.sql — faithful Uscreen structure + video extras.
--
-- WHY (audit 2026-08-06, browser-verified against the live Uscreen admin):
--   • Category contents on Uscreen are a MANUALLY ORDERED, MIXED list of
--     videos and collections ("Website displays category content in the order
--     shown below"). Our video_categories link table has no order and cannot
--     hold collections → the new site re-sorts categories alphabetically.
--   • 174 of 197 standalone published videos (films, app pages) hang in NO
--     collection and NO category → unreachable by browsing.
--   • descriptions / short descriptions / resources (downloadable files) /
--     subtitles / tags were NEVER scraped: all 15,861 rows empty.
--   • The transfer pipeline copied the SECOND-best rendition of every video
--     (ffmpeg -map 0:p:1 on a best-first Mux master) → whole library is one
--     quality rung below the original. Columns below track original vs stored
--     height so the re-transfer can be targeted and audited.
--
-- Conventions follow 0001: external_id + source + raw + unique(source,external_id),
-- RLS on with zero policies (service-role only).

-- ── ordered, mixed category contents (mirror of Uscreen "Manage content") ──
create table category_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null, -- '<categoryExt>:video:<vidExt>' | '<categoryExt>:collection:<collExt>'
  source text not null default 'uscreen',
  raw jsonb,
  category_id uuid not null references categories(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  check (num_nonnulls(video_id, collection_id) = 1)
);
create index category_items_order_idx on category_items (category_id, position);
alter table category_items enable row level security;

-- ── category-level ordering as Uscreen stores it ───────────────────────────
alter table categories add column if not exists position integer;          -- site-nav order (categories.show .position)
alter table categories add column if not exists content_sort text;         -- 'manual' | 'newest' | ... (categories.show .content_sort)

-- ── video extras (from bullet_api videos.details) ──────────────────────────
alter table videos add column if not exists tags jsonb not null default '[]';        -- search keywords
alter table videos add column if not exists uscreen_permalink text;                  -- storefront permalink (redirect map + comment matching)
alter table videos add column if not exists original_max_height integer;             -- best rendition Uscreen/Mux serves (ffprobe at transfer)
alter table videos add column if not exists bunny_height integer;                    -- stored height at Bunny (poll) — < original_max_height ⇒ downgraded copy

-- ── comments (ta3lieqaat) — harvested from the storefront video pages ─────
create table video_comments (
  id uuid primary key default gen_random_uuid(),
  external_id text not null, -- Uscreen comment id, or '<videoExt>:<n>' fallback (importer records which)
  source text not null default 'uscreen',
  raw jsonb,
  video_id uuid not null references videos(id) on delete cascade,
  author_name text,
  body text not null,
  commented_at timestamptz,
  position integer, -- original display order within the video, top = 0
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index video_comments_video_idx on video_comments (video_id, position);
alter table video_comments enable row level security;

-- ── manifest status for the quality re-transfer ────────────────────────────
-- requality-videos.ts records 'quality_ok' (probed original ≤ stored copy —
-- nothing to redo). Same widen-the-CHECK dance as 0011.
alter table export_manifest drop constraint export_manifest_status_check;
alter table export_manifest add constraint export_manifest_status_check
  check (status in ('pending', 'fetched', 'parsed', 'upserted', 'failed', 'done', 'skip_no_hls', 'quality_ok'));

-- Intentionally NO policies (0001 convention): deny-by-default, service-role only.
