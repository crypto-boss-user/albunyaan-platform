/**
 * Harvest per-video EXTRAS from the Uscreen admin **API** (bullet_api) —
 * description, short description, permalink, category ids, attached resource
 * ids, tags/keywords, subtitles, audio tracks, published_at.
 *
 * DISCOVERY (2026-08-06, verified in the founder's browser): the admin SPA
 * talks to POST /bullet_api/v1/*.  `videos.details {id}` returns EVERYTHING
 * the details page shows — including a fresh tokenized Mux hls_url — in one
 * ~100ms call. No page loads, no Mux player, far lower hCaptcha risk than the
 * old details-page harvest. Calls still ride the founder's admin session, so
 * they run through the twin Chrome (CDP :9333) via page.evaluate(fetch).
 *
 * Enumerates videos from Uscreen itself (videos.index) — NOT from our DB — so
 * videos uploaded after the July catalog copy (≈122) are included.
 *
 * Outputs (JSONL, resumable — already-harvested ids are skipped):
 *   ~/.albunyaan-cc/uscreen-video-details.jsonl    one line per video
 *   ~/.albunyaan-cc/uscreen-file-resources.jsonl   the full Resources list (107)
 *
 * Run (from worker/):   node harvest-video-extras.mjs [--limit N]
 * Prereq: twin Chrome up on :9333 with a live founder admin session.
 * Politeness: 350ms between calls (~3/s). Full library ≈ 2h. Stops cleanly on
 * session loss (401/403/redirect-to-login) — just re-login and re-run.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT_DETAILS = path.join(CC, 'uscreen-video-details.jsonl');
const OUT_RESOURCES = path.join(CC, 'uscreen-file-resources.jsonl');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > 0 ? Number(process.argv[i + 1]) : Infinity; })();
const DELAY_MS = 350;
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readDoneIds(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(
    fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return String(JSON.parse(l).id); } catch { return null; } })
      .filter(Boolean),
  );
}

/** POST a bullet_api endpoint from inside the admin origin (session cookies apply). */
async function api(page, endpoint, body, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await page.evaluate(async ({ endpoint, body }) => {
        const r = await fetch(`/bullet_api/v1/${endpoint}`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          redirect: 'manual', // a session-dead redirect to /login must be visible, not followed
        });
        let json = null;
        try { json = await r.json(); } catch { /* non-JSON = error page */ }
        return { status: r.status, type: r.type, json };
      }, { endpoint, body });
    } catch (e) {
      // The admin SPA does real navigations shortly after load (and a human in
      // the shared browser can navigate too) — that destroys the evaluate
      // context mid-call. The tab survives: settle, re-anchor, retry.
      if (attempt >= tries) throw e;
      await sleep(2000);
      if (!page.url().includes('app.uscreen.tv')) {
        await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        if (page.url().includes('login')) throw new Error('USCREEN SESSION DEAD — log in in the twin Chrome first.');
      }
    }
  }
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  // Reuse-don't-accumulate (hard-won migrate-videos.ts lesson): prefer a parked
  // tab, else any Uscreen tab, only then a new one — and park it on exit.
  let page =
    ctx.pages().find((p) => p.url() === 'about:blank') ??
    ctx.pages().find((p) => p.url().includes('app.uscreen.tv')) ??
    (await ctx.newPage());
  if (!page.url().includes('app.uscreen.tv')) {
    await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  if (page.url().includes('login')) throw new Error('USCREEN SESSION DEAD — log in in the twin Chrome first.');

  // ── 1. Resources catalog (107 items, a handful of pages) ─────────────────
  fs.writeFileSync(OUT_RESOURCES, '');
  for (let p = 1, pages = 1; p <= pages; p++) {
    const r = await api(page, 'file_resources.index', { page: p, per_page: 50 });
    if (r.status !== 200 || !r.json?.ok) throw new Error(`file_resources.index page ${p}: HTTP ${r.status}`);
    pages = r.json.pagination.total_pages;
    for (const f of r.json.file_resources) fs.appendFileSync(OUT_RESOURCES, JSON.stringify(f) + '\n');
    await sleep(DELAY_MS);
  }
  console.log(`[${ts()}] resources catalog written (${fs.readFileSync(OUT_RESOURCES, 'utf8').split('\n').filter(Boolean).length} items)`);

  // ── 2. Enumerate ALL video ids from Uscreen (not our DB copy) ────────────
  const allIds = [];
  for (let p = 1, pages = 1; p <= pages; p++) {
    const r = await api(page, 'videos.index', { page: p, per_page: 100 });
    if (r.status !== 200 || !r.json?.videos) throw new Error(`videos.index page ${p}: HTTP ${r.status}`);
    pages = r.json.pagination.total_pages;
    for (const v of r.json.videos) allIds.push(String(v.id));
    if (p % 20 === 0) console.log(`[${ts()}]   enumerated ${allIds.length} ids (page ${p}/${pages})`);
    await sleep(DELAY_MS);
  }
  console.log(`[${ts()}] Uscreen reports ${allIds.length} videos total`);

  // ── 3. Details per video (resumable) ─────────────────────────────────────
  const done = readDoneIds(OUT_DETAILS);
  const todo = allIds.filter((id) => !done.has(id)).slice(0, LIMIT);
  console.log(`[${ts()}] ${done.size} already harvested, ${todo.length} to go`);
  let n = 0, failed = 0, authFails = 0;
  for (const id of todo) {
    try {
      const r = await api(page, 'videos.details', { id: Number(id) });
      if (r.status === 401 || r.status === 403 || r.type === 'opaqueredirect') {
        if (++authFails >= 3) { console.log(`[${ts()}] SESSION LOST — stopping (re-login, then re-run; progress is saved).`); break; }
        await sleep(3000); continue;
      }
      authFails = 0;
      const v = r.json?.video;
      if (!v) { failed++; fs.appendFileSync(OUT_DETAILS, JSON.stringify({ id, error: `HTTP ${r.status}` }) + '\n'); continue; }
      fs.appendFileSync(OUT_DETAILS, JSON.stringify({
        id: String(v.id),
        title: v.title,
        description: v.description ?? '',
        short_description: v.short_description ?? '',
        permalink: v.permalink ?? null,
        meta_title: v.meta_title ?? '',
        meta_description: v.meta_description ?? '',
        category_ids: v.category_ids ?? [],
        file_resource_ids: v.file_resource_ids ?? [],
        tags: v.tags ?? [],
        author_ids: v.author_ids ?? [],
        catalog_filters: v.catalog_filters ?? null,
        free: v.free ?? null,
        duration: v.duration ?? null,
        published_at: v.published_at ?? null,
        release_stage: v.release_stage ?? null,
        downloadable: v.downloadable ?? null,
        subtitles: r.json.subtitles ?? [],
        audio_tracks: r.json.audio_tracks ?? [],
        // NOTE: hls_url is deliberately NOT stored here — its token dies in
        // ~159 min. requality-videos.ts fetches fresh ones right before use.
      }) + '\n');
      n++;
      if (n % 100 === 0) console.log(`[${ts()}]   ${n}/${todo.length} harvested (${failed} failed)`);
      await sleep(DELAY_MS);
    } catch (e) {
      failed++;
      fs.appendFileSync(OUT_DETAILS, JSON.stringify({ id, error: String(e.message).slice(0, 200) }) + '\n');
      await sleep(2000);
    }
  }
  console.log(`[${ts()}] DONE: ${n} harvested, ${failed} failed. Output: ${OUT_DETAILS}`);
  await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  process.exit(0); // connectOverCDP keeps the loop alive otherwise (zombie lesson)
}
main().catch((e) => { console.error(e); process.exit(1); });
