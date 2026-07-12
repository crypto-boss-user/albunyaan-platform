-- Widen export_manifest.status for the video migration.
-- migrate-videos.ts writes 'done' (Bunny encode verified) and 'skip_no_hls'
-- (two-strike stream-less skip), both rejected by the 0001 CHECK. setManifest()
-- swallowed the upsert error, so neither status ever persisted: poll()'s
-- done-skip set always came back empty and every poll round re-polled the
-- entire migrated library (the 2026-07-11 poll-starvation fix was inert).
alter table export_manifest drop constraint export_manifest_status_check;
alter table export_manifest add constraint export_manifest_status_check
  check (status in ('pending', 'fetched', 'parsed', 'upserted', 'failed', 'done', 'skip_no_hls'));
