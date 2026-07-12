# 301 Redirect Map — Uscreen → New Platform

**Status:** mechanism proven and scripted; the actual redirect map must be
**regenerated fresh on cutover day**, not taken from this file — the old
Uscreen site keeps changing until the domain actually moves, so any mapping
built today will have drifted by the time it matters. What's durable here is
the *how*, verified working on 2026-07-12.

## Static pages (1:1, stable — safe to hardcode now)

| Old (Uscreen) | New |
|---|---|
| `/` | `/` |
| `/catalog` | `/catalog` |
| `/pages/servicevoorwaarden` | `/terms` |
| `/pages/privacybeleid` | `/privacy` |
| `/pages/qa` | `/qa` |
| `/pages/about-us` | `/about-us` |
| `/pages/dawah` | `/dawah` |
| `/pages/contact` | `/contact` |
| `/pages/coupon` | `/coupon` |
| `/pages/downloads` | `/download-app` |

Not carried over (old site has no new-platform equivalent, or the new
platform's structure makes it moot): `/pages/checkout*` (Uscreen's own
checkout, replaced by our Stripe `/join` flow), `/pages/new-payment`,
`/pages/form`, `/pages/Language-prefs` (language switching is a UI control
now, not a page), `/pages/for-creative-souls-159` (unclear old-site page,
low traffic — confirm with founder before cutover if it matters).

## Series & videos (`/programs/:slug`) — mechanism proven, needs a fresh run

The old site's `/programs/:slug` URLs cover two different content types with
no way to tell them apart from the slug alone, and neither the slug nor the
raw page HTML contains a stable ID. Both content types DO expose their
numeric Uscreen id through small, plain, unauthenticated Turbo-Stream
partials the SPA itself lazy-loads:

- **Series/collections**: `GET /programs/:oldslug/collection_homepage?playlist_position=sidebar&preview=false`
  → `200` with `data-program-id="1692483"` in the body. Matches
  `collections.raw->>'uscreen_id'` in our DB → new URL is `/programs/:newslug`
  (the collection's own `slug` column).
- **Standalone videos**: the same request `302`s instead. Fall back to
  `GET /programs/:oldslug/program_content?playlist_position=sidebar&preview=false`
  → `200` with the same `data-program-id="..."` attribute. Matches
  `videos.external_id` → new URL is **also** `/programs/:newslug` (not
  `/watch/:slug` — `/watch` is a dead v0 redirect shim; `/programs/:slug`
  itself resolves a series OR a single video, see `getProgramBySlug()` in
  `packages/core/src/data/catalog.ts`).

Both are cheap plain-HTTP GETs against small partials (a few KB), not full
page loads — no browser needed, no login/session required, verified with
plain `curl`. Fully separate from the IPTV live-stream URLs (those are a
different, credentialed, single-connection-limited system — this reads
ordinary public catalog pages, no risk of interrupting the live broadcast).

**Script**: `worker/build-redirect-map.mjs` — crawls the old sitemap, resolves
every `/programs/:slug`, matches against `collections`/`videos`, writes
`~/.albunyaan-cc/redirect-map-report.json`. Rate-limited (150ms between
requests, concurrency 6) to be a polite guest on someone else's live site.
Read-only against both sides — writes nothing, touches no config.

**Run: `node worker/build-redirect-map.mjs`** (needs `~/.albunyaan-cc/cloud.env`).

### Result of the 2026-07-12 proving run (NOT the cutover-day map — re-run fresh)

- 877 program URLs in the old sitemap.
- **846 matched (96.5%)** — clean old-slug → new-slug pairs.
- **0 unresolvable** — every old slug yielded an id via one of the two partials.
- **31 without a matching DB row**, of which:
  - **29 are the known 24/7 live IPTV channels** (Zaad TV, Rawdah, Makkah,
    Sharjah Quran, Peace TV, Almajd News, Arrahmah, Sunnah, etc. — cross-checked
    against `infra/live-relay/CHANNELS-INVENTORY.md`, ids match exactly). This
    isn't a redirect-map bug — it's the **already-tracked WS6 gap**: live
    channels aren't scraped `videos` rows, so there's nothing to redirect to
    until WS6 seeds channel rows (see the live-row fix note in project memory).
    Independent confirmation the channel-id list is accurate.
  - **2 genuinely new**: `ios-c527ff` (id 4256127) and `collection-5x-9kklweyc`
    (id 4268127) — not in our 07-05 catalog scrape, likely added to the old
    site since. Founder/team should sanity-check these two specifically before
    cutover (are they real content that needs adding, or dead/test entries?).

## Categories (`/categories/:slug`)

Not yet built — same mechanism should work (`data-category-id` was visible on
category links embedded in the collection_homepage partial during this
session's manual check) but wasn't scripted this pass, since categories are a
much smaller set (~25) and lower SEO/bookmark risk than 686+ series pages.
Do this the same way if it's wanted: extend `build-redirect-map.mjs` or just
hand-check the 25 against `categories.slug`.

## Applying the map at cutover

Not wired into `next.config.ts` yet — deliberately. A `redirects()` array or
middleware lookup only matters once the new platform actually owns the
`albunyaan.tv` domain, which it doesn't yet. On cutover day:

1. Re-run `worker/build-redirect-map.mjs` for a fresh, current map (old site
   will have changed since 2026-07-12 — new episodes, maybe new series).
2. Turn `~/.albunyaan-cc/redirect-map-report.json`'s `matched` array into
   either a `redirects()` entry in `next.config.ts` (fine at this scale —
   Next.js has no practical limit around ~900 entries) or a small middleware
   doing an in-memory Map lookup (marginally faster, avoids a large generated
   config file) — either works, middleware is probably cleaner for a
   generated table this size.
3. Add the static-page table above (it won't change, safe to hardcode directly).
4. Deploy alongside the DNS cutover so redirects go live the moment the
   domain does — don't ship them before the new platform is actually live at
   that domain, and don't cut the domain over without them (that's the whole
   point of building this ahead of time).
