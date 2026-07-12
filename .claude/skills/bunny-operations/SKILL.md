---
name: bunny-operations
description: >
  Everything Bunny Stream (the destination CDN of the Uscreen exit): the API wrapper
  worker/lib/bunny.ts, createVideo/uploadFile/getVideo/deleteVideo, encode status
  semantics and the --poll flow, the ffmpeg→curl upload anatomy, orphan/0-byte
  placeholder detection and cleanup, signed embed URLs (lib/bunny-embed.ts, WS5),
  how the web player consumes bunny_video_id, and DB↔library count reconciliation.
  Load this skill whenever a session must call the Bunny API, list or delete Bunny
  videos, run an orphan sweep, investigate "library count doesn't match DB count",
  check encode status, sign or debug an embed URL, flip Embed View Token
  Authentication, or touch BUNNY_* env vars. NOT for running the migration loop
  (albunyaan-migration-runbook) or diagnosing novel pipeline failures
  (albunyaan-migration-debugging-playbook).
---

# Bunny operations — the destination CDN of the Uscreen exit

Bunny Stream hosts the migrated video files that replace Uscreen/Mux. This skill is the
ground truth for talking to Bunny: API, upload mechanics, orphan hygiene, signed playback,
and count reconciliation. Every command and number here was verified against the real repo,
the real library, and the real database on **2026-07-12**. Read
`/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first; nothing here overrides it.

## When NOT to use this skill

| Situation | Use instead |
|---|---|
| Start / pause / resume / health-check the migration loop | `albunyaan-migration-runbook` |
| A transfer is failing in a new way; root-cause needed | `albunyaan-migration-debugging-playbook` |
| Editing pipeline code, timeouts, concurrency, watchdog logic | `albunyaan-change-control` (mandatory first) |
| "Why is this code shaped so defensively?" — past-disaster history | `albunyaan-failure-archaeology` |
| Table/column semantics, `export_manifest` statuses, schema | `albunyaan-data-and-schema-reference` |
| Harvesting Mux URLs from Uscreen admin (browser side) | `uscreen-scraping-reference` |
| End-to-end playback QA / entitlement gate proof | `albunyaan-validation-and-qa` |
| Build/env setup, where node_modules live | `albunyaan-build-and-env` |

## Glossary (once)

- **Bunny Stream** — bunny.net's video product: you upload a file, Bunny transcodes ("encodes") it and serves it via an iframe player and an HLS CDN.
- **Library** — a Bunny Stream container of videos, identified by `BUNNY_LIBRARY_ID`. This project uses ONE library.
- **guid** — Bunny's ID for one video object; stored in our DB as `videos.bunny_video_id`.
- **Placeholder** — an empty video object made by `createVideo()` before any bytes are uploaded. A placeholder that never receives bytes is an **orphan** (the 0-byte disaster, below).
- **Mux** — Uscreen's video backend, the SOURCE we pull from. Its HLS URLs carry a JWT `?token=` valid ~159 minutes; Bunny cannot server-fetch these (that is why we ffmpeg-pull locally).
- **Embed View Token Authentication** — Bunny library setting; when ON, the iframe embed only loads with a valid signed `?token=&expires=` pair (WS5 lockdown).

## Environment variables (NAMES only — never read or print values)

All worker-side values live in `~/.albunyaan-cc/cloud.env` (chmod 600, never commit, never open).
Load pattern: `set -a; source ~/.albunyaan-cc/cloud.env; set +a` — values enter the process env; never echo them.
(Sourcing EXECUTES the file — required and allowed; the never-open rule forbids READING it: no cat/echo of its contents into context or logs.)

| Name | Used by | Purpose / blast radius |
|---|---|---|
| `BUNNY_LIBRARY_ID` | `worker/lib/bunny.ts` (`bunnyFromEnv()`), `verify-playback-lockdown.ts` | which library API calls hit |
| `BUNNY_API_KEY` | same | **Full library control — this key can DELETE the entire video library.** Treat like the Supabase service-role key. |
| `BUNNY_CDN_HOST` | `worker/verify-playback-lockdown.ts` | the direct-HLS CDN hostname (`vz-….b-cdn.net`), used to probe `https://$BUNNY_CDN_HOST/<guid>/playlist.m3u8` |
| `NEXT_PUBLIC_BUNNY_LIBRARY_ID` | `apps/web/lib/bunny-embed.ts` | library id for the embed URL (public by nature — it ships inside every iframe src) |
| `BUNNY_EMBED_TOKEN_KEY` | `apps/web/lib/bunny-embed.ts`, `verify-playback-lockdown.ts` | embed signing key. **Server-only, never `NEXT_PUBLIC_`** — leaking it lets anyone mint playback tokens. Web values live in `apps/web/.env.local` / Vercel env. |

Note (as of 2026-07-12): `apps/web/README.env.md` documents Supabase/Stripe vars but not yet the two web-side Bunny vars — the code (`lib/bunny-embed.ts`) is authoritative for the names.

## The API wrapper — `worker/lib/bunny.ts`

Base URL: `https://video.bunnycdn.com`. Auth header: `AccessKey: <BUNNY_API_KEY>`.
Every JSON call carries `AbortSignal.timeout(30_000)` — a raw `fetch()` with no timeout once
froze ALL FIVE transfer workers at `createVideo()` (rounds logged "TRANSFER: N ready" then
silence, 2026-07-10/11). A stalled call must THROW so the worker's catch path requeues.
Do not remove these timeouts.

| Function | HTTP | Endpoint | Returns / notes |
|---|---|---|---|
| `bunnyFromEnv()` | — | — | `{libraryId, apiKey}` from env; throws if either missing |
| `createVideo(cfg, title)` | POST | `/library/{id}/videos` | the new video's `guid`. Creates an EMPTY placeholder — every call must be paired with either a successful upload or a `deleteVideo()` |
| `fetchFromUrl(cfg, guid, url, opts?)` | POST | `/library/{id}/videos/{guid}/fetch` | `{ok, status, body}`. Server-side pull — **does not work for Mux tokenized URLs** (that's why the pipeline uses local upload). Returns immediately; encoding is async |
| `getVideo(cfg, guid)` | GET | `/library/{id}/videos/{guid}` | `{status, encodeProgress, length}` |
| `deleteVideo(cfg, guid)` | DELETE | `/library/{id}/videos/{guid}` | void; treats 404 as success (idempotent cleanup) |
| `uploadFile(cfg, guid, filePath)` | PUT via spawned `curl` | `/library/{id}/videos/{guid}` | streams the local file; see upload anatomy |

Two hard-won rules baked into `uploadFile()` — never "simplify" them away:

1. **`curl -T` (--upload-file), NEVER `--data-binary @file`** — `--data-binary` reads the whole
   file into memory and OOM-crashed on videos >1GB (commit `fa919fa`). `-T` streams from disk.
2. **Async `spawn`, NEVER `spawnSync`** — `spawnSync` blocks Node's single JS thread, so
   CONCURRENCY=5 silently ran ONE worker at a time (commit `9623f97`). This applies to all
   worker code, not just uploads.

Upload curl flags (verified in code): `--max-time 10800` (3h cap — a 1h cap once threw away a
completed 1.1GB download on the slow metered line, burning the bundle twice) plus
`--speed-limit 1024 --speed-time 60` (abort genuinely dead uploads: <1KB/s for 60s).
Failure detection: non-zero exit OR `"success": false` in the response body.

## Encode status semantics and the `--poll` flow

`BUNNY_STATUS` map in `worker/lib/bunny.ts`:
`0 queued · 1 processing · 2 encoding · 3 finished · 4 resolution-finished · 5 failed`.

**DONE test used everywhere: `status >= 3 && status !== 5`. FAILED test: `status === 5`.**
(Do not test `status === 3` alone — most finished videos in this library sit at 4.)

Observed live 2026-07-12: 5 library objects with **status 6** (0 bytes) — a value OUTSIDE the
code's map. UNVERIFIED semantics (Bunny docs suggest presigned-upload states); treat status-6
0-byte untracked objects as orphan debris, but flag the sighting rather than assuming.

`--poll` (in `worker/migrate-videos.ts`) syncs Bunny encode status into `export_manifest`
(entity `video_migration`):

```bash
cd ~/projects/albunyaan-platform/worker
set -a; source ~/.albunyaan-cc/cloud.env; set +a
node_modules/.bin/tsx migrate-videos.ts --poll
```

What it does, in order (as of the 2026-07-12 fix — migration 0011 + commit `da5cced`,
branch `exit-phase`; full history in `albunyaan-data-and-schema-reference`, RESOLVED
mismatch section):
1. Reads the already-`done` manifest set **paginated 1000/page** (Supabase REST silently
   clamps any page to 1000 rows) and SKIPS those — an unskipped full poll once blocked the
   orchestrator 72 minutes (02:10→03:22, 2026-07-11). `'done'` writes now persist (0011
   widened the cloud CHECK, applied + verified live 2026-07-12), but there is **no
   backfill**: the done-set is empty until the next poll writes rows, so the FIRST poll
   after restart re-polls all ~1,584 migrated (long round — expected), then shrinks.
2. Fetches videos with `bunny_video_id` set — **paginated 1000-row `.range()` pages**.
   (Fixed 2026-07-12: the old `.limit(5000)` was silently clamped to 1,000, so with 1,584
   migrated each poll missed ~584 videos.)
3. Per not-yet-done video: `getVideo()` → done ⇒ manifest `done`; status 5 ⇒ manifest
   `failed` / `bunny_encode_failed`; else counts as still-encoding. Manifest write failures
   are now logged (`manifest write FAILED for <id> (<status>): <msg>` — `setManifest()` no
   longer swallows the supabase-js error). Transient Bunny API errors are still swallowed
   (retried next poll).
4. Prints `poll: finished N, still encoding N, failed N`.

No poll has run since the fix (migration paused 2026-07-12, founder's call) — live
`done`/`skip_no_hls` counts are still 0 until one does.

The orchestrator runs `--poll` every 5th round automatically; run it manually only when you
need fresh encode numbers. Historical base rate: **zero** Bunny-side encode failures observed
through 2026-07-12 — failures live at the ffmpeg-fetch stage (expired Mux tokens), not Bunny.

`tsx` note: the ONLY verified tsx binary is `worker/node_modules/.bin/tsx` (the repo root has
none) — run worker scripts from `worker/` as above. Never `npx`/`npm exec` (hangs, per CLAUDE.md).

## Upload anatomy (what one successful transfer does)

From `transferWorker()` / `localTranscodeUpload()` in `worker/migrate-videos.ts`:

1. `createVideo(cfg, title)` → placeholder `guid`.
2. ffmpeg pull from the harvested Mux HLS URL to `$TMPDIR/mig-w<workerId>-<externalId>.mp4`:
   `ffmpeg -hide_banner -loglevel error -i <hls> -map 0:p:1 -sn -c copy -y <tmp>`
   — `-map 0:p:1` selects HLS program 1 (a specific quality rendition), `-sn` drops subtitle
   streams, `-c copy` remuxes without re-encoding (fast, lossless).
3. ffmpeg timeout = **Mux token runway**: `exp` claim of the `?token=` JWT minus now minus a
   5-min upload margin, floored at 10 min, capped at 150 min (`Math.min(150min, Math.max(10min,
   runway))`); 40 min fixed fallback if the token can't be decoded. The old fixed 40-min
   SIGKILL caused 634 needless kills of long lectures — never reintroduce a fixed timeout.
4. `uploadFile()` — the streaming `curl -T` PUT described above.
5. On success: `videos.bunny_video_id = guid`, manifest `fetched`, temp file removed, size
   logged in GB (bundle-burn visibility: each video costs ~2× its size on the founder's
   metered 400GB bundle — download + upload).
6. **On ANY failure — the fail-closed triple, never optimize any leg away:**
   - `rmSync` the temp mp4 (failed downloads otherwise leak multi-GB temps),
   - null `videos.uscreen_hls_url` so the video re-enters harvest for a FRESH token
     (harvest skips rows with a URL set; a dead URL never gets fresher),
   - `deleteVideo(guid)` best-effort — kills the empty placeholder (see next section).

## Orphans: the 0-byte disaster and cleanup discipline

**Settled battle (fixed, but the debris pattern recurs):** `createVideo()` fires per ATTEMPT,
before download/upload. Until 2026-07-10 nothing deleted the placeholder on failure — a wave
of 5,042 expired-token 403s left the library at 6,017 objects of which **97% were 0-byte
orphans** (real DB count at the time: 1,023). Founder-approved bulk cleanup on 2026-07-10
deleted 4,201; a further 409 (watchdog-false-kill era) were swept 2026-07-11 23:20. The
on-failure `deleteVideo()` stops NEW leaks, but kills/crashes between `createVideo` and the
catch block still leak occasionally — expect drift and re-sweep periodically.

**Library truth as of 2026-07-12** (live reconciliation run while writing this):
2,159 library objects vs 1,584 DB-tracked → **575 untracked**: 518 zero-byte (513 status 0,
5 status 6) + **57 NON-empty (status 4)**. Zero tracked-in-DB guids missing from the library
(DB→library integrity holds). The 57 non-empty untracked are watchdog-murder-era casualties:
an orphaned curl finished uploading after its parent worker was killed, so real content
landed but `bunny_video_id` was never written — untracked duplicates whose DB rows will
re-transfer later.

### Listing / reconciling (read-only — always safe)

List endpoint (verified live 2026-07-12): `GET /library/{id}/videos?page=N&itemsPerPage=100`,
header `AccessKey`. Response: `{totalItems, currentPage, itemsPerPage, items[]}`; items carry
`guid, status, length, storageSize, dateUploaded, title, …`. Gotcha: the served `itemsPerPage`
may differ from what you asked (requested 2 → served 10); `itemsPerPage=100` is honored.
Paginate until you have `totalItems` items.

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
# quick library count only:
curl -s "https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos?page=1&itemsPerPage=10" \
  -H "AccessKey: ${BUNNY_API_KEY}" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["totalItems"])'
```

Full reconciliation (DB guids paginated 1000/page — Supabase REST clamps silently):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
/usr/bin/python3 - <<'EOF'
import json, os, urllib.request
lib, key = os.environ['BUNNY_LIBRARY_ID'], os.environ['BUNNY_API_KEY']
su, sk = os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY']
def get(url, h):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30))
tracked, frm = set(), 0
while True:
    rows = get(f"{su}/rest/v1/videos?select=bunny_video_id&bunny_video_id=not.is.null&limit=1000&offset={frm}",
               {"apikey": sk, "Authorization": f"Bearer {sk}"})
    tracked.update(r["bunny_video_id"] for r in rows)
    if len(rows) < 1000: break
    frm += 1000
page, items = 1, []
while True:
    d = get(f"https://video.bunnycdn.com/library/{lib}/videos?page={page}&itemsPerPage=100", {"AccessKey": key})
    items.extend(d["items"])
    if len(items) >= d["totalItems"] or not d["items"]: break
    page += 1
un = [v for v in items if v["guid"] not in tracked]
print(f"library={len(items)} tracked={len(tracked)} untracked={len(un)} "
      f"zero-byte={sum(1 for v in un if v.get('storageSize',0)==0)} "
      f"non-empty={sum(1 for v in un if v.get('storageSize',0)>0)} "
      f"tracked-missing-from-library={len(tracked - {v['guid'] for v in items})}")
EOF
```

Interpretation: `library ≈ tracked` = clean. `untracked zero-byte` = orphan debris, sweepable.
`untracked non-empty` = completed-but-unrecorded uploads (decision needed, below).
`tracked-missing-from-library > 0` = **serious** — the DB points at deleted videos; stop and
escalate (players would break).

### Deleting — the safety rules (destructive; read twice)

The historical cleanup script (`cleanup-bunny-orphans.py`) lived in a session scratchpad and
is **GONE** (verified 2026-07-12) — recreate it from the reconciliation above plus
`DELETE /library/{id}/videos/{guid}` when a sweep is approved. Its proven safety envelope:

1. **Only delete guids that are (a) NOT in the DB tracked set AND (b) 0 bytes
   (`storageSize == 0`) AND (c) older than 2 hours (`dateUploaded`)** — the age margin
   protects racing in-flight uploads (a live transfer's placeholder is legitimately 0-byte
   for up to ~2.5h on this line).
2. **NEVER delete a tracked guid.** Recompute the tracked set in the same run — no stale lists.
3. **Non-empty untracked videos are NOT sweep material.** Two honest options per video:
   adopt (match by title to the DB row missing `bunny_video_id`, write the guid — saves a
   re-transfer and its bundle cost) or delete as duplicate AFTER the row has re-migrated.
   Either way it's a founder decision — present the list, don't act.
4. **Bulk deletes require explicit founder approval every time** (precedent: 2026-07-10 —
   the session deliberately asked first, even for obvious 0-byte debris).
5. Don't run a sweep concurrently with an active transfer round if avoidable — the 2026-07-10
   cleanup hammering the API alongside live migration caused apparent "heals"/slowdowns.
   API deletes cost no meaningful bundle data, but they share Bunny API capacity.
6. Expect a few transient 500s on deletes (18/4,201 in the big sweep) — harmless, retry or ignore.

## Signed embed URLs (WS5 playback lockdown)

Signing lives server-side in `apps/web/lib/bunny-embed.ts` (commit `9a3ea3e`, "WS5:
entitlement-gate playback + sign Bunny embed URLs"):

```
base  = https://iframe.mediadelivery.net/embed/<NEXT_PUBLIC_BUNNY_LIBRARY_ID>/<bunnyVideoId>?autoplay=false&preload=true
token = SHA256_HEX( BUNNY_EMBED_TOKEN_KEY + bunnyVideoId + expires )      # plain sha256 hex, NOT HMAC
url   = base + &token=<token>&expires=<unix seconds>
```

- TTL: `EMBED_TOKEN_TTL_SECONDS = 6 * 60 * 60` (6h — validated when the embed LOADS, generous
  for long lectures).
- Fail-visible design: if `NEXT_PUBLIC_BUNNY_LIBRARY_ID` is unset → `signedEmbedUrl()` returns
  null (no player). If `BUNNY_EMBED_TOKEN_KEY` is unset → URL emitted UNSIGNED, which works
  only while the library-side "Embed View Token Authentication" toggle is OFF; after the flip
  a missing key breaks playback visibly, never silently open.
- The signature is entitlement's second layer, not the first: pages gate access BEFORE
  rendering `VideoPlayer` — the token only stops the URL working outside the page.
- CSP: `apps/web/next.config.ts` allows exactly `frame-src https://iframe.mediadelivery.net`.
- Direct CDN HLS URL form: `https://$BUNNY_CDN_HOST/<guid>/playlist.m3u8` (found already 403
  on 2026-07-12 — "Block Direct URL Access" appears active library-side; verify, don't
  assume). The current lockdown posture has ONE home:
  `albunyaan-architecture-contract` §6 item 1 (and §4.2) — cross-check and update that
  entry together with this observation so the two never diverge.

**Acceptance test** (`worker/verify-playback-lockdown.ts`) — probes unsigned embed, signed
embed, and direct HLS from OUTSIDE the app, with body-content heuristics (embed pages answer
200 even when refusing playback — status alone is not truth):

```bash
cd ~/projects/albunyaan-platform
set -a; source ~/.albunyaan-cc/cloud.env; set +a
MODE=pre  worker/node_modules/.bin/tsx worker/verify-playback-lockdown.ts   # BEFORE flipping: proves URLs are right (all open)
MODE=post worker/node_modules/.bin/tsx worker/verify-playback-lockdown.ts   # AFTER flipping: unsigned+direct blocked, signed loads
```

`MODE=post` requires `BUNNY_EMBED_TOKEN_KEY` in env or it fails the run by design. The
library-side flip itself (dashboard toggle) is a founder/change-control action — run
`MODE=pre` first, flip, then `MODE=post`; never flip without the pre baseline.

## How the web player consumes `bunny_video_id`

Chain (all verified in `apps/web`): `app/programs/[slug]/page.tsx` decides server-side —
parental profile check → WS5 entitlement gate (non-free video + no active entitlement ⇒
`<Paywall>` renders INSTEAD of the player, so the page HTML carries no embed URL and no
`bunny_video_id` at all) → entitled + `video.bunny_video_id` set ⇒
`<VideoPlayer bunnyVideoId=… />` (`components/VideoPlayer.tsx`) which renders the Bunny
iframe at `signedEmbedUrl(bunnyVideoId)` → `bunny_video_id` NULL ⇒ poster placeholder
(`PosterHero`). **No code change is needed as migration progresses** — each video starts
playing the moment its `bunny_video_id` lands. Admin visibility: `app/admin/videos/page.tsx`
shows a ✓ per migrated video. E2E proof of all four gate states:
`worker/e2e-playback-gate.ts` (local stack; see `albunyaan-validation-and-qa`).

## Verification counts — the honest numbers

Two independent sources; they measure different things:

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
# DB truth (what the platform can PLAY) — count=exact via headers; add &status=eq.published for the live-site tier:
curl -s --max-time 15 "${SUPABASE_URL}/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | tr -d '\r' | grep -i content-range     # → 0-0/<COUNT>
```

- **DB count** (`bunny_video_id not null`) is the migration progress number: **1,584 / 15,861**
  as of 2026-07-12 (published tier 197/197 complete).
- **Bunny `totalItems`** counts library OBJECTS including orphan debris — it is NOT "videos
  migrated" (the founder's 6,017 shock, 2026-07-10). 2,159 as of 2026-07-12.
- `library − tracked` gap >~50 or growing while the orchestrator is UP ⇒ placeholder leak
  returned; run the reconciliation, then the debugging playbook.

## Model fitness — Sonnet-class go / stop line

A Sonnet-class session MAY do alone:
- Everything read-only: `--poll`, `getVideo`, library listing, the reconciliation script,
  count queries, `MODE=pre`/`MODE=post` lockdown probes.
- Delete a SINGLE known-bad placeholder that meets all three sweep criteria (untracked +
  0-byte + >2h old) when a specific failure just leaked it.
- Recreate/run the orphan sweep **after explicit founder approval of that run**, within the
  exact safety envelope above.
- Debug an embed URL (recompute the sha256, compare `expires`, check env var presence by name).

STOP and tell the founder to switch to a stronger model / higher effort for:
- Any change to `worker/lib/bunny.ts` or the fail-closed triple in `migrate-videos.ts`
  (timeouts, `deleteVideo` on failure, `uscreen_hls_url` nulling, curl flags, spawn vs
  spawnSync) — every line there is a scar from a named disaster.
- Changing transfer CONCURRENCY, the token-runway timeout formula, or the poll pagination
  (1000-row `.range()` pages since 2026-07-12, commit `da5cced` — replaced the clamped
  `.limit(5000)`).
- Any BULK delete or adopt-vs-delete decision on non-empty untracked videos.
- Changing the embed signing scheme, TTL, or flipping library-side auth settings.
- Anything touching the watchdog hang-discriminator (that's not even this skill — change
  control + a stronger model, always).

Also: never print, quote, or commit any secret value; the Bunny API key can delete the whole
library and the service-role key bypasses all RLS.

## Provenance and maintenance

Verified 2026-07-12 against the live repo, live Bunny API, and live Supabase. Re-verify lines:

- Wrapper signatures/endpoints/timeouts: `grep -n "export async function\|API_TIMEOUT_MS\|BASE =" ~/projects/albunyaan-platform/worker/lib/bunny.ts`
- Status semantics + poll flow: `grep -n "status >= 3\|range(from\|BUNNY_STATUS" ~/projects/albunyaan-platform/worker/{lib/bunny.ts,migrate-videos.ts}`
- Upload anatomy + timeout formula: `grep -n "map', '0:p:1\|150 \* 60_000\|max-time\|speed-limit" ~/projects/albunyaan-platform/worker/migrate-videos.ts ~/projects/albunyaan-platform/worker/lib/bunny.ts`
- Fail-closed triple: `grep -n "rmSync\|uscreen_hls_url: null\|deleteVideo" ~/projects/albunyaan-platform/worker/migrate-videos.ts`
- Embed signing: `grep -n "sha256\|EMBED_TOKEN_TTL\|NEXT_PUBLIC_BUNNY_LIBRARY_ID" ~/projects/albunyaan-platform/apps/web/lib/bunny-embed.ts`
- Player chain: `grep -n "bunny_video_id\|VideoPlayer\|Paywall" "~/projects/albunyaan-platform/apps/web/app/programs/[slug]/page.tsx"`
- Live counts (volatile — rerun before quoting): the DB count curl and the reconciliation script in this file.
- tsx binary still at `worker/node_modules/.bin/tsx`: `ls ~/projects/albunyaan-platform/worker/node_modules/.bin/tsx`

Volatile facts to re-check on load: migrated counts (1,584 / 2,159 / 575-untracked), the
57 non-empty untracked list, whether the orphan-sweep script has been recreated somewhere
permanent, whether `README.env.md` gained the Bunny vars, and the status-6 question.
