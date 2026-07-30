# Residual-19 + Bunny-debris session report — 2026-07-30

Scope: MASTER-PLAN §A2.3 (the 19 member-visible videos not on Bunny) and §A1.3
(62 Bunny-side debris objects). Goal: the cutover gate's "100% member-visible on
Bunny" audit re-run passes by Fri 7 Aug. Everything below was verified live
today (read-only probes; no bursts run, no queue changes, nothing member-facing
touched).

## TL;DR

1. **All 19 gate-blocking videos are recoverable — none is gone at the source.**
   All 19 (plus non-member `2811589`) were pulled to
   `~/.albunyaan-cc/residual-media/<id>.mp4` today with fresh Mux tokens and
   verified against catalog durations (20/20 exact match, 0.41 GB total).
2. **BLOCKER (P0): `BUNNY_API_KEY` is dead.** Every Bunny management API call
   401s from both Mac and VPS. Uploads, debris reconciliation, and any future
   poll are all blocked until the key is refreshed. **Serving is unaffected**
   (embed 200, direct-CDN 403-by-design) — members see nothing.
3. Once the key is refreshed, one command uploads all 20 — **no burst, no
   Uscreen session, no harvest needed**: `worker/upload-residual-media.ts`.
4. The 12 remaining unmigrated videos (نكتة ومن أول السطر 1–12) are **genuinely
   deleted at Uscreen** ("Not Found" page) — and they are non-member-visible,
   so they never blocked the gate. Correctly parked as `skip_no_hls`.
5. The §A1.3 debris work could not be executed (needs the API key). The
   reconciliation script is ready: `~/.albunyaan-cc/reconcile-bunny.py`.

## 1. The audit join — exactly 19

`source='uscreen' AND member_visible AND bunny_video_id IS NULL` → **19 rows**
(content-range 0-18/19), all `status='draft'`, durations 65–489 s. Manifest
(`entity='video_migration'`): 18 × `skip_no_hls` (two-strike `no_hls`), 1 ×
`failed` (`2224176`).

## 2. Per-video classification (all 19 + the second looper)

Source-probed today on the Uscreen admin (read-only, sequential, harvest's
politeness delays; evidence in `~/.albunyaan-cc/residual-media/audit/`).

### 2a. The 18 "stream-less" skips — FALSE POSITIVES, all alive

Every one of the 18 serves a healthy multi-variant Mux HLS stream today:

| external_id | title | HLS variants | pulled (MB) |
|---|---|---|---|
| 1932168 | مازن وثعلوب  الخطأ في تنوين الاسم المنقوص | 4 | 20.9 |
| 1993076 | My friend 7 | 4 | 23.1 |
| 2097495 | EPS-8 27673 | 5 | 13.8 |
| 2097498 | EPS-21 20730 | 5 | 14.1 |
| 2114210 | الرفق خلق فاضل | 5 | 14.6 |
| 2123842 | الحلقة الأولى من حلقات سوبر صائم مع فهيم ورقيم | 5 | 20.8 |
| 2123908 | أخلاقيات الصائم  #يوميات صائم | 5 | 11.4 |
| 2145846 | مختار أم مجبور ؟ | 5 | 20.3 |
| 2566995 | Zad Minute0059 | 4 | 8.9 |
| 2571545 | Zad Zker00019 | 4 | 10.4 |
| 2787093 | سورة الفلق - ريان قارئ القران | 4 | 8.4 |
| 2808078 | فريق الصحة 14 | 4 | 134.4 |
| 2812768 | Omar & Hana — Let's Go To The Masjid | 3 | 17.8 |
| 2812769 | Loving Orphans — Omar & Hana | 3 | 17.7 |
| 3956494 | حروف الهجاء - الموسم الثاني 05 | 3 | 7.1 |
| 4034529 | حروفنا الجميلة 05 | 4 | 9.8 |
| 4034542 | حروفنا الجميلة 10 | 4 | 10.0 |
| 4160283 | عالم الخضروات - الحلقة 14 | 4 | 31.3 |

**What went wrong:** their `no_hls` strikes were all recorded 2026-07-22/23 —
inside the heavy-burst window (the same campaign that produced the 403 storm,
§A2.2). Under that load the admin player intermittently never requested its
manifest within harvest's sniff window; two transient misses = a permanent
`skip_no_hls`. Probed calmly today, all 18 stream instantly. **Fix applied:**
files pulled locally with the pipeline's own rendition choice (`-map 0:p:1`);
upload pending the Bunny key (§4).

### 2b. The 2 harvest-loopers — single-rendition streams, pipeline can never transfer them

`2224176` (ملحق لحلقة ١٨, member-visible, **102 identical failures**) and
`2811589` (A Is For Allah, non-member, 3/3 failures): both serve a Mux master
playlist with **exactly one variant**, so ffmpeg's hard-coded `-map 0:p:1`
(program *1*, i.e. the second variant) matches nothing → `Stream map '0:p:1'
matches no streams` → fail-closed null of `uscreen_hls_url` → re-harvest → same
failure, forever. 22 other videos hit this error once during the campaign and
healed on re-harvest (Mux sometimes re-serves a multi-variant master); these two
never did — re-queueing can never fix them. **Fix applied:** pulled today with
`-map 0:p:0`; upload pending the Bunny key. No pipeline code change needed (the
pipeline's queue is empty; a fallback-mapping patch is only worth doing if
harvest-style work ever resumes — noted, not implemented).

### 2c. The 12 نكتة ومن أول السطر episodes — genuinely gone at the source

`2528039/40/43/46/48/51/53/56/59/61/63/65`: admin details pages render
Uscreen's **"Not Found — Oops! Couldn't find what you were looking for."**
(captures in `audit/no-hls-25280*.txt`). Deleted at Uscreen; unrecoverable from
here. They are **non-member-visible**, so they do not block the gate.
`skip_no_hls` is the correct permanent state — no action taken, none needed.
*Founder judgment (non-blocking):* if these episodes matter, they'd have to be
re-sourced outside Uscreen.

## 3. P0 incident: BUNNY_API_KEY invalidated server-side

- Last proven-working call: **2026-07-25 03:16 UTC** (final VPS transfer).
- Today: `GET /library/697882/videos[...]` → **401** from Mac AND VPS; same key
  fingerprint both sides; `cloud.env` files untouched (mtimes Jul 12 / Jul 22).
  ⇒ invalidated at Bunny's side, sometime Jul 25–30.
- Nothing noticed because the VPS poll's done-set now covers all 15,822
  migrated videos — it makes **zero** live API calls, so "poll: finished 15822"
  keeps printing against a dead key.
- Serving is fine: embed 200, direct-CDN 403 (Block Direct URL Access, as
  designed). Members unaffected.
- **Founder action:** Bunny dashboard → Stream library 697882 → API key; put
  the current value in `~/.albunyaan-cc/cloud.env` (Mac) and
  `/root/.albunyaan-cc/cloud.env` (VPS), then restart
  `albunyaan-transfer.service`. **If you did not rotate this key yourself,
  treat it as a security event** (check Bunny panel access/audit history before
  reusing).

## 4. Runbook to close the gate (after the key is refreshed)

```bash
cd ~/projects/albunyaan-platform/worker
node_modules/.bin/tsx upload-residual-media.ts            # dry-run, shows the 20
node_modules/.bin/tsx upload-residual-media.ts --execute  # uploads, sets bunny_video_id + manifest 'fetched'
node_modules/.bin/tsx migrate-videos.ts --poll            # (or let the VPS poll) until all 20 are 'done'
# THEN delete ~/.albunyaan-cc/residual-media/*.mp4
```

The script is fail-closed (placeholder deleted on any failure, local file kept,
manifest untouched on failure) and aborts loudly if the key still 401s.
Expected end state: member-visible on Bunny **15,180 / 15,180 (100%)** — gate 1
audit passes; total migrated 15,849; unmigrated remainder = the 12 deleted نكتة.

## 5. §A1.3 debris (62 objects) — status

Blocked by the dead key; also, the 2026-07-22 lists (`bunny-bad-tracked.json`,
`bunny-untracked.json`) died with that session's scratchpad, and the safety
rules require recomputing fresh lists in the same run as any action anyway.
Ready to run once the key works: `python3 ~/.albunyaan-cc/reconcile-bunny.py`
(read-only; paginated DB + full library listing; emits per-item
adoption-vs-delete candidates incl. title-matched DB rows and their guid
health). Notes for that run:

- Since 07-22, ~14,000 more videos transferred — most of the 57 non-empty
  untracked duplicates' DB rows have likely re-migrated under NEW guids, making
  the untracked copies pure duplicates (delete candidates, founder approval
  required for any bulk delete — standing rule).
- The "2 tracked encode-failed" from 07-22 may have self-healed (today's
  manifest shows 0 `bunny_encode_failed`); the recompute will say.
- Do not act from this report's expectations — act from the fresh lists.

## 6. Session accounting

- Bundle spend: ~0.41 GB down (pulls); upload will cost ~0.41 GB up.
- No DB writes, no Uscreen writes, no Bunny writes, no bursts, no queue
  changes. Twin Chrome relaunched (session was still logged in); tab parked at
  `about:blank`.
- Artifacts: media in `~/.albunyaan-cc/residual-media/`; probe evidence
  (tokens stripped) in `~/.albunyaan-cc/residual-media/audit/`; reconciliation
  tool at `~/.albunyaan-cc/reconcile-bunny.py`.
