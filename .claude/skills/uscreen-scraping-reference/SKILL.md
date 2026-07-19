---
name: uscreen-scraping-reference
description: >
  Domain reference for scraping Uscreen (app.uscreen.tv), the SOURCE platform of the
  Albunyaan exit — twin-Chrome CDP setup on :9333, hCaptcha avoidance, Mux HLS token
  mechanics, Playwright storageState, fail-honest selector discipline, and the full
  worker/ scraper + pipeline-shell inventory. Load this skill whenever a session must
  understand, run, resume, or fix ANY script that reads from the Uscreen admin:
  enumerate-videos.mjs, scrape-*.mjs, grab-structure.mjs, capture-hls.mjs,
  import-uscreen-catalog.ts, mirror-thumbnails/covers, uscreen-login/scraper/export;
  or whenever it sees "LOGGED OUT", "SESSION LOST", "login_lost", "scrape_broken",
  hCaptcha, connectOverCDP errors ("Browser context management is not supported"),
  stream.mux.com token questions, or ~/.albunyaan-cc/uscreen-*.jsonl files.
  NOT for operating the video migration loop (albunyaan-migration-runbook), debugging
  a live migration failure (albunyaan-migration-debugging-playbook), Bunny API work
  (bunny-operations), or DB schema questions (albunyaan-data-and-schema-reference).
---

# Uscreen scraping reference

Uscreen (`app.uscreen.tv`, storefront `albunyaan.tv`) is the platform Albunyaan is
migrating OFF of. It is still **the live business**: real members watch it today.
Every script in this skill is **READ-ONLY against Uscreen**. Never change a Uscreen
setting, never publish/unpublish, never delete, never trigger destructive admin
actions. If a task seems to require writing to Uscreen, stop and ask the founder.

Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` before doing anything in
this repo; nothing here overrides it.

## Definitions (each defined once)

| Term | Meaning |
|---|---|
| **CDP** | Chrome DevTools Protocol. Playwright's `chromium.connectOverCDP('http://127.0.0.1:9333')` attaches to an already-running Chrome instead of launching one. |
| **Twin Chrome** | A Chrome for Testing instance running the founder's *cloned* profile (`~/.albunyaan-cc/chrome-emdb-clone`) with the Uscreen admin session logged in, exposing CDP on port 9333. All `.mjs` scrapers attach to it. |
| **storageState** | Playwright's saved cookies/localStorage JSON (`~/.albunyaan-cc/uscreen-storageState.json`). Lets *headless, self-launched* browsers reuse the admin login without the twin Chrome. |
| **Mux** | Uscreen's video backend. Streams are HLS manifests at `stream.mux.com/<playbackId>.m3u8?token=<JWT>`. |
| **HLS** | HTTP Live Streaming — a `.m3u8` playlist of video segments; ffmpeg can pull it into an mp4. |
| **hCaptcha** | Uscreen's bot-detection challenge. Once tripped, admin pages stop serving content to the session. |
| **Harvest** | Phase 1 of `worker/migrate-videos.ts`: visit a video's admin details page, sniff its tokenized Mux HLS URL, store it in `videos.uscreen_hls_url`. |
| **export_manifest** | Supabase table tracking per-entity migration status (lifecycle `pending/fetched/failed/skip_no_hls/done` — all statuses persist since 2026-07-12, migration 0011; `done`/`skip_no_hls` counts stay 0 until the next poll/harvest writes them, see `albunyaan-data-and-schema-reference`, RESOLVED mismatch section), keyed `(entity, external_id)`. |
| **`~/.albunyaan-cc/`** | Operational state dir (not a repo): logs, scraped JSONL, orchestration shells, chmod-600 secret env files. **Never read/quote the `.env` files** — reference by name only. `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS; `BUNNY_API_KEY` can delete the whole video library. |

## 1. The twin-Chrome setup

### Launch (single home: `albunyaan-build-and-env` §7)

The twin-Chrome launch command lives in ONE place — **`albunyaan-build-and-env` §7** —
which also documents how to resolve the `chromium-*` version-dir path drift after a
playwright upgrade (a hardcoded copy of the command goes stale silently). Launch per
that skill, then verify below.

- `chrome-emdb-clone` is a clone of the founder's personal Chrome profile ("EMDB"
  profile) with the Uscreen admin session cookies in it. Do not delete or re-clone it
  without the founder.
- Chrome for Testing is used deliberately: installed Chrome (channel `'chrome'`)
  silently ignores several automation flags on recent versions.

### Verify before scraping (silent-failure trap)

A launched-but-broken browser produces no error. Always read back state:

```bash
curl -s --max-time 3 http://127.0.0.1:9333/json/version   # non-empty JSON = CDP up
curl -s --max-time 5 http://127.0.0.1:9333/json/list | head -c 600  # tabs visible?
```

Then confirm the session is live: navigate any tab to
`https://app.uscreen.tv/manage/home` — if it redirects to a login page, the session
has expired.

### Session expiry → founder re-login

The Uscreen admin session in the cloned profile expires periodically (and 2FA means
no script can restore it). Every scraper detects this the same way — the page URL
contains `login` after navigation — and **stops loudly** (`LOGGED OUT`, `SESSION
LOST`, or `login_lost`). The only fix: the **founder** logs in manually inside the
twin Chrome window (it is headed — a real window on the Mac), then scrapers resume.
`migrate-overnight.sh` polls for session restoration every 5 min for up to 2 h; the
standalone scrapers just exit.

The migration watchdog (`~/.albunyaan-cc/migration-watchdog.sh`) also runs TAB-GC
against :9333 — see albunyaan-migration-runbook. It is why stray Uscreen tabs vanish.

## 2. connectOverCDP rules (hard-learned)

1. **NEVER close the LAST open page** in the shared browser. Doing so broke
   Playwright's `connectOverCDP` handshake for *every* future script ("Browser
   context management is not supported") until a page was reopened via the raw CDP
   HTTP API (`curl -X PUT 'http://127.0.0.1:9333/json/new?about:blank'` — PUT is
   required on Chrome 111+). Scripts that close their own tab at the end are only
   safe because another tab exists; the watchdog's TAB-GC opens `about:blank`
   *before* closing anything for exactly this reason.
2. **Park, don't close.** `migrate-videos.ts --harvest` reuses an existing tab
   (prefers a parked `about:blank` tab, then any Uscreen tab, only then `newPage()`)
   and at the end navigates it to `about:blank` instead of closing it. Uscreen admin
   pages auto-load a Mux player (~150–300 MB per tab); leaving tabs open all night
   filled application memory until macOS showed its force-quit dialog (2026-07-09).
   New scrapers should copy the reuse-then-park pattern, not `newPage()`-and-abandon.
3. **`process.exit(0)` on success is mandatory.** `connectOverCDP()` holds an open
   WebSocket that keeps Node's event loop alive forever; a finished run once sat as
   a zombie for 44+ min, fighting other scripts for the shared browser (the likely
   hCaptcha trigger that night), and stalled the orchestrator because `| tee` blocks
   on process exit, not on output ending. Every `.mjs` scraper ends with
   `process.exit(0)`.
4. **One admin scraper at a time.** Two scripts driving the same session in parallel
   look like a bot. `scrape-member-status.mjs` and `scrape-analytics.mjs` enforce
   this with a guard: they `pgrep -f "migrate-videos.ts --harvest"` and refuse to
   run (exit 2) if harvest is active, unless `SKIP_GUARD=0` (do not set that).
   Founder-approved pattern (2026-07-11): pause migration → run the other scraper →
   resume. Copy the guard into any new admin scraper.

## 3. hCaptcha avoidance

Uscreen's bot detection tripped an hCaptcha once 3–4 admin video-detail pages loaded
concurrently. Once tripped, the session is useless until it clears. The discipline
that has kept it away since:

- **Sequential only.** One page, one navigation at a time. Harvest is sequential BY
  DESIGN; only the browser-free `--transfer` phase is parallel.
- **1800 ms politeness delay** between harvested videos (`page.waitForTimeout(1800)`
  in `migrate-videos.ts`). List-page scrapers use 1100–1500 ms between navigations;
  the storageState scraper base uses `POLITENESS_MS = 2000`.
- **2600 ms settle wait** after `domcontentloaded` on a video details page before
  reading the sniffed HLS URL — the Mux player needs time to request its manifest.
- No retry storms: failures are recorded in `export_manifest` and moved past, never
  hammered.

Do not shrink these numbers to "speed things up". The delays are the price of the
entire migration continuing to work.

## 4. Mux HLS token mechanics (why the pipeline is shaped this way)

- The admin video details page (`https://app.uscreen.tv/manage/videos/<id>/details`)
  auto-loads a Mux player. Harvest sniffs the manifest request with a response
  listener matching:

  ```js
  /stream\.mux\.com\/[^?]+\.m3u8\?token=/
  ```

- The `token=` value is a JWT; its `exp` claim gives the expiry.
  `migrate-videos.ts:tokenExpSec()` decodes it (base64url payload → `claims.exp`).
  Observed life: **~159 minutes**.
- **Bunny cannot server-side fetch tokenized Mux URLs** (Bunny's fetch arrives from
  Bunny's IPs without the browser context; it 403s). Hence the local pull:
  `ffmpeg -hide_banner -loglevel error -i <hls> -map 0:p:1 -sn -c copy -y <tmp.mp4>`
  then an upload to Bunny — every video crosses the founder's metered 400 GB bundle
  TWICE (down + up), which is why ordering is smallest-first (see
  albunyaan-migration-runbook / bunny-operations).
- Expired tokens caused the 0-byte-orphan disaster (5,042 × 403s; 97% of the Bunny
  library empty on 2026-07-10 — settled, fixed). The fixes live in
  `worker/migrate-videos.ts` and must not be "optimized" away:
  - **Preflight**: `--transfer` bulk-clears `uscreen_hls_url` for any token expiring
    within 5 min, so those videos re-harvest instead of burning a
    createVideo → ffmpeg-403 → deleteVideo round trip.
  - **On failure**: delete the empty Bunny placeholder AND null `uscreen_hls_url`
    (harvest skips rows that already have a URL; a stale token never gets fresher).
  - **ffmpeg timeout = token's remaining life** minus a 5-min upload margin (floor
    10 min, cap 150 min) — a fixed 40-min timeout SIGKILLed long lectures 634 times.
- One-off capture for debugging: `worker/capture-hls.mjs` (hardcoded to video
  4255266; edit the id) writes the sniffed URL to `/tmp/hls-url.txt`.

## 5. Playwright storageState (headless flows, no twin Chrome)

A second, independent auth path for *headless* scrapers that launch their own
browser instead of attaching to :9333:

- **Capture**: `worker/uscreen-login.ts` — headed login. Run from `worker/`:
  `node_modules/.bin/tsx uscreen-login.ts`. Sign in manually (incl. 2FA); it waits
  up to 5 min for a signed-in `/manage` page, then saves
  `~/.albunyaan-cc/uscreen-storageState.json` (override path with
  `USCREEN_STORAGE_STATE`). NOTE: the file's comment says
  `pnpm --filter @albunyaan/worker uscreen:login` — that script does **not** exist
  in `worker/package.json` (verified 2026-07-12); use the tsx command above.
- **Use**: `worker/uscreen-scraper.ts` exports `openAdminSession(startUrl)` — loads
  the storageState into a headless Chrome, verifies actual sign-in (login-URL
  redirect or a visible password field ⇒ `login_lost`), and returns `{browser,
  page}`. Status trail appends to `worker/state/scrape-status.jsonl`.
- **Quick session probe**: `worker/check-session` — ESM script (extensionless) that
  loads the storageState into a headless browser and prints the URL/title it lands
  on at `https://albunyaan.tv/publisher/dashboard` (login redirect = expired). Its
  historical invocation is UNVERIFIED (extensionless ESM needs a module-type hint to
  run under plain `node`); treat it as reference code and prefer `openAdminSession`
  or the twin-Chrome check in §1.
- The storageState file is shared with the command-center metrics scraper
  (`~/projects/albunyaan-command-center` — a separate honesty dashboard; it does NOT
  run the migration).

The twin Chrome (§1) and storageState are separate sessions; re-logging into one
does not refresh the other.

## 6. Fail-honest selector discipline

Design rule kept verbatim from the original scraper base and enforced everywhere:
**scrapers fail honest, never guess.**

- Selector self-check: `probeText(page, candidates)` in `worker/uscreen-scraper.ts`
  tries candidate selectors in order; if none yields non-empty text it returns
  `null` and the caller MUST mark the item `scrape_broken` — never write a zero,
  blank, or guessed value.
- `worker/uscreen-export.ts` saves **raw HTML/JSON to disk BEFORE parsing**
  (`worker/raw/<entity>/<id>.html|.json`), so fixing a selector never re-fetches.
- Zero matches on list page 1 ⇒ `scrape_broken` (layout changed); zero matches on a
  later page ⇒ end of pagination. That asymmetry is deliberate.
- Session loss ⇒ `login_lost`, loud, never silently retried.
- Real-world example of the discipline: `scrape-member-status.mjs` extracts status
  per table CELL, never by regexing the whole row text (a row can contain a name
  that matches a status word). Uscreen's People pagination renders as BUTTONS with
  no hrefs — it reads the count from the pagination bar text ("More pages N") while
  URL `?page=N` navigation still works.

When a selector breaks: capture the page HTML first, update the selector, re-run on
one item under supervision, then resume — never widen a selector "to be safe".

## 7. Script inventory (worker/, all verified present 2026-07-12)

All `.mjs` scrapers attach to the twin Chrome (`connectOverCDP :9333`) and run from
`worker/` with plain `node <script>.mjs`. All `.ts` scripts run with
`node_modules/.bin/tsx <script>.ts` — **NEVER `npx`/`npm exec`** (hangs
unpredictably; CLAUDE.md rule).

### Enumeration & structure (CDP)

| Script | Reads | Writes | Notes |
|---|---|---|---|
| `enumerate-videos.mjs` | `/manage/videos?page=N` (1,322 pages) | `~/.albunyaan-cc/uscreen-videos-rich.jsonl` (id, title, thumb, duration, status) | Resumable: page cursor in `~/.albunyaan-cc/enum-page.txt` (currently `1322` = complete), dedupes by id already in the JSONL. 1400 ms/page. Prints `ENUM_DONE`. |
| `grab-structure.mjs` | categories/collections/authors/filters/plans/people list pages | `~/.albunyaan-cc/uscreen-structure/*.json` | One-shot broad survey; loose selectors, exploratory quality. |
| `scrape-full-collections.mjs` | `/manage/contents/collections?page=N` | `uscreen-collections-list-full.json` | Walks up to 60 pages, stops after 2 empty pages. |
| `scrape-collections.mjs` | collections list + each details page | extends list, appends `uscreen-collection-members.jsonl` | Older combined list+membership pass; superseded by full-list + all-members. |
| `scrape-all-members.mjs` | each collection's details page (from the full list) | `uscreen-collection-members.jsonl` (id, title, ordered videoIds) | Resumable (skips ids already in output). THE membership source for import. |
| `scrape-coll-members.mjs` | same, from the SHORT list | same file (**truncates it first!**) | Legacy; `fs.writeFileSync(OUT,'')` wipes the file — do not run casually. |
| `scrape-categories.mjs` | `/manage/categories` + each `/edit` | `uscreen-categories-list.json`, `uscreen-category-members.jsonl` (**truncates**) | Category → direct video ids. |
| `scrape-cat-collections.mjs` | each category `/edit` page | `uscreen-category-collections.jsonl` (**truncates**) | Category → collection ids + video ids. Categories contain COLLECTIONS, not videos, on Uscreen. |
| `scrape-collection-status.mjs` | collections list pages | `uscreen-collection-status.jsonl` (id, title, status, videosCount) | The published UNIT is the collection (~692); this captured its status. Rewrites whole file per run. |
| `scrape-people.mjs` | `/manage/people?page=N` | `uscreen-people.jsonl` | Resumable by key (id or email). |
| `scrape-member-status.mjs` | `/manage/people` | `uscreen-member-status.jsonl` | Fresh OVERWRITE snapshot for Brevo churn-sync. Has the harvest SKIP_GUARD. |
| `scrape-analytics.mjs` | `/manage/analytics/*` (8 pages) | `~/projects/albunyaan-funnel/docs/analytics-YYYY-MM-DD/` screenshots + JSON | Has the harvest SKIP_GUARD. |
| `scrape-covers.mjs` | each collection's details page | `uscreen-collection-covers.jsonl` (id, cover URL) | Resumable; prefers `programs/<id>/` images, falls back to `big_`. Prints `COVERS_DONE`. |
| `capture-hls.mjs` | one video details page | `/tmp/hls-url.txt` | Debug one-off for Mux sniffing (§4). |

Also present but out of this skill's scope: `compare-series.mjs`, `home-series.mjs`,
`one-series.mjs`, `inspect-covers.mjs`, `inspect-both-images.mjs`, `check-cover.mjs`,
`cover-field.mjs`, `map-covers.mjs`, `fix-missing-covers.mjs`, `storefront-covers.mjs`,
`verify-pattern.mjs`, `probe-download.mjs`, `shot.mjs`, `shot2.mjs`,
`tmp-probe-analytics.mjs` — mostly one-off inspection helpers from the covers work.

### Import & mirroring (no Uscreen session needed)

| Script | Purpose |
|---|---|
| `import-uscreen-catalog.ts` | Upserts the scraped JSONL into Supabase (`videos`, `collections`, `collection_items`, `categories`, `video_categories`, `people`). Deterministic UUIDs (`sha256("albunyaan:"+name)`) ⇒ idempotent reruns. Emits minimal stub videos for membership rows not yet enumerated so FKs hold. Run: `ALBUNYAAN_DB_DRIVER=supabase node_modules/.bin/tsx import-uscreen-catalog.ts` (env from `cloud.env`). |
| `mirror-thumbnails.mjs` | Downloads each `alpha.uscreencdn` video thumbnail → Supabase Storage bucket `posters` key `v/<external_id>.<ext>`, rewrites `videos.thumbnail_url`. Idempotent (skips URLs already on our host); 120 ms rate limit; paginates in 1000s (Supabase REST clamp). |
| `apply-covers.mjs` | Writes scraped cover URL into `collections.raw.cover_url`. |
| `mirror-covers.mjs` | Downloads covers → `posters` bucket key `series/<external_id>.jpg`, rewrites `raw.cover_url` to the owned public URL. |
| `uscreen-export.ts` | Phase-1 skeleton exporter (API + scrape strategies, resumable manifest, `--dry-run`). Endpoint paths and admin selectors are typed STUBS marked TO-VALIDATE — the `.mjs` scrapers above are what actually ran. HARD GUARD in header: no non-dry runs at scale before contract review. `pnpm --filter @albunyaan/worker export` maps to it. |
| `uscreen-login.ts` / `uscreen-scraper.ts` | storageState capture / headless session base (§5). |
| `migrate-videos.ts` | THE video migration engine (harvest/transfer/poll). Operate via albunyaan-migration-runbook; §4 here explains only its Uscreen/Mux side. |

### Pipeline shells (in `~/.albunyaan-cc/`, chain the scrapers)

| Shell | Chains | Marker |
|---|---|---|
| `run-pipeline.sh` | scrape-all-members → scrape-categories → DELETE `collections`/`categories` where `source=eq.uscreen` via Supabase REST → `import-uscreen-catalog.ts` → mirror-thumbnails | `PIPELINE_DONE` in `pipeline.log` |
| `run-pipeline2.sh` | same minus step 1 (membership already done) | `PIPELINE_DONE` |
| `finalize.sh` | waits for `ENUM_DONE` in `enum.log` (or enum process death) → re-import (fills real titles over stubs) → mirror-thumbnails | `FINALIZE_DONE` in `finalize.log` |
| `covers-finalize.sh` | waits for `COVERS_DONE` in `covers.log` → apply-covers → mirror-covers | `COVERS_FINALIZE_DONE` in `covers-finalize.log` |
| `enum-watchdog.sh` | 40 × 45 s loop: restarts `enumerate-videos.mjs` from `enum-page.txt` if it died AND CDP :9333 answers | logs to `watchdog.log` |

⚠️ The pipeline shells call `npx tsx import-uscreen-catalog.ts` — they predate the
"never npx" rule (npx was later found to hang unpredictably; `migrate-overnight.sh`
already uses the direct binary). If you re-run a pipeline shell, edit that line to
`node_modules/.bin/tsx import-uscreen-catalog.ts` first — via change control
(albunyaan-change-control).

Note the DELETE-then-reimport in the pipeline shells destroys and rebuilds
collections/categories rows (safe because UUIDs are deterministic and
`collection_items` are re-emitted) — do not run them while anything else is writing
those tables.

## 8. Scraped data artifacts (as of 2026-07-12; all in `~/.albunyaan-cc/`)

| File | Lines/shape | Status |
|---|---|---|
| `uscreen-videos-rich.jsonl` | 15,861 | COMPLETE (matches catalog total) |
| `uscreen-video-ids.jsonl` | 1,944 | early partial id list, superseded by rich |
| `uscreen-collection-members.jsonl` | 692 | complete (692 = published-unit count) |
| `uscreen-collection-covers.jsonl` | 686 | complete |
| `uscreen-collection-status.jsonl` | per-collection status | complete |
| `uscreen-people.jsonl` | 425 | subscribers |
| `uscreen-member-status.jsonl` | fresh snapshots | overwritten per churn-sync run |
| `uscreen-category-collections.jsonl` / `uscreen-category-members.jsonl` | 25 each | 25 categories |
| `uscreen-collections-list.json` / `-full.json`, `uscreen-categories-list.json` | JSON arrays | list inputs |
| `uscreen-structure/` | survey JSONs | exploratory |
| `enum-page.txt` | `1322` | enum cursor (last page) |

Structure/enum/covers import phases are COMPLETE. The remaining Uscreen-facing work
is video harvest inside the migration loop (~1,584/15,861 transferred as of
2026-07-12; all 197 published videos done).

## 9. MODEL FITNESS

A Sonnet-class session may do ALONE:
- Launch/verify the twin Chrome, check CDP and session liveness (§1 commands).
- Re-run any **resumable, idempotent** scraper listed above after a session
  re-login (enumerate-videos, scrape-all-members, scrape-covers, scrape-people,
  scrape-member-status, scrape-analytics) — respecting the one-scraper-at-a-time
  guard and politeness delays exactly as coded.
- Re-run `import-uscreen-catalog.ts`, `mirror-thumbnails.mjs`, `apply-covers.mjs`,
  `mirror-covers.mjs` (idempotent by design).
- Read/verify JSONL artifacts, counts, logs; walk the founder through re-login.
- Fix a broken selector in a LIST scraper following §6 (raw HTML saved first,
  one-item supervised re-run) — file the change via albunyaan-change-control.

MUST STOP and tell the founder to switch to a stronger model / higher effort:
- Any change to politeness timing, settle waits, sequencing, or tab-lifecycle logic
  (the hCaptcha/memory/CDP failure modes are subtle and were expensive).
- Any change to `migrate-videos.ts` harvest/transfer logic, the fail-closed cleanup
  paths (placeholder delete + `uscreen_hls_url` null), token-life timeout math,
  transfer `CONCURRENCY`, or the watchdog's hang discriminator.
- Writing a NEW scraper that hits a Uscreen admin surface at scale.
- Anything touching the truncating legacy scripts (`scrape-coll-members.mjs`,
  `scrape-categories.mjs`, `scrape-cat-collections.mjs`) against current data.
- Anything that would WRITE to Uscreen — that is never allowed at any model tier;
  escalate to the founder, not to a bigger model.

## 10. Provenance and maintenance

Volatile facts above are stamped 2026-07-12. Re-verify before trusting:

```bash
# CDP up + session state
curl -s --max-time 3 http://127.0.0.1:9333/json/version
# Chrome for Testing binary present (version-suffixed dir drifts — see albunyaan-build-and-env §7)
ls -d "$HOME/Library/Caches/ms-playwright"/chromium-*/chrome-mac-arm64/*.app
# scraper inventory
ls ~/projects/albunyaan-platform/worker/*.mjs ~/projects/albunyaan-platform/worker/uscreen-*.ts
# pipeline shells
ls ~/.albunyaan-cc/*.sh
# data artifact counts
wc -l ~/.albunyaan-cc/uscreen-*.jsonl; cat ~/.albunyaan-cc/enum-page.txt
# politeness numbers / Mux regex / token math (source of truth)
grep -n "waitForTimeout(1800)\|waitForTimeout(2600)\|stream\\\\.mux\\\\.com\|tokenExpSec" ~/projects/albunyaan-platform/worker/migrate-videos.ts
# storageState freshness
ls -l ~/.albunyaan-cc/uscreen-storageState.json
# npx still present in pipeline shells? (should be fixed via change control)
grep -n "npx tsx" ~/.albunyaan-cc/run-pipeline*.sh ~/.albunyaan-cc/finalize.sh
```

Siblings: operating the migration → **albunyaan-migration-runbook**; live failure
triage → **albunyaan-migration-debugging-playbook**; why past disasters happened →
**albunyaan-failure-archaeology**; Bunny API → **bunny-operations**; tables/columns →
**albunyaan-data-and-schema-reference**; editing any of this code →
**albunyaan-change-control**.
