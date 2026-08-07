/**
 * Capture the EXACT display order of every category's contents as members see
 * it on the CURRENT platform (albunyaan.tv storefront = Uscreen).
 *
 * WHY the storefront and not the admin: the admin "Manage content" list is
 * React-state only (no ids in the DOM, data arrives via an opaque
 * turbo-stream loader), while the storefront category page server-renders the
 * items in their manual order with real /programs/<permalink> links. The
 * storefront IS the ground truth for "same order as the original platform".
 *
 * Steps:
 *   1. categories.index via the admin API (twin Chrome) → id, title,
 *      permalink, position (site-nav order), content_sort.
 *   2. For each category, load https://albunyaan.tv/<permalink> in the twin
 *      Chrome (public page, founder session harmless) and collect the ordered
 *      unique /programs/<permalink> hrefs, scrolling to the bottom to defeat
 *      lazy-loading.
 *
 * Output: ~/.albunyaan-cc/uscreen-category-order.jsonl
 *   {id, title, permalink, position, content_sort, items:[programPermalink,…]}
 *
 * Run (from worker/):  node scrape-category-order.mjs
 * ~25 categories ⇒ a few minutes. Re-run overwrites (small + cheap).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT = path.join(CC, 'uscreen-category-order.jsonl');
const STORE = 'https://albunyaan.tv';
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// --only <ext,ext>: alleen deze categorieën opnieuw meten en MERGEN met het
// bestaande bestand. De storefront laadt wisselvallig (zelfde categorie gaf
// 71 items in de ene ronde en 40 in de volgende), daarom houden we per
// categorie ALTIJD de meting met de meeste items — nooit een slechtere.
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? new Set(String(process.argv[i + 1]).split(',').map((s) => s.trim())) : null; })();
const ATTEMPTS = ONLY ? 3 : 1;

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  let page =
    ctx.pages().find((p) => p.url() === 'about:blank') ??
    ctx.pages().find((p) => p.url().includes('app.uscreen.tv')) ??
    (await ctx.newPage());
  if (!page.url().includes('app.uscreen.tv')) {
    await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // 1. category catalog from the admin API
  const cats = [];
  for (let p = 1, pages = 1; p <= pages; p++) {
    const r = await page.evaluate(async (p) => {
      const res = await fetch('/bullet_api/v1/categories.index', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: p, per_page: 50 }),
      });
      return res.json();
    }, p);
    pages = r.pagination?.total_pages ?? 1;
    for (const c of r.categories ?? []) cats.push(c);
    await sleep(400);
  }
  console.log(`[${ts()}] ${cats.length} categories from admin API`);

  // Enrich with position/content_sort/permalink where index rows lack them.
  for (const c of cats) {
    if (c.permalink && c.position != null && c.content_sort) continue;
    const r = await page.evaluate(async (id) => {
      const res = await fetch('/bullet_api/v1/categories.show', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      return res.json();
    }, c.id);
    Object.assign(c, {
      permalink: r.category?.permalink ?? c.permalink,
      position: r.category?.position ?? c.position ?? null,
      content_sort: r.category?.content_sort ?? c.content_sort ?? null,
    });
    await sleep(400);
  }

  // 2. storefront order per category — resultaten in een map, zodat --only kan mergen
  const results = new Map();
  if (ONLY && fs.existsSync(OUT)) {
    for (const l of fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) {
      const d = JSON.parse(l); results.set(String(d.id), d);
    }
    console.log(`[${ts()}] merge-modus: ${results.size} bestaande categorieën ingelezen, ${ONLY.size} opnieuw meten`);
  }
  const writeOut = () => fs.writeFileSync(OUT, [...results.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');

  for (const c of cats) {
    if (ONLY && !ONLY.has(String(c.id))) continue;
    if (!c.permalink) { results.set(String(c.id), { id: c.id, title: c.title, error: 'no_permalink' }); writeOut(); continue; }
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      // Storefront-categoriepagina's leven onder /categories/<permalink>
      // (kale /<permalink> geeft een 404 — live geverifieerd 2026-08-07).
      // encodeURIComponent is VERPLICHT: sommige permalinks bevatten spaties en
      // plustekens ("category-Age 16+"); onge-encodeerd leverde dat een lege
      // pagina op en verdween de hele categorie stilzwijgend uit de export.
      await page.goto(`${STORE}/categories/${encodeURIComponent(c.permalink)}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(2500);
      // lazy-load: scroll tot de teller niet meer groeit. Twee keer dezelfde
      // stand vereist vóór we stoppen — anders breekt een traag ladende pagina
      // meteen af op 0 items (dat kostte 3 categorieën in de ronde ervoor).
      let last = -1, stable = 0;
      for (let i = 0; i < 40; i++) {
        const count = await page.$$eval('a[href*="/programs/"]', (as) => as.length);
        if (count === last) { if (++stable >= 2) break; } else { stable = 0; last = count; }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(900);
      }
      const items = await page.$$eval('a[href*="/programs/"]', (as) => {
        const seen = new Set(), out = [];
        for (const a of as) {
          const m = (a.getAttribute('href') || '').match(/\/programs\/([^/?#]+)/);
          if (m && !seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
        }
        return out;
      });
      const prev = results.get(String(c.id));
      const prevN = (prev && !prev.error) ? (prev.items || []).length : -1;
      if (items.length >= prevN) {
        results.set(String(c.id), {
          id: c.id, title: c.title, permalink: c.permalink,
          position: c.position ?? null, content_sort: c.content_sort ?? null, items,
        });
        writeOut();
      }
      console.log(`[${ts()}]   ${String(c.title).slice(0, 40)}: ${items.length} items${prevN >= 0 ? ` (had ${prevN}, behouden: ${Math.max(items.length, prevN)})` : ''}`);
      await sleep(1200); // politeness
      if (items.length >= prevN && items.length > 0) break; // geslaagd, geen extra poging nodig
      if (attempt < ATTEMPTS) { console.log(`[${ts()}]     poging ${attempt + 1}/${ATTEMPTS}…`); await sleep(4000); }
    } catch (e) {
      if (!results.has(String(c.id))) { results.set(String(c.id), { id: c.id, title: c.title, permalink: c.permalink, error: String(e.message).slice(0, 150) }); writeOut(); }
      console.log(`[${ts()}]   ${String(c.title).slice(0, 40)}: ERR ${String(e.message).slice(0, 60)}`);
    }
    }
  }
  writeOut();
  await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  console.log(`[${ts()}] DONE → ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
