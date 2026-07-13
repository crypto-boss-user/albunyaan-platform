/**
 * Builds an old-Uscreen-category-URL -> new-platform-URL redirect map.
 *
 * Unlike /programs/:slug (which exposes a numeric data-program-id via a
 * Turbo-Stream partial, see build-redirect-map.mjs), the old /categories/:slug
 * pages expose no numeric id anywhere in the reachable HTML (checked the page
 * itself and the category_filters/category_content Turbo-Frame partials —
 * both 406 on a plain unauthenticated GET, likely Rails content-negotiation
 * that needs a real Turbo client). What IS reliable: the old page's <title>
 * is either the category's plain English name or its full bilingual name,
 * and both forms are always a substring of (or exactly equal to) our own
 * `categories.name` column. So this matches by normalized name instead of id.
 *
 * Read-only against both the live old site and our own DB. Writes a JSON
 * report only; does NOT touch next.config.ts or deploy anything. Re-run
 * fresh before actual cutover, same as build-redirect-map.mjs.
 *
 * Run: node build-categories-redirect-map.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OLD_ORIGIN = 'https://albunyaan.tv';
const DELAY_MS = 150; // be a polite guest on someone else's live site

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (redirect-map builder; read-only)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function oldCategorySlugs() {
  const xml = await fetchText(`${OLD_ORIGIN}/sitemap.xml`);
  const slugs = [...xml.matchAll(/<loc>https:\/\/albunyaan\.tv\/categories\/([a-zA-Z0-9_-]+)<\/loc>/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

function decodeEntities(s) {
  return s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

/** Strips emoji/punctuation, collapses whitespace, lowercases — keeps letters (incl. Arabic) and digits. */
function normalize(s) {
  return decodeEntities(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function oldCategoryTitle(oldSlug) {
  const html = await fetchText(`${OLD_ORIGIN}/categories/${oldSlug}`);
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1].trim() : null;
}

async function main() {
  console.log('Fetching old sitemap.xml...');
  const oldSlugs = await oldCategorySlugs();
  console.log(`  ${oldSlugs.length} category URLs in the old sitemap`);

  console.log('Fetching categories table (new platform)...');
  const { data: categories, error } = await sb.from('categories').select('id, slug, name, external_id');
  if (error) throw error;
  console.log(`  ${categories.length} categories`);
  const normalizedCategories = categories.map((c) => ({ ...c, norm: normalize(c.name) }));

  console.log(`Fetching old category page titles for ${oldSlugs.length} slugs...`);
  const matched = [];
  const ambiguous = [];
  const unmatched = [];
  for (const oldSlug of oldSlugs) {
    let title;
    try {
      title = await oldCategoryTitle(oldSlug);
    } catch (e) {
      unmatched.push({ oldSlug, error: e.message });
      await sleep(DELAY_MS);
      continue;
    }
    await sleep(DELAY_MS);
    if (!title) { unmatched.push({ oldSlug, error: 'no <title> found' }); continue; }
    const norm = normalize(title);
    // exact normalized match first, then substring containment either direction
    const candidates = normalizedCategories.filter((c) => c.norm === norm || c.norm.includes(norm) || norm.includes(c.norm));
    if (candidates.length === 1) {
      matched.push({ oldPath: `/categories/${oldSlug}`, newPath: `/categories/${candidates[0].slug}`, oldTitle: title, name: candidates[0].name });
    } else if (candidates.length > 1) {
      ambiguous.push({ oldSlug, oldTitle: title, candidates: candidates.map((c) => ({ slug: c.slug, name: c.name })) });
    } else {
      unmatched.push({ oldSlug, oldTitle: title, error: 'no DB category name matched' });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: { oldSlugsInSitemap: oldSlugs.length, dbCategories: categories.length, matched: matched.length, ambiguous: ambiguous.length, unmatched: unmatched.length },
    matched,
    ambiguous,
    unmatched,
  };

  const outPath = path.join(os.homedir(), '.albunyaan-cc/categories-redirect-map-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nmatched: ${matched.length} / ${oldSlugs.length}`);
  console.log(`ambiguous (multiple DB name matches): ${ambiguous.length}`);
  console.log(`unmatched: ${unmatched.length}`);
  console.log(`report -> ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
