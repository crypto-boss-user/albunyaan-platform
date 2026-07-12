-- 0006_rls_policies.sql — THE first RLS policies in the project.
--
-- Until now every table was RLS-ON with zero policies (deny-by-default,
-- service-role only). This migration opens exactly two surfaces:
--   1. the public catalog (videos/categories/collections/… , plans) for
--      anon + authenticated, and
--   2. "my own rows" for authenticated members (people, entitlements,
--      households → profiles → overrides → watch_progress, voucher_redemptions).
--
-- ⚠ FOUNDER-PENDING (WS1): the catalog visibility rule. Implemented here is the
-- interim rule `status in ('published','live')`. Variant A (also expose videos
-- that belong to a published collection) is written out in a comment block
-- below, ready to swap in once WS1 lands a `collections.published` column.
-- Variant B (backfill videos.status from collection membership, keep the simple
-- policy) is documented there too.
--
-- NO INSERT/UPDATE/DELETE policies exist for anon/authenticated ANYWHERE.
-- All writes go through the service role (server actions / workers) or
-- SECURITY DEFINER RPCs (redeem_voucher). Do not add write policies here.

-- ── videos: row visibility ──────────────────────────────────────────────────

create policy "public read published videos" on videos
  for select to anon, authenticated
  using (status in ('published', 'live'));

-- VARIANT A — swap the policy above for this once WS1 adds collections.published
-- (until then `collections` has no published flag; the scraped raw jsonb only
-- carries cover_url/count, so there is nothing reliable to key on yet):
--
--   drop policy "public read published videos" on videos;
--   create policy "public read published videos" on videos
--     for select to anon, authenticated
--     using (
--       status in ('published', 'live')
--       or exists (
--         select 1
--           from collection_items ci
--           join collections c on c.id = ci.collection_id
--          where ci.video_id = videos.id
--            and c.published is true
--       )
--     );
--
-- VARIANT B — instead of widening the policy, backfill videos.status to
-- 'published' for every video that belongs to a published collection (one-off
-- service-role UPDATE) and keep the simple status-only policy above. Cheaper
-- per-query; needs a re-run whenever collection publishing changes.

-- ── videos: column protection ───────────────────────────────────────────────
-- Clients may read ONLY the safe columns. raw (full Uscreen record),
-- uscreen_video_url / uscreen_hls_url (origin playback URLs) and
-- live_stream_url / live_provider (stream source) stay service-role only.
-- Columns added later (e.g. 0007 age_rating_source) are NOT granted unless a
-- migration grants them explicitly.
-- NB (PostgREST): with column grants, `select=*` fails for these roles —
-- clients must request explicit columns.

revoke select on videos from anon, authenticated;
grant select (
  id, external_id, source, title, slug, short_description, description,
  thumbnail_url, thumbnail_hue, duration_seconds, status, publish_at, access,
  age_rating, bunny_video_id, seo, resources, subtitle_tracks, audio_tracks,
  created_at, updated_at
) on videos to anon, authenticated;

-- ── catalog structure: world-readable ───────────────────────────────────────
-- collections.raw carries only cover_url/count (scraper output) — nothing
-- sensitive, so no column revoke is needed on any of these tables.

create policy "public read categories" on categories
  for select to anon, authenticated using (true);
create policy "public read collections" on collections
  for select to anon, authenticated using (true);
create policy "public read collection_items" on collection_items
  for select to anon, authenticated using (true);
create policy "public read video_categories" on video_categories
  for select to anon, authenticated using (true);
create policy "public read filters" on filters
  for select to anon, authenticated using (true);
create policy "public read filter_values" on filter_values
  for select to anon, authenticated using (true);
create policy "public read video_filter_values" on video_filter_values
  for select to anon, authenticated using (true);
create policy "public read authors" on authors
  for select to anon, authenticated using (true);
create policy "public read video_authors" on video_authors
  for select to anon, authenticated using (true);

-- ── plans: public price list ────────────────────────────────────────────────

create policy "public read public plans" on plans
  for select to anon, authenticated
  using (visibility = 'public');

-- ── member self-service reads ───────────────────────────────────────────────

create policy "member reads own person" on people
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy "member reads own entitlements" on entitlements
  for select to authenticated
  using (person_id in (select id from people where auth_user_id = auth.uid()));

create policy "member reads own voucher redemptions" on voucher_redemptions
  for select to authenticated
  using (person_id in (select id from people where auth_user_id = auth.uid()));

create policy "owner reads own household" on households
  for select to authenticated
  using (owner_person_id in (select id from people where auth_user_id = auth.uid()));

create policy "owner reads household profiles" on profiles
  for select to authenticated
  using (
    exists (
      select 1
        from households h
        join people pe on pe.id = h.owner_person_id
       where h.id = profiles.household_id
         and pe.auth_user_id = auth.uid()
    )
  );

create policy "owner reads household overrides" on content_overrides
  for select to authenticated
  using (
    exists (
      select 1
        from profiles pr
        join households h on h.id = pr.household_id
        join people pe on pe.id = h.owner_person_id
       where pr.id = content_overrides.profile_id
         and pe.auth_user_id = auth.uid()
    )
  );

create policy "owner reads household watch progress" on watch_progress
  for select to authenticated
  using (
    exists (
      select 1
        from profiles pr
        join households h on h.id = pr.household_id
        join people pe on pe.id = h.owner_person_id
       where pr.id = watch_progress.profile_id
         and pe.auth_user_id = auth.uid()
    )
  );

-- ── deliberately CLOSED (zero policies, service-role only) ──────────────────
-- subscriptions      — imported legacy billing record
-- leads              — marketing PII
-- uscreen_events     — raw webhook inbox
-- stripe_events      — raw webhook inbox
-- export_manifest    — migration bookkeeping
-- vouchers           — codes must never be enumerable; redemption goes through
--                      the redeem_voucher() RPC only
-- voucher_attempts   — rate-limit internals
-- platform_admins    — admin roster
-- These tables keep RLS ON with NO policies. Do not open them.
