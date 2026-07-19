STATUS: canonical — Albunyaan platform (Uscreen→Bunny migration + admin)

# Albunyaan Platform (Uscreen exit — flagship)

Self-built OTT platform replacing Uscreen (app.uscreen.tv). pnpm monorepo: `packages/core` (domain types, parental logic), `apps/web` (Next.js 16 + Tailwind 4), `worker/` (scrapers, importers, migration pipelines), `supabase/migrations`.

## Commands
- Web dev: `cd apps/web && pnpm dev -p 3010` → localhost:3010
- Build check: `pnpm build`
- **NEVER use `npx`/`npm exec` for worker scripts** — they hang unpredictably. Always the direct binary: `node_modules/.bin/tsx worker/<script>.ts`

## Data & secrets
- Cloud Supabase project `albunyaan-platform` (ref hfqdewsybdoxlmjkjoie). Keys in `~/.albunyaan-cc/cloud.env` (600, NEVER commit): SUPABASE_URL/ANON/SERVICE_ROLE, BUNNY_LIBRARY_ID/API_KEY/CDN_HOST. Load with `set -a; source ~/.albunyaan-cc/cloud.env; set +a`.
- Catalog: 15,861 videos / 686 collections / 25 categories / 425 people. Published videos ≈197 (what the live site serves); the published *unit* is COLLECTIONS (~692), not videos.
- Scraped source data: `~/.albunyaan-cc/*.jsonl`. Nightly backup: LaunchAgent `com.albunyaan.catalog-backup` (03:30 → ~/Backups + OneDrive).
- Supabase REST clamps pages to 1000 rows — larger Range requests truncate SILENTLY. Always verify row counts.

## Video migration (worker/migrate-videos.ts)
- Two-phase: `--harvest N` (sequential, ONE page, 1.8s delays — concurrent Uscreen admin loads trip hCaptcha) then `--transfer` (parallel ffmpeg pull from Mux HLS → curl -T upload to Bunny; Bunny cannot server-fetch Mux tokenized URLs).
- Mux HLS tokens live ~159 min. On transfer failure the code clears `uscreen_hls_url` so the video re-harvests fresh — don't "optimize" that away.
- Orchestrator: `~/.albunyaan-cc/migrate-overnight.sh` → `~/.albunyaan-cc/migrate.log`. Health check: `/migration-status` slash command. Hang signature: log stale 5+ min AND zero active ffmpeg children → SIGTERM the transfer child only (orchestrator self-heals); quiet log + active ffmpeg = healthy long-form, leave it.
- Use async `spawn`, never `spawnSync` in worker code (spawnSync blocks the event loop and silently serializes "parallel" workers).
- brew installs/upgrades can break ffmpeg's dylibs mid-run → `brew reinstall ffmpeg`.

## Browser automation
- Twin Chrome (founder's cloned profile, Uscreen admin session): launch Chrome for Testing with `--remote-debugging-port=9333 --user-data-dir="$HOME/.albunyaan-cc/chrome-emdb-clone"`, drive via chrome-devtools MCP. Session expires — founder re-login needed for admin scraping. Never close the LAST page in the shared browser (breaks connectOverCDP).

## Rules
- RLS is deny-by-default; data layer is service-role-only BY DESIGN — real policies + auth required before ANY public deploy.
- Player renders Bunny iframe when `videos.bunny_video_id` set; falls back to poster. No code change needed as migration progresses.
- Docs hub: `~/Funnel-Albunyaan-Upgrade/docs/` (program plan, decisions, PRDs). Session memory: `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/albunyaan-platform-rebuild.md`.
