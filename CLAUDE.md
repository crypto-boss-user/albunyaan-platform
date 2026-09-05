STATUS: canonical — Albunyaan platform (Uscreen→Bunny migration + admin)

# Albunyaan Platform (Uscreen exit — flagship)

Self-built OTT platform replacing Uscreen (app.uscreen.tv). pnpm monorepo.

## ⛔ Bunny-account GESTOPT (teambesluit 2026-09-02)
De eigenaar heeft het Bunny-account zelf gestopt: het volledige originelen-archief staat geverifieerd op de NAS (16.024/16.024, sha256), dus Bunny kostte alleen nog geld zonder functie.
- **Bunny is GEEN actieve dependency.** Geen taak, script of wachter mag nog van een levend Bunny-account uitgaan; niets uitvoeren richting Bunny.
- Saldo-bewaker `com.albunyaan.bunny-balance-watch` is uitgezet (plist → `~/Library/LaunchAgents/uitgeschakeld/`, harde stop in `bunny-balance-watch.py`).
- De kwaliteitsronde (`worker/requality-videos.ts`, ±$300) VERVALT. Bij de cutover vullen we het kijkplatform — Bunny óf een alternatief, keuze komt later — rechtstreeks vanuit het NAS-archief.
- `bunny_video_id`-links en showcase-play-links zijn dood: niets aan doen, maar **nergens meer als "werkend" rapporteren**.
- Wat doorgaat en Bunny niet raakt: de wachter (04:15), AS 6-hernummering, hygiëne. Details: memory `bunny-account-gestopt`.

## Commands
- Web dev: `cd apps/web && pnpm dev -p 3010` → localhost:3010
- Build check: `pnpm build`
- E2E (RV 2, B25): dev-server voor tests op **3012** — `cd apps/web && pnpm test` (Playwright-structuurtests, start zelf :3012) · `pnpm --filter @albunyaan/worker e2e` (de zes harnesses na elkaar; vereist lokale Supabase + Mailpit; playback-gate ⛔ B22 standaard overgeslagen)
- **NEVER use `npx`/`npm exec` for worker scripts** — they hang unpredictably. Always the direct binary: `node_modules/.bin/tsx worker/<script>.ts`

## Data & secrets
- Cloud Supabase project `albunyaan-platform` (ref hfqdewsybdoxlmjkjoie). Keys in `~/.albunyaan-cc/cloud.env` (600, NEVER commit): SUPABASE_URL/ANON/SERVICE_ROLE, BUNNY_LIBRARY_ID/API_KEY/CDN_HOST. Load with `set -a; source ~/.albunyaan-cc/cloud.env; set +a`.
- Catalog: 15,861 videos / 686 collections / 25 categories / 425 people. Published videos ≈197 (what the live site serves); the published *unit* is COLLECTIONS (~692), not videos.
- Scraped source data: `~/.albunyaan-cc/*.jsonl`. Nightly backup: LaunchAgent `com.albunyaan.catalog-backup` (03:30 → ~/Backups + OneDrive).
- Supabase REST clamps pages to 1000 rows — larger Range requests truncate SILENTLY. Always verify row counts.
- `worker/.env` holds LOCAL-DEV Supabase keys that fail silently against prod — real prod keys live in `apps/web/.env.local`. If a worker script "runs fine" but writes nothing, check which env it loaded.
- Brevo SMTP keys die after 90 days of no sending — re-test SMTP with a live email at cutover (see cutover gate 4 in `~/projects/MASTER-PLAN-ALBUNYAAN.md` and `docs/cutover-runbook.md`).

## Video migration (worker/migrate-videos.ts)
- Two-phase: `--harvest N` (sequential, ONE page, 1.8s delays — concurrent Uscreen admin loads trip hCaptcha) then `--transfer` (parallel ffmpeg pull from Mux HLS → curl -T upload to Bunny; Bunny cannot server-fetch Mux tokenized URLs).
- Mux HLS tokens live ~159 min. On transfer failure the code clears `uscreen_hls_url` so the video re-harvests fresh — don't "optimize" that away.
- Orchestrator: `~/.albunyaan-cc/migrate-overnight.sh` → `~/.albunyaan-cc/migrate.log`. Health check: `/migration-status` slash command. Hang signature: log stale 5+ min AND zero active ffmpeg children → SIGTERM the transfer child only (orchestrator self-heals); quiet log + active ffmpeg = healthy long-form, leave it.
- Use async `spawn`, never `spawnSync`, in anything with parallel workers (spawnSync blocks the event loop and silently serializes "parallel" workers). Elders (strikt sequentiële CLI-scripts) alleen met verantwoording in de commit-tekst én een commentaarregel bij de aanroep — B56 (F1, 2026-09-04); geen ombouw van de 17 bestaande scripts.
- brew installs/upgrades can break ffmpeg's dylibs mid-run → `brew reinstall ffmpeg`.

## Browser automation
- Twin Chrome (founder's cloned profile, Uscreen admin session): launch Chrome for Testing with `--remote-debugging-port=9333 --user-data-dir="$HOME/.albunyaan-cc/chrome-emdb-clone"`, drive via chrome-devtools MCP. Session expires — founder re-login needed for admin scraping. Never close the LAST page in the shared browser (breaks connectOverCDP).

## Rules
- RLS is deny-by-default; data layer is service-role-only BY DESIGN — real policies + auth required before ANY public deploy.
- Player renders Bunny iframe when `videos.bunny_video_id` set; falls back to poster. Sinds 2026-09-02 is het Bunny-account gestopt → die iframes spelen niet meer; code blijft ongemoeid tot het opvolger-platform gekozen is (zie ⛔ hierboven).
- Docs hub: `~/projects/albunyaan-funnel/docs/` (program plan, decisions, PRDs). Session memory: `~/.claude/projects/-Users-a2020-projects-albunyaan-platform/memory/` (index: `MEMORY.md`). Older notes up to 2026-07-12 live in `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/albunyaan-platform-rebuild.md` — archive, not current state.

## Werkregels (review-pipeline, RV 2 2026-09-04 — bij tegenspraak wint de rest van dit bestand; skill `review-pipeline` = de norm)
1. Check in vóór je begint: aannames expliciet, meerdere lezingen benoemen, terugduwen als het simpeler kan, stoppen bij onduidelijkheid. Eerste schrijfactie = founder-ja alleen buiten het mandaat van gouden regel 10/B61 (archief-originelen, launchd, ~/.claude, DNS, Stripe, elke schrijfactie richting Uscreen, geld, onomkeerbaar, leden/betalingen/juridisch, CLAUDE.md); binnen repo, var/, ~/projects/_scratch, reference/ en de NAS-map storefront-referentie/ zonder vraag, met aanname-markering. Nooit stil starten.
2. Leg elke stap op hoofdlijnen uit; de founder hoeft de diff niet te lezen om te weten wat er gebeurde.
3. Minimaal en chirurgisch: alleen wat de taak vraagt; geen speculatieve features, abstracties of config; niets "verbeteren" naast de taak; eigen wezen opruimen, andermans dode code alleen melden. Vaste uitzondering (B47): fail-closed-paden, tellingscontroles en opruimcode zijn nooit bloat — ook niet als ze nieuw zijn; hooguit een vraag (change-control regel 4, MODEL FITNESS).
4. Oorzaak, geen pleister: grep elke aanroeper vóór je een functie aanraakt. Ligt de oorzaak in een MODEL-FITNESS-gebied, dan eerst het stop-protocol van `albunyaan-change-control` (B48: geen aparte modelregel hier).
5. Doelgericht: formuleer het succescriterium vóór je bouwt (test/telling/command-uitvoer) en loop tot het groen is. Bewijs is geplakte uitvoer, geen bewering.
6. Na elke wijziging van repo-bestanden: de review-pipeline (skill `review-pipeline`), zwaarte per tier (T0/T1 = stappen 2, 3, 6; T2/T3 = 1–9). Een stap die niet kan draaien wordt luid gemeld: welke, waarom, wat in plaats daarvan. Nooit stil overslaan. Eerste regel van elke commit-tekst: `Review-log:` (B50; docs-only = `Review-log: n.v.t. — <reden>`).
7. Gedelegeerd werk erft niets: elke subagent-brief herhaalt regels 3–6, de baseline die niet mag regresseren, de bestanden die hij niet mag aanraken, en dat hij niet commit/pusht/installeert (B46).
