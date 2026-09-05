import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { zichtbareItemsPerCategorie } from './lib/supabase-rest';

/**
 * SR 4 stap 10 — categoriepagina zoals de storefront (SR 2a category-age-5-9__1440/390__en): title == "Age 5-9"
 * (gemeten titel, categorie-titels-2026-09-05.json), h1 == weergavenaam, filterbalk met de categorie voorgeselecteerd, raster met ALLE items die de
 * zichtbaarheidsregel toelaat (onafhankelijk geteld via REST met paginering). De storefront toont 80 (1440) / 120 (390) van
 * 2009 met lazy paginering; de §6-norm "≥ 80 links" haalt de DB pas na de zichtbaarheidsbeslissing (14.983 video's staan
 * als draft) — de meting wordt in de commit-tekst gerapporteerd, de test bewaakt telling == data-laag.
 */
test('stap 10: /categories/age-5-9-114960 — title "Age 5-9", h1, filters, raster == zichtbare items', async ({ page }) => {
  test.setTimeout(120_000);
  const { categorieen, perSlug, volgordePerSlug } = await zichtbareItemsPerCategorie();
  const verwacht = perSlug.get('age-5-9-114960') ?? 0;
  expect(verwacht).toBeGreaterThan(0);
  // gemeten titels dekken exact de DB-categorieën (25 == 25, zelfde Uscreen-id's) — review M-2
  const gemeten = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'reference', 'storefront-2026-09', 'categorie-titels-2026-09-05.json'), 'utf8')) as { rijen: { external_id: string; title: string; http: number }[] };
  expect(gemeten.rijen.filter((r) => r.http === 200).map((r) => r.external_id).sort()).toEqual(categorieen.map((c) => c.external_id).sort());

  const res = await page.goto('/categories/age-5-9-114960', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Age 5-9');
  await expect(page.locator('main h1')).toHaveText('العمر - Age 5-9');
  await expect(page.locator('main [data-filters] summary', { hasText: 'Filters' })).toBeVisible();
  await expect(page.locator('main [data-filters] select#filter-category')).toHaveValue('age-5-9-114960');
  await expect(page.locator('main form[role="search"] input[name="q"]')).toHaveCount(1);
  const links = page.locator('main [data-raster] a[href^="/programs/"]');
  await expect(links).toHaveCount(verwacht);
  // ORDER FIDELITY: exact de category_items.position-volgorde (review I-3)
  expect(await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(volgordePerSlug.get('age-5-9-114960'));
  console.log(`stap 10 telling: Age 5-9 raster ${verwacht} links (storefront 80 op 1440, 120 op 390, 2009 totaal)`);
  await expect(page.locator('main h1').locator('..')).not.toContainText('titles'); // geen eigen "N titles"-regel meer in het kopblok
});

test('stap 10: /categories/channels-live-128768 — title "Channels", h1 en B67-placeholder', async ({ page }) => {
  const res = await page.goto('/categories/channels-live-128768', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Channels');
  await expect(page.locator('main h1')).toHaveText('Channels Live 📡');
  // B67: geen kanalen in de DB → precies de placeholder, en die staat ALLEEN op de live-categorie (review I-2/M-3)
  await expect(page.locator('main [data-live-placeholder]')).toHaveCount(1);
  await expect(page.locator('main [data-raster] a')).toHaveCount(0);
  await page.goto('/categories/handicrafts-136278', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toHaveText('أعمال يدوية 🎨 Handicrafts');
  await expect(page).toHaveTitle('أعمال يدوية 🎨 Handicrafts'); // gemeten: hier is de titel de weergavenaam
  await expect(page.locator('main [data-live-placeholder]')).toHaveCount(0);
});
