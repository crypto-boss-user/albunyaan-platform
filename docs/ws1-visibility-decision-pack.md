# WS1 — Catalog Visibility Decision Pack

**Status:** draft for founder decision. Read-only analysis, no DB writes, no migration applied.
**Data as of:** 2026-07-12, branch `exit-phase` @ `f4eb3a9`.
**Sources:** fresh admin scrape `~/.albunyaan-cc/uscreen-collection-status.jsonl` (692 rows) + live read queries against cloud Supabase (service role, SELECT only).

## TL;DR — numbers first

| Question | Answer |
|---|---|
| Uscreen collections scraped | 692 → **649 published / 43 unpublished** |
| DB collections (686) matched to a scrape row | **686 / 686 (100%)** |
| Scraped collections never imported into DB | 6, all `unpublished` (never had content worth importing) |
| Videos visible **today** under the interim rule (`status='published'`) | **197** — and all 197 already have a Bunny file (100% playable) |
| Videos that WOULD become visible under pure "Variant A" (member of a published collection) | **15,002** — of which only **1,371** have a Bunny file (91% would be broken/empty cards) |
| Published videos that would *disappear* under pure Variant A | 178 (174 belong to no collection at all, 4 sit in unpublished/unresolved collections) |
| Draft videos that would *appear* under pure Variant A | 14,983 (all `status='draft'`) |
| Published collections whose entire episode list has **zero** Bunny files | **503 / 649 (77.5%)** |
| Videos already on Bunny (any status) | 1,584 / 15,861 — of which **1,387 are still `status='draft'`** |
| **Live leak, independent of RLS**, right now | The web app's own data layer bypasses RLS (service-role client) and does **not** filter by status on 4 of 5 read paths — see §5. The 1,387 draft-but-Bunny-ready videos above are reachable **today** through the real site, not just hypothetically through the API. |

**Recommendation in one line:** keep the interim video-status rule (Variant B) as the *gate*, fix the app-layer leak in `catalog.ts`/`search.ts` (this matters regardless of the RLS variant chosen), and only adopt collection-driven visibility (Variant A) — as an **OR**, not a replacement — once the Bunny migration has caught up enough that a published collection's cards are actually playable. Details below.

---

## 1. Scrape breakdown (692 collections)

```
published:   649
unpublished:  43
```
Only two status values appear in the scrape; no `(null)` or other variants. No duplicate `id`s (692 unique).

## 2. Join: scrape ↔ DB `collections`

Join key: `collections.external_id` (text) — confirmed equal to `collections.raw->>'uscreen_id'` on every sampled row, so either works; the code should use `external_id` since it's already indexed via the `unique(source, external_id)` constraint (`supabase/migrations/0001_data_liberation.sql:75`).

| | count |
|---|---|
| Matched (scrape row ↔ DB collection) | **686** |
| Unmatched-from-scrape (scraped id has no DB row) | **6** |
| DB collections missing from scrape (DB has it, scraper never saw it) | **0** |

All 6 unmatched-from-scrape rows are `unpublished`:
```
2731433  Rocky's Adventures | (AR)          unpublished
1935850  The Holy Qur'aan 4 | (AR)          unpublished
1932076  The Arabic Language 4 | (AR)       unpublished
1896337  Al-Aqeedah 4 | (AR)                unpublished
1896336  Al-Aqeedah 3 | (AR)                unpublished
1896335  Al-Aqeedah 3 | (AR) (dup title)    unpublished
```
Reading: these were never important enough to import (empty/near-empty Uscreen collections), which is consistent with them being unpublished on Uscreen too. No action needed — DB coverage of the *scrape* is complete (686/686), and the scrape's coverage of *importable* content is complete (0 DB collections are unaccounted for).

Resolving DB collections against scrape status:
- **649 DB collections → published**
- **37 DB collections → unpublished**
- **0 DB collections → unresolved** (every DB collection got a status)

## 3. Real exposure numbers

### 3a. Current interim rule — `videos.status = 'published'`
(This is what migration `0006_rls_policies.sql:23-25` grants to `anon`/`authenticated` via RLS. NOTE: as detailed in §5, the web app doesn't actually go through this RLS path today — it reads via the service-role client — so this number describes what the *API/RLS* would expose, not necessarily what the *site* currently exposes. See §5 for the site's real number.)

```
videos.status breakdown (15,861 total):
  draft:      15,664
  published:     197
```
**197 videos visible.** All 197 already have `bunny_video_id` set — i.e. everything the interim rule shows is actually playable. Zero broken cards under the status quo.

### 3b. Variant A (pure) — "visible iff member of a published collection"

Membership source: `collection_items` (16,150 rows, 686 distinct collections, 15,571 distinct videos with ≥1 membership; 290 videos have *no* collection membership at all).

```
Videos visible under pure Variant A: 15,002
Of those, videos with a Bunny file (actually playable): 1,371  (9.1%)
```
15,002 cards would render, but ~91% of them (13,631) would be spinner/empty/error states because the source file hasn't been migrated to Bunny yet.

### 3c. Delta sets (current rule vs. pure Variant A)

**Published videos that would DISAPPEAR under pure Variant A** (currently visible, would stop being visible): **178**
- 174 belong to zero collections at all (standalone/orphan published videos)
- 4 sit inside collections that are unpublished or unresolved

Examples:
```
"School"                                  (id 2013094)
"The Clean Street | (AR)"                 (id 1767821)
"The Predator's Target | (AR)"            (id 3732907)
"Bahlool Shepherd"                        (id 2013115)
"أسياد الهواء"                            (id 4171464)
```

**Draft videos that would APPEAR under pure Variant A** (currently hidden, would become visible): **14,983** (100% still `status='draft'` — i.e. never individually marked ready)

Examples:
```
"عدنان ولينا - الحلقة 5"                  (id 4246381)
"Eps 8 61933"                             (id 2120154)
"أسرا الجسد 02 الجزء الثاني"              (id 3956411)
"نيمو وتيمو - 33. الحديقة الأجمل"          (id 4229386)
"10 قسنطينة"                              (id 4050398)
```

### 3d. Published collections with zero playable episodes

```
Published collections with ≥1 member video: 649 / 649 (none are empty)
Published collections where EVERY member video lacks bunny_video_id: 503 / 649 (77.5%)
```
Examples of published series that would render as a fully empty/unplayable card list today:
```
"The Best of Stories | (AR)"                                 (31 episodes, 0 playable)
"Nimo & Timo | (AR)"                                         (37 episodes, 0 playable)
"Hassan and His Brothers — Season 1 | (AR)"                  (14 episodes, 0 playable)
"Heroes of Islaam | (AR)"                                    (10 episodes, 0 playable)
"I'm Best Muslim S4"                                          (4 episodes, 0 playable)
```

### For reference: the OR'd variant already sketched in `0006_rls_policies.sql:27-43`

The migration file itself already drafts a **non-destructive** Variant A — `status in ('published','live') OR member of a published collection` — rather than a pure replacement. Computing that:
```
Visible under (status OR published-collection-membership): 15,180
Of those, with a Bunny file (playable): 1,549
```
This OR form can only ever *add* visibility relative to today (nothing that's visible now stops being visible), which avoids the 178-video regression in §3c. It still shares the core problem: ~90% of the newly-added cards (13,631 of 15,180−197≈14,983 new ones) would have no video file yet.

---

## 4. Recommendation

**Ship with Variant B (today's interim video-status rule) for now. Do not flip to Variant A yet — even the safer OR'd form — until the Bunny migration has materially caught up.** Reasoning from the numbers above:

1. **Playability, not publish-intent, is the actual constraint right now.** Only 1,584 of 15,861 videos (10%) have a `bunny_video_id`, and the migration that produces them is *paused*. The interim rule happens to line up almost perfectly with what's playable (197/197 = 100%). Variant A does not: pure Variant A would show 15,002 cards with 91% broken; the OR'd form shows 15,180 cards with ~90% broken. Either way, the founder (or an early public visitor) would land on a catalog that looks freshly populated but is mostly non-functional — worse than showing fewer, all-working titles.
2. **77.5% of published collections have zero playable episodes today.** Flipping to collection-driven visibility now would surface hundreds of series pages that are just empty/erroring episode lists — a worse experience than the current "small but 100%-working" catalog.
3. **The delta is asymmetric in a way that favors waiting.** Pure Variant A would also *hide* 178 currently-visible published videos (standalone content with no collection), which is a real regression with no offsetting benefit until those collections are populated with playable episodes.
4. **This is a staged decision, not a one-way door.** The OR'd variant in `0006_rls_policies.sql` is already written and reviewed — it's a two-line `drop policy` / `create policy` swap once it's actually time. The right trigger to flip it: once collection-level Bunny coverage crosses some threshold (e.g. "a published collection is only surfaced once ≥1 of its episodes has a bunny_video_id" — a slightly stronger version of Variant A that also guards this doc's §3d finding), not on a calendar date.

**When the migration resumes and this is revisited**, recommend Variant A **OR**'d with status (not a replacement), gated additionally by Bunny-readiness at the collection level, so partially-migrated series don't get exposed as broken. SQL sketch (draft only — not applied, not a migration file):

```sql
-- Step 1: give collections a real published flag, sourced from the scrape
-- (692 rows: ~/.albunyaan-cc/uscreen-collection-status.jsonl), instead of relying
-- on raw jsonb string-matching at query time.
alter table collections add column published boolean not null default false;

-- Backfill (one-off, service-role, run from the scrape JSONL — pseudocode):
--   for each {id, status} in uscreen-collection-status.jsonl:
--     update collections set published = (status = 'published')
--     where external_id = id and source = 'uscreen';
-- 686/692 rows will match (6 unpublished scrape rows were never imported — no-op, already correct default).

create index collections_published_idx on collections (published);

-- Step 2: swap the RLS policy to the OR'd form already drafted in 0006,
-- PLUS require the collection to have at least one Bunny-ready episode so a
-- "published but 0% migrated" series (503 of them today) doesn't get exposed
-- as an all-broken card list:
drop policy "public read published videos" on videos;
create policy "public read published videos" on videos
  for select to anon, authenticated
  using (
    status in ('published', 'live')
    or exists (
      select 1
        from collection_items ci
        join collections c on c.id = ci.collection_id
       where ci.video_id = videos.id
         and c.published is true
         and exists (
           select 1 from collection_items ci2
             join videos v2 on v2.id = ci2.video_id
            where ci2.collection_id = c.id
              and v2.bunny_video_id is not null
         )
    )
  );
```
The inner `exists` is the one addition beyond the migration's own sketch — it encodes the §3d finding (don't expose a collection until it has ≥1 playable episode) directly in the policy rather than relying on app code to hide empty series after the fact.

### `LIVE_CATEGORY_SLUG` fix

`packages/core/src/data/catalog.ts:16` — `LIVE_CATEGORY_SLUG = 'category-channels'` matches **zero** rows in `categories` (verified live). The real row is:
```
external_id: 128768, name: "Channels Live 📡", slug: "channels-live-128768"
```
Fix: change the constant to `'channels-live-128768'`. Net effect today: `getLiveRow()` (`catalog.ts:123-134`) currently always returns `null`, so the "Channels Live" row silently never renders anywhere (home or `/catalog`) — not a leak, but a dead feature. Also, `getCategoryRows()` (`catalog.ts:75`) does `.neq('slug', LIVE_CATEGORY_SLUG)` to keep the live category out of the normal category rails; with the wrong slug this `.neq` is currently a no-op. **Heads up even after the fix:** the `channels-live-128768` category has **0 members today** (`raw.collections: []`, 0 rows in `video_categories`) — fixing the slug alone will not make the row appear; it stays hidden (empty `series`/`videos` → filtered out by the `.filter(r => r.series.length > 0)` / `live ? [...] : []` guards) until WS6's live-channel ingest actually populates it.

---

## 5. Does the current data layer filter by status everywhere? — No.

This is the more urgent finding, and it's **orthogonal to the RLS/Variant decision above**: `packages/core/src/data/client.ts:1-9` documents that all public-facing reads go through `createServiceClient()` — the **service-role** key, which bypasses RLS entirely. The anon-key client (`apps/web/lib/supabase/server.ts:1-34`) is used only for member auth/session cookies, never for catalog data. So whatever policy migration `0006` encodes (interim status rule, Variant A, or the OR'd form) **has no effect on what the actual website renders** — it only matters for a hypothetical direct-to-PostgREST anon caller (e.g. a future mobile app hitting Supabase directly), which doesn't exist yet.

Given that, the real exposure surface is whatever `packages/core/src/data/catalog.ts` and `search.ts` choose to filter in application code. Checked every exported query function against every page that calls it:

| Function | File:line | Status filter? | Used by (anonymous-reachable) |
|---|---|---|---|
| `getCatalogRows()` | `catalog.ts:35-61`, query at `catalog.ts:40-44` | **No** — collections query has no filter on the collection itself, and the nested `collection_items → videos` join uses `VIDEO_COLS` (full row incl. `bunny_video_id`) with no `.eq`/`.in('status', …)` | `apps/web/app/page.tsx:8` (homepage) and `apps/web/app/parents/page.tsx:195` |
| `getCategoryRows()` | `catalog.ts:70-120`, query at `catalog.ts:86-88` | **No** — nested video select is limited to `thumbnail_url, thumbnail_hue` (so no `bunny_video_id`/full row leak here), but `episodeCount` (`catalog.ts:99`) counts draft episodes too, inflating counts shown in category rails | `apps/web/app/catalog/page.tsx:14` |
| `getCategoryBySlug()` / `getLiveRow()` | `catalog.ts:140-155` / `catalog.ts:123-134`, query at `catalog.ts:144` | **No** — `video_categories → videos` join uses full `VIDEO_COLS`, no status filter | `apps/web/app/categories/[slug]/page.tsx:2` directly, and indirectly via `getLiveRow()` on home/`/catalog` (currently moot only because the live category is empty — see §4) |
| `getCollectionBySlug()` | `catalog.ts:168-180`, query at `catalog.ts:172` | **No** — `collection_items → videos` join, full `VIDEO_COLS`, no status filter | `apps/web/app/programs/[slug]/page.tsx:112,244` and `apps/web/app/categories/[slug]/page.tsx:40` — i.e. every series detail page returns **every** episode regardless of `status`, including `bunny_video_id`, so any draft episode that already has a Bunny file is fully playable on its series page today |
| `getVideoBySlug()` (via `getProgramBySlug`) | `catalog.ts:187-204` / `catalog.ts:211-217`, query at `catalog.ts:190-193` | **No** — direct `videos` lookup by slug, zero filtering | `apps/web/app/programs/[slug]/page.tsx:112` — a draft video's own detail/player page is reachable if its slug is known or guessed (e.g. surfaced via a series page link, since `getCollectionBySlug` above links to it regardless of status) |
| `listVideosLite()` | `catalog.ts:227-232` | **No** | Not currently imported by any page under `apps/` or `worker/` (dead code today; `apps/web/app/parents/page.tsx` imports `listCollectionsLite`, not this one) |
| `searchCatalog()` — series half | `search.ts:52-57` | **No** (collections have no status column at all yet — see §2) | `apps/web/app/search/page.tsx:66` — series search returns every matching collection title/slug/cover, published or not |
| `searchCatalog()` — episodes half | `search.ts:58-63` | **Yes** — `.in('status', ['published', 'live'])` | same page — this is the **only** properly-filtered query in the whole data layer |

**Bottom line:** 7 of the 8 query paths that can return content to an anonymous visitor apply no status filter at all; the one path that does (`search.ts` episode search) proves the team knows the pattern, it just wasn't applied consistently. Concretely, this means the 1,387 draft videos that already have a `bunny_video_id` (§ TL;DR) are reachable **today**, right now, on production code, through:
- any series page (`/programs/[slug]`) whose collection contains one of them, and
- direct video pages (`/programs/[slug]` video branch) if the slug is known.

**This should be fixed independently of, and before, the Variant A/B RLS decision** — add `.in('status', ['published','live'])` (or `.eq('published', true)` once collections get that column) to the four unfiltered `catalog.ts` queries and to the `search.ts` collections query. RLS is a good second line of defense for a future direct-API/mobile client, but it is not currently doing any protective work for the website itself.

---

## Appendix: how these numbers were produced

Read-only Node script against `SUPABASE_URL` (service role, `SELECT` only) pulling `collections` (686 rows), `videos` (15,861 rows), `collection_items` (16,150 rows) in full, joined in-memory against the 692-row scrape JSONL. No writes were made; no migration was applied. Script and raw dumps are in the session scratchpad, not committed to the repo.
