-- Member-visible flag for the transfer-queue reorder (founder-ratified
-- 2026-07-22, MASTER-PLAN v2.3 Phase 2; evidence: migration-truth.md).
-- The member-facing unit is the published COLLECTION: 15,180 videos are
-- watchable by paying members today (15,002 inside published collections
-- + 178 standalone published), while videos.status='published' covers only
-- 197. Harvest/transfer ordering switches from status-first to
-- member_visible-first (smallest-first within each tier stays unchanged).
-- Populated idempotently by worker/set-member-visible.ts from the collection
-- scrapes (~/.albunyaan-cc/uscreen-collection-{status,members}.jsonl).
-- No column grant for anon/authenticated: service-role/worker use only.
alter table videos add column if not exists member_visible boolean not null default false;
-- Harvest picks: unmigrated, unharvested, member-visible first, shortest first.
create index if not exists videos_migration_queue_idx
  on videos (member_visible desc, duration_seconds asc)
  where bunny_video_id is null;
