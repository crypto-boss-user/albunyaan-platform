---
name: albunyaan-build-and-env
description: >
  Recreate or repair the Albunyaan platform working environment from scratch.
  Load this when: setting up on a new/rebuilt Mac; `pnpm install` / build /
  dev-server questions; tsx or npx hangs; ffmpeg "Library not loaded" dylib
  errors; env vars missing (SUPABASE_*, BUNNY_*); how to launch the shared
  :9333 Chrome for Testing; installing/reloading the com.albunyaan.* launchd
  agents; caffeinate/keep-awake for overnight runs; or "why doesn't X find its
  config/secret". NOT for operating the migration itself (use
  albunyaan-migration-runbook) or debugging a running pipeline (use
  albunyaan-migration-debugging-playbook).
---

# Albunyaan — Build & Environment Setup

Everything needed to stand up the working environment for the Albunyaan
platform (the self-built OTT platform replacing Uscreen). Zero context
assumed. All paths, versions and commands below were verified against the
live machine on 2026-07-12.

**Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first, always.**
It is the project manifest; nothing in this skill may override it.

## When NOT to use this skill

| You want to… | Use instead |
|---|---|
| Run/resume/pause the video migration | `albunyaan-migration-runbook` |
| Debug a hung/failing migration | `albunyaan-migration-debugging-playbook` |
| Understand past disasters and their fixes | `albunyaan-failure-archaeology` |
| Look up tables/columns/counts | `albunyaan-data-and-schema-reference` |
| Scrape Uscreen (harvest, covers, members) | `uscreen-scraping-reference` |
| Bunny Stream API operations | `bunny-operations` |
| The launchd automations' *behavior* (reports, meters, drafts) | `albunyaan-ops-and-automations` |
| System design / invariants | `albunyaan-architecture-contract` |
| Change anything risky | `albunyaan-change-control` |
| QA / verification passes | `albunyaan-validation-and-qa` |
| Overall program status & strategy | `albunyaan-platform-replacement-campaign` |

## The three locations (memorize this — the #1 zero-context trap)

| Location | What it is | Writable? |
|---|---|---|
| `~/projects/albunyaan-platform` | THE monorepo: `packages/core`, `apps/web` (Next.js 16 + Tailwind 4), `worker/` (scrapers, importers, `migrate-videos.ts`), `supabase/migrations` (0001–0010), `docs/`, `infra/live-relay` | yes (git repo, WS-numbered commits) |
| `~/.albunyaan-cc/` | Operational state dir (NOT a repo): orchestration shell scripts, logs, scraped `uscreen-*.jsonl`, the cloned Chrome profile `chrome-emdb-clone/`, and chmod-600 secret env files | yes, but **never open the `*.env` files** |
| `~/projects/albunyaan-command-center` | A SEPARATE Next.js honesty dashboard (metrics scraper). Despite the name it does NOT run the migration | leave alone |

Secret files in `~/.albunyaan-cc/` (`cloud.env`, `brevo.env`, `resend.env`,
`supabase-*.env`, `webhook.env`) are chmod 600. (`stripe.env` — planned
location for `STRIPE_SECRET_KEY` — does **not exist yet** as of 2026-07-12;
blocked on founder Stripe identity verification, founder-runbook step D.)
**Never read, cat, grep, quote or print them.** Reference variables by NAME only. Why it
matters: `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely (full DB
read/write), and `BUNNY_API_KEY` can delete the entire video library.

## 1. Prerequisites (verified versions, 2026-07-12)

| Tool | Version on the machine | Where | Install if missing |
|---|---|---|---|
| Node | v22.20.0 | `/usr/local/bin/node` | Node 22 LTS (installer or nvm) |
| pnpm | 11.1.1 (pinned by `packageManager` in root `package.json`) | `~/.npm-global/bin/pnpm` | `npm i -g pnpm@11.1.1` |
| ffmpeg | 8.1.2 (Homebrew) | `/opt/homebrew/bin/ffmpeg` | `brew install ffmpeg` |
| Chrome for Testing | Playwright-managed build | `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app` | from `worker/`: `node_modules/.bin/playwright install chromium` |

### The ffmpeg dylib-breakage trap (settled battle, 2026-07-07)

Any `brew install`/`brew upgrade` of an unrelated formula can upgrade a
shared library (it was `x265`) and delete the dylib version ffmpeg was linked
against. Every ffmpeg invocation then fails instantly with
`dyld: Library not loaded: libx265.215.dylib` — on 2026-07-07 this zeroed 4
migration rounds (479 items failed) for 40 minutes.

- **Rule: no brew operations while the migration runs.**
- If you must brew, verify immediately after: `ffmpeg -version` and a tiny
  encode. Broken? → `brew reinstall ffmpeg` (relinks against current libs).

### Chrome for Testing path drift

The playwright cache holds version-suffixed dirs (`chromium-1223`,
`chromium-1228` both present as of 2026-07-12). The launch command below pins
`chromium-1223`; after a playwright upgrade, resolve the current path:

```bash
ls -d "$HOME/Library/Caches/ms-playwright"/chromium-*/chrome-mac-arm64/*.app
```

Any build works for the shared browser — `connectOverCDP` only cares about
port 9333, and the profile lives outside the app bundle.

## 2. Repo setup

```bash
cd ~/projects/albunyaan-platform
pnpm install          # installs all workspaces: apps/web, packages/core, worker
```

Workspace layout (`pnpm-workspace.yaml`): `apps/*`, `packages/*`, `worker`.

Build scripts are allowed ONLY for `esbuild`, `sharp`, `playwright` — declared
as `pnpm.onlyBuiltDependencies` in root `package.json` AND in
`pnpm-workspace.yaml`. If pnpm ever prompts about ignored build scripts for
one of those three, the allowlist got lost — restore it, don't blanket-approve.

`packages/core` (`@albunyaan/core`) has **no build step** — its
`package.json` exports TypeScript source directly (`"main": "src/index.ts"`);
consumers (Next.js, tsx) transpile it themselves. Don't add a build step.

Sanity check after install:

```bash
ls worker/node_modules/.bin/tsx    # must exist — see the direct-binary rule
cd apps/web && pnpm build          # Next.js production build must pass
```

## 3. The direct-binary rule (tsx)

**NEVER use `npx` / `npm exec` / `pnpm dlx` for worker scripts — they hang
unpredictably on this machine** (hard rule in CLAUDE.md; the orchestrator
comment records it was "found to hang unpredictably"). Always the direct
binary:

```bash
cd ~/projects/albunyaan-platform/worker
node_modules/.bin/tsx migrate-videos.ts --harvest 60
```

Note: `tsx` is installed in **`worker/node_modules/.bin/`** only — there is
NO `node_modules/.bin/tsx` at the monorepo root (verified). So `cd worker`
first, or use the absolute path
`~/projects/albunyaan-platform/worker/node_modules/.bin/tsx`.

Related worker-code rule (same family, from CLAUDE.md): use async `spawn`,
never `spawnSync` — spawnSync blocks the event loop and silently serializes
"parallel" workers (CONCURRENCY=5 configured, only 1 ffmpeg ever observed).

## 4. Environment loading

### Shell pattern (orchestrator scripts, ad-hoc commands)

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
```

`set -a` auto-exports every variable the sourced file defines; `set +a` turns
that off again. This is the canonical pattern in CLAUDE.md and
`~/.albunyaan-cc/migrate-overnight.sh`. No collision with the never-open rule below:
sourcing EXECUTES the file to load vars into the shell (required and allowed);
READING/printing its contents into context or logs (cat/echo of values) is what's forbidden.

### What cloud.env must provide (names verified via grep in worker code — never open the file)

| Variable | Consumed by | Danger level |
|---|---|---|
| `SUPABASE_URL` | worker (26 uses), apps/web, morning-report.sh | low (public URL) |
| `SUPABASE_ANON_KEY` | worker e2e tests, apps/web member auth | low |
| `SUPABASE_SERVICE_ROLE_KEY` | worker (30 uses), apps/web data layer | **CRITICAL — bypasses RLS** |
| `BUNNY_LIBRARY_ID` | `worker/lib/bunny.ts` (`bunnyFromEnv` throws without it) | medium |
| `BUNNY_API_KEY` | `worker/lib/bunny.ts` | **CRITICAL — can delete the library** |
| `BUNNY_CDN_HOST` | `worker/verify-playback-lockdown.ts` | low |

Also used in code (provenance of the value is per-file, may or may not live
in cloud.env — UNVERIFIED without opening secret files):
`BUNNY_EMBED_TOKEN_KEY` (apps/web `lib/bunny-embed.ts` signs embed URLs;
server-only, never `NEXT_PUBLIC_`), `NEXT_PUBLIC_BUNNY_LIBRARY_ID` (web
player iframe), `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (planned home
`~/.albunyaan-cc/stripe.env` per `apps/web/README.env.md` — that file does not
exist yet as of 2026-07-12, founder-runbook step D), `SITE_URL`,
`CONCURRENCY` (transfer parallelism, default 5 — do not raise casually),
`USCREEN_STORAGE_STATE`, `USCREEN_API_KEY`.

### Self-loading exception

`worker/migrate-videos.ts` reads `~/.albunyaan-cc/cloud.env` itself at
startup (lines 32–34) and only fills variables **not already set** in the
process env. So the migration works without the shell `source`, and an
exported shell variable (e.g. `CONCURRENCY=3`) still wins.

### apps/web

Local values live in `apps/web/.env.local` (exists, gitignored — never
commit). The authoritative name/provenance list is
`apps/web/README.env.md`. Deployed values live in the Vercel project env.

## 5. Web dev server

```bash
cd ~/projects/albunyaan-platform/apps/web && pnpm dev -p 3010
# → http://localhost:3010
```

Build check: `pnpm build` (root script filters to `@albunyaan/web`).
"lint" in this repo means `tsc --noEmit` (see each package.json), not eslint.

## 6. Worker script anatomy

Root `package.json` exposes phase-1 shortcuts that filter into the worker
workspace:

```
pnpm phase1:import-people   → worker: tsx import-people.ts
pnpm phase1:import-leads    → worker: tsx import-leads.ts
pnpm phase1:export          → worker: tsx uscreen-export.ts
pnpm phase1:test            → worker: vitest run
```

Worker `package.json` scripts (all `tsx <file>.ts`, all files verified
present): `typecheck`, `import-people`, `seed-catalog`, `import-leads`,
`export`, `verify-rls`, `test` (vitest), `stripe-setup`, `reconcile-stripe`,
`test-stripe-apply`. Many more scripts exist as bare `.ts`/`.mjs` files run
directly with `node_modules/.bin/tsx` (or `node` for `.mjs`).

The migration engine `worker/migrate-videos.ts` flags (from its header):

```
--harvest [N]   sequential, ONE page, 1.8s politeness delay (hCaptcha trips on concurrent admin loads); default N=60
--transfer      parallel, CONCURRENCY workers (default 5), no Uscreen contact
--poll          update Bunny encode status
--dry           harvest only, log, no Bunny calls
```

Operating those flags = `albunyaan-migration-runbook`, not this skill.

## 7. Shared Chrome (twin browser, CDP :9333)

The migration harvest and all Uscreen admin scraping drive one shared Chrome
for Testing instance carrying the founder's cloned profile (with the Uscreen
admin session). Launch (as of 2026-07-12; adjust `chromium-1223` per §1 path
drift):

```bash
"$HOME/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  --remote-debugging-port=9333 \
  --user-data-dir="$HOME/.albunyaan-cc/chrome-emdb-clone" \
  --profile-directory=Default &
```

Verify it is actually up (never assume — silent-failure trap):

```bash
curl -s --max-time 5 http://127.0.0.1:9333/json/version | head -1   # JSON → alive
curl -s http://127.0.0.1:9333/json/list                              # open tabs
```

Hard rules:
- **Never close the LAST page** in this browser — it breaks Playwright's
  `connectOverCDP` handshake for every future script. If you must close
  tabs, open `about:blank` first (`curl -X PUT "http://127.0.0.1:9333/json/new?about:blank"`
  — PUT is required on Chrome 111+), then close.
- The Uscreen admin session **expires**; only the founder can re-login.
  Scripts print `LOGGED OUT` when it does. Check by loading
  `app.uscreen.tv/manage` in the shared browser.
- Never launch a second browser for Uscreen/Supabase sessions — drive this
  one via the chrome-devtools MCP on :9333.

## 8. Keep-awake for overnight runs (caffeinate)

If the Mac sleeps, everything (browser, ffmpeg, orchestrator) silently pauses
with zero errors. Historical near-miss: a stray 5-minute `caffeinate -t 300`
was found holding the whole night's run; another night the 12-h one had
simply expired.

```bash
caffeinate -i -s -m -d -t 43200 &     # 12 hours; restart nightly
```

Verify (don't trust that it's running):

```bash
ps aux | grep '[c]affeinate'      # want a -t 43200-ish process, not -t 300
pmset -g | grep sleep             # "sleep prevented by ... caffeinate"
```

`morning-report.sh` checks it exactly as `pgrep -x caffeinate` and prints
`caffeinate on/OFF` in the daily 08:00 report — an "OFF" there overnight
means the run was at sleep-risk.

## 9. launchd agents

Eight agents installed in `~/Library/LaunchAgents/` (verified 2026-07-12):

```
com.albunyaan.bundle-meter          every 5 min → bundle-meter.sh (WARN 200GB / auto-PAUSE 250GB of the 400GB bundle)
com.albunyaan.catalog-backup        03:30 nightly → backup-catalog.py
com.albunyaan.migration-watchdog    every 5 min → migration-watchdog.sh
com.albunyaan.monthly-acq-draft     monthly acquisition draft
com.albunyaan.morning-report        08:00 daily → morning-report.sh
com.albunyaan.weekly-email-draft    weekly email draft
com.albunyaan.weekly-metrics-digest weekly metrics digest
com.albunyaan.weekly-push           weekly push notification draft
```

Pattern (from the verified plists): `ProgramArguments = /bin/bash <script in
~/.albunyaan-cc/>`, `StartInterval` or calendar schedule, `RunAtLoad true`,
stderr to a `*-agent.log` in `~/.albunyaan-cc/`.

Install a NEW agent:

```bash
cp <plist> ~/Library/LaunchAgents/com.albunyaan.<name>.plist
launchctl load ~/Library/LaunchAgents/com.albunyaan.<name>.plist
```

**Guardrail (by design):** a Claude-Code hook
(`~/.claude/hooks/guardrail.py`) BLOCKS `launchctl bootout|unload|remove` of
`com.albunyaan.*` agents. Do not fight it or route around it — unloading an
agent is a founder decision (change control).

**Reloading after edits:** interval agents re-exec their shell script fresh
every cycle, so **editing the script needs no reload** — the next 5-min tick
picks it up (this raced a live fix once: the old code ran one final cycle
mid-edit; expect one stale cycle). Only *plist* changes need an
unload/reload → founder.

Two behaviors that confuse fresh sessions (both by design):
- The watchdog **never auto-restarts** the orchestrator; when
  `migrate-overnight.sh` is down it just logs `ORCHESTRATOR DOWN` every 5 min
  (harmless, zero network). A human must restart it — the shared browser
  session needs eyes.
- With the orchestrator down, morning-report notifications flag
  "MIGRATION ORCHESTRATOR DEAD" daily until resumed. Expected, not a bug.

## 10. Known traps checklist (run through this when anything is "weird")

- [ ] `npx`/`npm exec` used anywhere? → replace with `node_modules/.bin/tsx` (from `worker/`).
- [ ] `tsx` not found at repo root? → it only exists in `worker/node_modules/.bin/`.
- [ ] ffmpeg failing instantly after any brew activity? → `dyld: Library not loaded` → `brew reinstall ffmpeg`.
- [ ] Env vars empty in a shell script? → missing `set -a; source ~/.albunyaan-cc/cloud.env; set +a`.
- [ ] Tempted to read a `~/.albunyaan-cc/*.env` file "just to check"? → don't. Test by behavior (`bunnyFromEnv` throws a clear error; Supabase calls 401).
- [ ] Shared Chrome "up" but scripts fail? → verify with `curl :9333/json/version`; check `LOGGED OUT` in output (founder re-login needed).
- [ ] About to close browser tabs? → never the last one; open `about:blank` first (PUT).
- [ ] Overnight run planned? → fresh 12-h `caffeinate`, verify with `pmset -g`.
- [ ] Editing a watchdog/meter script? → next 5-min cycle runs it; one stale cycle may race your edit.
- [ ] `launchctl unload` blocked? → by design; escalate to the founder.
- [ ] Supabase REST returning exactly 1000 rows? → silent clamp; paginate and verify counts.
- [ ] Playwright upgraded? → `chromium-1223` path in launch commands may be stale; re-resolve (§1).
- [ ] Disk filling / RAM pressure during migration? → stale `mig-w*.mp4` temps and leaked Uscreen tabs are watchdog-swept, but only while the agent is loaded.

## MODEL FITNESS (which sessions may do what)

A Sonnet-class session may do **alone**:
- Fresh environment setup exactly as written here (install tools, `pnpm install`, launch dev server).
- Verifying state: versions, `curl :9333`, `pgrep`, log tails, `launchctl list`.
- Restarting caffeinate; relaunching the shared Chrome with the exact command above.
- `brew reinstall ffmpeg` after a confirmed dylib error (migration paused).
- Editing `apps/web` app code and running builds/tests.

A Sonnet-class session must **STOP and tell the founder to switch to a
stronger model / higher effort** before:
- Changing the watchdog's hang-discriminator logic (`migration-watchdog.sh`
  active-check / kill logic) — a subtle bug here silently murdered an entire
  evening of healthy transfers once already.
- Changing transfer `CONCURRENCY`, harvest politeness delay (1.8 s), or
  harvest sequentiality — hCaptcha and bundle-burn consequences.
- Touching any fail-closed path (on-failure `deleteVideo`, `uscreen_hls_url`
  nulling, bundle-meter auto-pause) — "optimizing" these caused the 0-byte
  orphan disaster class of failures.
- Rotating/moving secrets, editing anything in `~/.albunyaan-cc/*.env`, or
  RLS/policy changes.
- Rewriting launchd plists or the guardrail hook.

## Provenance and maintenance (re-verify before trusting, one-liners)

```bash
# versions & binaries
node --version; pnpm --version; ffmpeg -version | head -1; ls ~/projects/albunyaan-platform/worker/node_modules/.bin/tsx
# workspace + build allowlist
cat ~/projects/albunyaan-platform/pnpm-workspace.yaml; grep -A4 onlyBuiltDependencies ~/projects/albunyaan-platform/package.json
# env var names actually consumed (never open the .env files)
grep -rhoE 'process\.env\.[A-Z_0-9]+' ~/projects/albunyaan-platform/worker --include='*.ts' --include='*.mjs' | sort -u
# chrome build dirs (path drift)
ls -d "$HOME/Library/Caches/ms-playwright"/chromium-*/chrome-mac-arm64/*.app
# shared browser + keep-awake + orchestrator liveness
curl -s --max-time 5 http://127.0.0.1:9333/json/version >/dev/null && echo CDP-UP || echo CDP-DOWN; pgrep -x caffeinate; pgrep -f migrate-overnight.sh
# launchd agents present
ls ~/Library/LaunchAgents | grep com.albunyaan
# guardrail still blocks unload
grep -n 'launchctl' ~/.claude/hooks/guardrail.py
# migration flags still as documented
sed -n '1,25p' ~/projects/albunyaan-platform/worker/migrate-videos.ts
```

Volatile facts date-stamped 2026-07-12: tool versions, `chromium-1223` path,
agent list, bundle thresholds (PREUSED 30 / WARN 200 / STOP 250 in
`bundle-meter.sh`), migration counts. Re-verify each with the commands above
before repeating them to anyone.
