# Worker — migration & sync jobs (stubs)

Phase 1/2/6 jobs live here. All stubs until the PRDs are approved.

| Job | Source pattern to port | Guard |
|---|---|---|
| `uscreen-export.ts` | `~/projects/albunyaan-command-center/worker/uscreen-scraper.ts` (persisted session `~/.albunyaan-cc/uscreen-storageState.json`, fail-honest statuses) | **Do not run at scale before the Uscreen contract is reviewed (Phase 0)** |
| `bunny-uploader.ts` | new — create video → upload → poll encode → verify signed playback → mark `verified` in `export_manifest` | Needs Bunny account (not created yet) |
| `webhook-ingest.ts` | Uscreen webhooks → `uscreen_events` table | Needs deployed endpoint |
| `dunning.ts` | Brevo dunning sequence trigger patterns in `~/Marketing-Pipelines-Albunyaan` | Phase 3+ |
