/**
 * Resolve storefront serie-permalinks ("collection-…") naar collection
 * external_ids, voor de categorie-volgorde-import (0013 category_items).
 *
 * Waarom nodig: bullet_api heeft géén collections-endpoint (404 op alle
 * geprobeerde namen, 2026-08-07) en videos.details bevat geen
 * serie-lidmaatschap. Twee sporen:
 *   A. naam-match: permalink "collection-<naam>" ↔ slugify(collectietitel)
 *      (werkt voor Latijnse titels);
 *   B. storefront-paginatitel: laad /programs/<permalink> en match de
 *      documenttitel exact op de collectietitel (nodig voor Arabische titels,
 *      wier permalinks opaak zijn zoals "collection-itqg4s8j3di").
 * Dubbelzinnige of onvindbare gevallen worden GELOGD, nooit gegokt.
 *
 * Output: ~/.albunyaan-cc/uscreen-collection-permalinks.jsonl {permalink, id}
 * Run (vanuit worker/):  node resolve-collection-permalinks.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT = path.join(CC, 'uscreen-collection-permalinks.jsonl');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function fetchCollections() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/collections?select=external_id,title&source=eq.uscreen`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + 999}` },
    });
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < 1000) return rows;
  }
}

async function main() {
  // verzamel alle nog onopgeloste serie-permalinks uit de categorie-volgorde
  const details = fs.readFileSync(path.join(CC, 'uscreen-video-details.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const videoPermalinks = new Set(details.filter((d) => d.permalink).map((d) => String(d.permalink)));
  const catOrder = fs.readFileSync(path.join(CC, 'uscreen-category-order.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const want = new Set();
  for (const c of catOrder) for (const p of c.items ?? []) if (!videoPermalinks.has(p)) want.add(p);
  console.log(`[${ts()}] ${want.size} unieke serie-permalinks op te lossen`);

  const colls = await fetchCollections();
  const bySlug = new Map();
  const byTitle = new Map();
  for (const c of colls) {
    const s = slugify(c.title);
    if (s) bySlug.set(s, [...(bySlug.get(s) ?? []), c.external_id]);
    const t = String(c.title).trim();
    byTitle.set(t, [...(byTitle.get(t) ?? []), c.external_id]);
  }

  const resolved = new Map();
  const rest = [];
  for (const p of want) {
    const name = p.replace(/^collection-/, '');
    const hit = bySlug.get(name);
    if (hit && hit.length === 1) resolved.set(p, hit[0]);
    else rest.push(p);
  }
  console.log(`[${ts()}] spoor A (naam-match): ${resolved.size} opgelost, ${rest.length} naar spoor B`);

  if (rest.length) {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
    const ctx = browser.contexts()[0];
    let page = ctx.pages().find((pg) => pg.url() === 'about:blank') ?? (await ctx.newPage());
    let n = 0;
    for (const p of rest) {
      try {
        await page.goto(`https://albunyaan.tv/programs/${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(800);
        const title = (await page.title()).replace(/^Albunyaan\s*\|\s*/i, '').trim();
        const hit = byTitle.get(title);
        if (hit && hit.length === 1) resolved.set(p, hit[0]);
        else console.log(`[${ts()}]   GEEN MATCH: ${p} → paginatitel "${title.slice(0, 50)}" (${hit ? hit.length + ' kandidaten' : 'onbekend'})`);
      } catch (e) {
        console.log(`[${ts()}]   FOUT bij ${p}: ${String(e.message).slice(0, 60)}`);
      }
      if (++n % 25 === 0) console.log(`[${ts()}]   spoor B: ${n}/${rest.length}`);
      await sleep(900);
    }
    await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  }

  fs.writeFileSync(OUT, [...resolved].map(([p, id]) => JSON.stringify({ permalink: p, id })).join('\n') + '\n');
  console.log(`[${ts()}] DONE: ${resolved.size}/${want.size} opgelost → ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
