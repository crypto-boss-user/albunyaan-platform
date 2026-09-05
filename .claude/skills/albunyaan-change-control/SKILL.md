---
name: albunyaan-change-control
description: >
  Load BEFORE changing anything in the Albunyaan platform (Uscreen exit) —
  editing worker/migration/watchdog/orchestrator code, writing a Supabase
  migration, touching RLS policies, changing concurrency/timeout/cleanup logic,
  committing to the repo, sending or scheduling any outbound push/email, or
  handling secrets. Answers: which changes are forbidden outright, which need a
  stronger model (MODEL FITNESS gate), which need founder sign-off, how to name
  WS-workstream commits, and the historical incident behind every hard rule.
  Also load when a proposed "optimization" would delete or simplify existing
  cleanup/guard code — that is usually a trap documented here.
---

# Albunyaan Change Control

How changes to the Albunyaan platform are classified, gated, reviewed and committed. Every hard rule here was paid for with a real incident; the incident is documented next to the rule so you don't relitigate it.

**Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first, always.** This skill expands it; it never overrides it. If this skill and CLAUDE.md ever appear to disagree, CLAUDE.md wins and this skill needs a maintenance pass.

## When NOT to use this skill

| You actually want | Use instead |
|---|---|
| The three-location layout, what each dir/table is | `albunyaan-architecture-contract`, `albunyaan-data-and-schema-reference` |
| To run/resume/monitor the video migration | `albunyaan-migration-runbook` |
| To debug a stuck/failing migration | `albunyaan-migration-debugging-playbook` |
| Full war stories behind the incidents cited here | `albunyaan-failure-archaeology` |
| Scraper mechanics, Bunny API details | `uscreen-scraping-reference`, `bunny-operations` |
| LaunchAgents, morning report, meters, backups | `albunyaan-ops-and-automations` |
| Verifying counts / QA after a change | `albunyaan-validation-and-qa` |
| Build/dev-env/pnpm/env-var setup | `albunyaan-build-and-env` |
| Program strategy / what "done" means | `albunyaan-platform-replacement-campaign` |

This skill is the *gate*. The siblings are the *work*.

## Vocabulary (defined once)

- **Founder** — the human owner. The only source of sign-off. Only person who can restart the orchestrator (shared browser session needs a human login) or approve the push bank.
- **Twin Chrome** — Chrome for Testing on debug port **9333**, profile `~/.albunyaan-cc/chrome-emdb-clone`, carrying the founder's logged-in Uscreen admin session. Shared by harvest, scrapers, and the push sender.
- **Orchestrator** — `~/.albunyaan-cc/migrate-overnight.sh`, the harvest→transfer loop. Logs to `~/.albunyaan-cc/migrate.log`.
- **Watchdog** — `~/.albunyaan-cc/migration-watchdog.sh`, LaunchAgent `com.albunyaan.migration-watchdog`, every ~5 min. Heals hung transfers; **by design never restarts a down orchestrator**.
- **Manhaj gate** — content-compliance gate in `~/Marketing-Pipelines-Albunyaan` (`scripts/manhaj_gate.py`, approvals via `scripts/approve.py`, log `logs/compliance/gate-log.jsonl`). Nothing outbound ships without it.
- **Service-role key** — `SUPABASE_SERVICE_ROLE_KEY`: bypasses ALL Row Level Security. Full read/write on the entire production database.
- **WS** — Workstream. The exit-phase plan (`~/.claude/plans/regarding-exiting-new-screen-merry-hartmanis.md`) defines WS0–WS10; commits are tagged with them (see commit convention below).
- **Fail-closed** — on any failure, the system ends in the *safe* state (nothing sent, nothing half-created, work re-queued) rather than the convenient one.
- **Sonnet-class** — any session on a mid-tier model or low/medium effort. See MODEL FITNESS.

## Change classification — four tiers

Classify every change before touching a file:

| Tier | What | Gate |
|---|---|---|
| **T0 — free** | Docs, comments, log-message wording, read-only scripts, new tests | None for the change itself. **Since RV 2 (B58, 2026-09-04): review-pipeline step 3 ("contradiction with CLAUDE.md?") + a `Review-log:` line in the commit text** (docs-only: `Review-log: n.v.t. — <reden>`); read-only scripts/new tests follow the light tier (steps 2, 3, 6). |
| **T1 — normal code** | Web UI, admin CMS CRUD, importer tweaks, new scraper fields, copy | Non-negotiables below + WS commit convention. Sonnet-class OK. |
| **T2 — escalation-gated** | Anything on the MODEL FITNESS stop list (watchdog discriminator, concurrency, timeout formulas, fail-closed paths, schema/RLS migrations, auth/billing logic) | STOP if Sonnet-class: tell the founder to switch model/effort. Then proceed under T1 rules + review. |
| **T3 — founder sign-off** | Anything on the founder sign-off list (sends, spend, cutover, live Stripe, resuming after bundle pause, restarting orchestrator…) | Explicit founder yes, in this conversation, for this specific action. No standing approvals. |

A change can be T2 *and* T3 (e.g. a new RLS policy destined for public deploy).

## The non-negotiables (rule → why → incident)

These are settled battles. Do not re-argue them, do not "clean them up", do not optimize them away. Each entry: the rule, the rationale, the incident that created it, and where the evidence lives.

### 1. Never `npx` / `npm exec` for worker scripts
Always the direct binary: `worker/node_modules/.bin/tsx worker/<script>.ts` from repo root, or `cd worker && node_modules/.bin/tsx <script>.ts` (the repo root has NO `node_modules/.bin` — the tsx binary exists only under `worker/`; verified 2026-07-12).
**Why:** `npx` hangs unpredictably mid-pipeline — an overnight run dies silently.
**Evidence:** CLAUDE.md "Commands"; header comment of `~/.albunyaan-cc/migrate-overnight.sh` ("npx/npm exec was found to hang unpredictably, never use it for this pipeline").
**Gotcha:** some older docstrings (e.g. `worker/verify-rls.ts` line 7) still say `npx tsx …`. CLAUDE.md overrides them — substitute `node_modules/.bin/tsx`.

### 2. Never `spawnSync` in worker code — async `spawn` only
**Why:** `spawnSync` blocks Node's event loop, so "parallel" workers silently serialize. CONCURRENCY=5 was configured but only 1 ffmpeg ever ran (comment at `worker/migrate-videos.ts` line ~174).
**Incident:** discovered overnight; fixed in commit `9623f97` "Fix real concurrency: spawnSync blocked Node's event loop, killing parallelism".
**Verfijning (founder 2026-09-04, B56/F1):** de regel is absoluut voor alles met parallelle workers (migratie, harvest/transfer, wachter). In strikt sequentiële CLI-scripts (bv. de audit-/archiefscripts met `ssh` via `spawnSync`) is de aanroep toegestaan **alleen met** (a) een verantwoording in de commit-tekst en (b) een commentaarregel bij de aanroep die zegt waarom het hier veilig is. Geen ombouw van de 17 bestaande scripts. Stil afwijken (zonder a én b) blijft een overtreding — RV 1 stap 5.

### 3. Never close the LAST page in the shared :9333 Chrome
**Why:** a page-less browser breaks `connectOverCDP` for every future script on the shared session — and only the founder can rebuild that session.
**Pattern to copy:** the watchdog's TAB-GC opens `about:blank` FIRST, then closes Uscreen tabs (`migration-watchdog.sh` lines 27–37, "hard-learned rule"). Any script you write that closes tabs must do the same.

### 4. Never remove the fail-closed transfer cleanup
On transfer failure `worker/migrate-videos.ts` does BOTH: (a) nulls `videos.uscreen_hls_url` so the video re-harvests a fresh Mux token (line ~230 — harvest skips rows with a URL set, and a failed token never gets fresher: removing this strands the video forever), and (b) deletes the just-created empty Bunny placeholder via `deleteVideo` (line ~237).
**Incident (2026-07-10, the worst one):** `createVideo` succeeded but ffmpeg/upload failed on expired Mux tokens (~159-min life) — thousands of 403s left ~97% of the Bunny library as 0-byte orphan entries (5,042 failures against 6,017 entries; counts per founder debrief 2026-07-12). Fixed by on-failure `deleteVideo` + the preflight that clears already-expired token URLs before transfer (lines ~253–263; commit `e380440` "stop wasting 80% of transfer attempts on expired Mux tokens"). Both halves are load-bearing. A reviewer seeing "delete the video we just created" as wasteful is wrong.

### 5. RLS stays deny-by-default; real policies + auth BEFORE any public deploy
All tables are RLS-ON. `0006_rls_policies.sql` opens exactly two read surfaces (public catalog, "my own rows"); **no anon/authenticated write policies exist anywhere** — all writes go through the service role or SECURITY DEFINER RPCs. Do not add write policies "to make something work"; fix the server action instead.
**Why this is a deploy gate:** `docs/security-findings-report.md` documents that unsigned Bunny embeds would let any anonymous visitor watch every migrated paid video — WS5 signed playback + entitlement gating is blocking for any public demo/launch.
**Verification is mandatory** after any schema/policy change: run `worker/verify-rls.ts` (env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `--no-members` while no test users exist). Exit 1 = FAIL = do not commit.

### 6. Outbound push requires a manhaj-gate SHA approval — never bypass
`worker/send-push-notification.mjs` refuses to send unless the **sha256 of the entire bank file** (`~/Marketing-Pipelines-Albunyaan/state/push-notifications-bank.json`) has a `PASS`/`APPROVED` entry (`content_sha256` field) in `~/Marketing-Pipelines-Albunyaan/logs/compliance/gate-log.jsonl`. ANY edit to the bank — even a typo fix — changes the sha and blocks sending until the founder re-approves via `scripts/approve.py`. Rotation state is deliberately in a *separate* file (`state/push-rotation.json`) so sending never mutates the approved bank. Additional rails: waits for a harvest-free twin-browser window, `DRY_RUN=1` mode, Uscreen length limits (title 65 / message 178), every send appended to `logs/publish/push-log.txt`.
**Never** hand-append a gate-log line, "temporarily" widen the accepted verdicts, or move rotation state into the bank. The gate exists because outbound religious content is the founder's personal responsibility.

### 7. Marketing automations are drafts-only, fail-closed
The weekly email run (`~/.albunyaan-cc/weekly-email-draft.sh`, Mon 09:00) drafts + gates + creates a Brevo DRAFT + sends a test to info@ — **it never sends to a list, structurally**: `scripts/brevo_client.py` in the marketing repo has no list-send code path at all, and the manhaj gate fails closed. Push (Fri 10:00, `weekly-push-notification.sh`) sends only pre-approved bank items (rule 6). Adding a list-send capability to `brevo_client.py`, or any new automation that emits to real recipients without a founder-approval step, is a T3 change.

### 8. Secrets discipline
Secret env files live in `~/.albunyaan-cc/` at mode 600: `cloud.env`, `brevo.env`, `resend.env`, `supabase-*.env`, `webhook.env`. **Never read, cat, quote, echo, log, or commit their contents.** Load with `set -a; source ~/.albunyaan-cc/cloud.env; set +a` and refer to variables by NAME only. (No contradiction: sourcing EXECUTES the file to load vars into the shell — required and allowed; READING/printing its contents is what's forbidden.)
**Why the two crown jewels are dangerous:**
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all RLS: full read/write/delete on the entire production catalog, members, billing state. Leaking it = total DB compromise.
- `BUNNY_API_KEY` (with `BUNNY_LIBRARY_ID`) — the Stream library key authenticates `deleteVideo` (`worker/lib/bunny.ts` line ~87): it can delete the whole migrated video library, i.e. weeks of metered-bandwidth work.
If a secret value ever appears in your context (log excerpt, screenshot), tell the founder to rotate it. Do not paste it anywhere else.

### 9. Standing migration disciplines (summary — details in sibling skills)
These are also change-control constraints; changing any is a T2 stop:
- Harvest: **sequential, ONE page, 1.8 s politeness delay** (`page.waitForTimeout(1800)`, migrate-videos.ts line ~141) — concurrent Uscreen admin loads trip hCaptcha.
- Transfer: parallel, `CONCURRENCY` env, **default 5** (line 38).
- Ordering: **smallest-first** (duration asc) — metered 400 GB bundle, every video costs ~2× its size (down + up). Meter: `bundle-meter.sh`, `WARN_GB=200`, `STOP_GB=250` (auto-pause kills the orchestrator; founder decides resume).
- ffmpeg timeout = **Mux-token remaining life minus 5-min margin, floored** (line ~193) — replaced the fixed 40-min SIGKILL that killed long lectures repeatedly.
- Supabase REST **clamps to 1000 rows silently** — always paginate and verify counts.
- Scrapers fail honest (report the failure), never guess or fabricate.

## Commit convention — WS-numbered workstreams (verified in `git log`, 2026-07-12)

Work happens on branch **`exit-phase`** (current; `main` exists — do not commit to it for exit-phase work). Subject format, as actually used:

```
WS7: admin security foundation — roster gate + mandatory TOTP (aal2)
WS8 (adopt-not-recreate): adopt-subscriptions.ts + audit price buckets
WS2: migrations 0003-0008 (identity, billing/entitlements, …) + verify-rls harness
WS0+WS1: fresh people import (2,926 rows), untrack PII fixture, …
```

- Prefix `WS<n>:` (combine with `+` when a commit genuinely spans workstreams; optional parenthetical qualifier). Subject states *what landed*, concretely — file names, counts, mechanism. No vague "improvements".
- **Since RV 2 (B50, founder 2026-09-04): line 1 of every commit text is `Review-log: …` (or `Review-log: n.v.t. — <reden>`); the `WS<n>:`/`docs:` subject that states *what landed* moves to line 3 (after the blank line). Enforced by `.claude/hooks/review-log-check.py` via the repo `.claude/settings.json`.** (Aanname, aanpasbaar: subject-first with the Review-log in the body is the alternative form — the check accepts both.)
- Non-workstream commits use conventional prefixes seen in the log: `docs:`, `fix(<area>):`, `security:`, `baseline:`.
- Workstream definitions (WS0–WS10) live in `~/.claude/plans/regarding-exiting-new-screen-merry-hartmanis.md` ("## Workstreams"). Observed mapping from the log: WS0 provisioning/forensics · WS1 catalog visibility · WS2 schema+RLS migrations · WS3 member auth/PIN · WS4 Stripe billing · WS5 signed playback/XSS · WS6 live channels (IPTV relay) · WS7 admin CMS/security · WS8 subscriber migration · WS9 member parity (search/progress) · WS10 legal/ops.
- Tag new work with the WS it advances; if none fits, it is probably scope creep — check the plan before inventing WS11.
- Some work is deliberately uncommitted by instruction (e.g. `infra/live-relay/` as of 2026-07-12) — do not "helpfully" commit files you didn't change.

## Founder sign-off list (T3) — never do these on your own initiative

Explicit, current-conversation founder approval required for:

1. **Any real send** to members/subscribers/push users (email list, push, SMS). Drafts and DRY_RUN are fine.
2. **Approving or editing the push bank** — edits are fine, but sending requires the founder to run `scripts/approve.py` on the new sha.
3. **Restarting the orchestrator** — the shared browser session needs a human; the watchdog logs `ORCHESTRATOR DOWN` and deliberately does NOT restart (as of 2026-07-12 it has been down since 2026-07-11 23:12).
4. **Resuming migration after a bundle STOP** (≥250 GB auto-pause) or knowingly spending large bandwidth (big-video batches).
5. **Anything Stripe live-mode** — live keys, live prices, live charges. Test mode is fine. (`stripe-setup.ts` marks live as founder-gated.)
6. **Subscriber-migration execution** (WS8 batches touching real people/payments) — plan says "execution founder-gated".
7. **Cutover actions**: DNS flips, Uscreen termination notice, cancelling Zaps. Iron rule from the plan: **data-out-before-notice** (Uscreen deletes everything 30 days after termination).
8. **Any public deploy** of the web app (see rule 5 — RLS + signed playback are blocking).
9. **Publishing legal pages** (terms/privacy are DRAFTS, commit `b812493`) and anything with rights implications (e.g. relaying outside IPTV feeds — founder's standing call).
10. **Deleting data at scale** (Bunny videos, Supabase rows) outside the established fail-closed cleanup path.
11. **Secret rotation or granting any new service access.**

When in doubt whether something is T3: it is. Ask.

## MODEL FITNESS — a first-class change-control gate

Owner's rule (2026-07-12): every skill states what a Sonnet-class session may do alone and where it must STOP. This is a gate like any other — proceeding anyway is a change-control violation even if the code "works".

The plan itself set the precedent (`regarding-exiting-new-screen-merry-hartmanis.md`, "Model" section): strong-model/high-effort for the security/billing-critical core (WS1–WS6, WS8); Sonnet acceptable for mechanical stretches (WS7 admin CRUD, WS10 content/ops).

**Sonnet-class MAY do alone (T0/T1):**
- Read/diagnose/report anything; run `/migration-status`; tail logs; run read-only queries with count verification.
- Web UI and admin CMS CRUD, copy, styling, i18n.
- New tests, docs, comments; scraping new *display* fields following an existing scraper's pattern.
- Re-running existing scripts exactly as documented (no flag/param changes) — respecting the T3 list.
- Drafting (never sending) marketing content through the existing gated pipelines.

**Sonnet-class MUST STOP and say: "escalate to a stronger model / higher effort" before touching:**

| Area | Why it's above the line |
|---|---|
| Watchdog hang-discriminator logic (`migration-watchdog.sh` lines ~64–95) | The previous "obvious" check matched the tsx wrapper pid (always 0 ffmpeg children) and **killed 5 healthy long downloads per pass — an entire evening of zero progress**. The current `ppid != 1` rule is pid-topology-proof and its edge cases (orphans must NOT count as active or healing is suppressed forever) are subtle. |
| Concurrency values / parallelism model (`CONCURRENCY`, harvest sequentiality, one-page rule) | Coupled to hCaptcha thresholds, the metered bundle, Mux token life, and macOS memory (tab blow-up incident). |
| Timeout formulas (token-life-based ffmpeg timeout, watchdog 5-min staleness, temp-sweep ages) | Each constant encodes an incident (634 SIGKILLs of long lectures under the old fixed 40-min timeout; 5 GB temp leaks; poll starvation). |
| Any fail-closed path (rule 4 cleanup, gate refusals, bundle STOP, orchestrator no-auto-restart) | Fail-closed code *looks* removable by design. Weakening it converts loud failures into silent data corruption. |
| Supabase schema migrations + RLS policies (`supabase/migrations/`) | Production data, deny-by-default contract, column grants; a wrong policy exposes paid content or member PII. Conventions are strict (text + CHECK, never enums; RLS ON). |
| Auth, billing, entitlement, playback-signing code (WS3/WS4/WS5 surfaces) | Security-review-hardened (commits `cd664b7`, `f81a7cc`); regressions are exploitable, not just buggy. |
| The manhaj gate and anything that sends (`send-push-notification.mjs`, `brevo_client.py`, gate scripts) | Religious-content compliance + real recipients. |

**Stop protocol:** state (1) what you were asked, (2) which stop-list area it hits, (3) the one-line risk, then: *"This needs a stronger model / higher effort — please switch (`/model`, `/effort`) before I proceed."* Then do NOT proceed, not even "just a draft diff" of the guarded logic.

## Review requirements before committing (any tier)

1. **No contradiction with CLAUDE.md** — reread it against your diff.
2. Schema/policy touched → `verify-rls.ts` passes (exit 0).
3. ⛔ **n.v.t. sinds 2026-09-02 (Bunny gestopt; B49, RV 2):** ~~Migration pipeline touched → `/migration-status` clean, and confirm in `migrate.log` that a real transfer completed post-change before declaring victory.~~ Log deze eis als "n.v.t." in de Review-log; niet verwijderen (historie). Herleeft alleen bij de kijkplatformkeuze.
4. Worker code touched → grep your diff for `spawnSync` and `npx`; confirm error paths still clean up (rule 4 pattern).
5. Anything that closes browser pages → blank-page-first pattern present.
6. Counts claimed → verified with pagination (1000-row clamp).
7. Security-adjacent (auth/billing/playback/RLS) → an adversarial security review pass is the established practice (see commits `f81a7cc`, `cd664b7`, and `docs/security-findings-report.md`).

## Provenance and maintenance

Facts date-stamped 2026-07-12. Re-verify before trusting:

```bash
# The manifest this skill must never contradict
cat ~/projects/albunyaan-platform/CLAUDE.md
# WS commit convention + current branch
git -C ~/projects/albunyaan-platform log --oneline | head -40 && git -C ~/projects/albunyaan-platform branch
# Workstream definitions + founder gates
grep -n "^### WS\|founder-gated\|sign-off" ~/.claude/plans/regarding-exiting-new-screen-merry-hartmanis.md
# Fail-closed transfer cleanup still present (both halves)
grep -n "uscreen_hls_url: null\|deleteVideo(cfg, guid)" ~/projects/albunyaan-platform/worker/migrate-videos.ts
# CONCURRENCY default + politeness delay + token-life timeout
grep -n "CONCURRENCY ??\|waitForTimeout(1800)\|remaining life" ~/projects/albunyaan-platform/worker/migrate-videos.ts
# Watchdog discriminator (ppid != 1) + no-orchestrator-restart stance
grep -n "ppid\|ORCHESTRATOR DOWN" ~/.albunyaan-cc/migration-watchdog.sh
# Bundle meter thresholds
grep -n "WARN_GB\|STOP_GB" ~/.albunyaan-cc/bundle-meter.sh
# Push gate: sha check + approve path
grep -n "content_sha256\|approve.py" ~/projects/albunyaan-platform/worker/send-push-notification.mjs
# Drafts-only email claim (no list-send code path)
grep -rn "def .*send" ~/Marketing-Pipelines-Albunyaan/scripts/brevo_client.py
# RLS posture
head -20 ~/projects/albunyaan-platform/supabase/migrations/0006_rls_policies.sql
# Secret files exist and are 600 (names only — never open)
ls -l ~/.albunyaan-cc/*.env
```

If any check disagrees with this skill, the repo is right — update this file.
