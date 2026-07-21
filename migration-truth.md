# Migration Truth — true member-watchable video count

Verified 2026-07-21 (read-only audit; no visibility variants or code changed).
Task: determine the TRUE set of videos a paying member can watch on albunyaan.tv
today, versus the repo's suspected-wrong "197 published videos" figure.

**TLDR: Members can watch 15,180 videos today, not 197. Only ~10.2% of that is
on Bunny. The "published tier complete" claim covers just 1.3% of what members
actually watch.**

## 1. True watchable set (Supabase + scrape join)

Uscreen's member-facing unit is the published **collection** (649 of 692).
Joining `~/.albunyaan-cc/uscreen-collection-status.jsonl` ×
`uscreen-collection-members.jsonl` against the full 15,861-row `videos` catalog
(paginated 1000-row pages, count-verified against a `Prefer: count=exact` header):

| Measure | Count |
|---|---|
| Videos inside published collections | **15,002** (94.6% of catalog) |
| Standalone `status=published` videos outside those collections | +178 |
| **True member-watchable universe** | **15,180** |

The repo's "197 published" counts only videos with `status=published`; only 19
of those are even inside published collections. The ~15k videos marked `draft`
in the DB are draft *as standalone items* — they are still served to members
through their collections.

## 2. Spot check — 20/20 confirmed

- **Uscreen admin** (twin Chrome on :9333; founder session alive 2026-07-21):
  all 20 sampled videos present in their collections, each collection gated
  (subscription). Storefront slugs harvested from each collection's SEO field.
- **Live site albunyaan.tv** (driven via the real Chrome through the
  chrome-devtools MCP): all 20 `/programs/<slug>` pages render publicly, show
  "Subscribe to watch" (member-watchable), and the live "N VIDEOS" count matched
  the scrape **exactly on every one of 20**
  (18, 15, 27, 29, 22, 9, 13, 28, 30, 4, 34, 10, 25, 30, 10, 11, 25, 16, 30, 13).

Method note: the admin collection-details page cannot be text-scraped for
publish status (it lists all three visibility options — Unpublished / Published /
Scheduled — as labels, and the radio widgets are custom components). The live
site is the status ground truth — and it agreed with the scrape everywhere.

## 3. Corrected migration numbers

- On Bunny within the watchable universe: 1,371 (in published collections)
  + 178 (standalone published — all migrated; verified 0 unmigrated published
  live) = **1,549 of 15,180 ≈ 10.2%**.
- 35 of the 1,584 total migrated videos are not member-visible at all.
- Remaining member-visible backlog: **13,631 videos, ~2,453 hours**, median
  9 min; only 56 exceed an hour.

## 4. Proposed transfer queue (member-visible first, smallest first)

Ordering the 13,631 unmigrated member-visible videos by duration gives very
cheap early wins:

| Tranche | Cumulative video-hours |
|---|---|
| First 1,000 | ~25 h (all ≤2 min) |
| First 5,000 | ~307 h (all ≤7 min) |
| First 10,000 | ~1,127 h (all ≤13 min) |
| All 13,631 | ~2,453 h |

The 646 unmigrated non-member-visible videos go last.

**Not implemented.** This changes the harvest/transfer selection in
`worker/migrate-videos.ts` (currently `status=published` first, shortest
first) — a guarded fail-closed path, so it needs the change-control gate and
founder sign-off first. The simplest shape: order by a precomputed
"member-visible" flag (an ID set or a column) instead of `status`.

## Provenance

- Counts derived live 2026-07-21 with header counts + paginated reads
  (Supabase 1000-row clamp respected; totals cross-checked).
- Session memory: `~/.claude/projects/-Users-a2020-projects-albunyaan-platform/memory/watchable-video-truth.md`
  (also records the operational gotchas: sandboxed Chrome-for-Testing launch
  wedges renderers; page-level CDP websocket dies on cross-process navigation;
  chrome-devtools MCP `--autoConnect` needs in-browser consent).
