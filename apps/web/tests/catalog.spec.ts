import { expect, test } from '@playwright/test';
import { zichtbareItemsPerCategorie } from './lib/supabase-rest';

/**
 * SR 4 stap 9 — catalogus zoals de storefront (SR 2a catalog__1440/390__en; SR 2b F-preferences): eerste rijtitel
 * "Channels Live 📡"; aantal categorie-rijen == categorieën met zichtbare inhoud (onafhankelijk geteld via REST met
 * paginering per 1000, zonder de featured categorie "New releases" en zonder de live-categorie); form[role=search] én
 * Filters-knop op /catalog; featured band; /search toont direct een raster.
 */
const LIVE = ['category-channels', 'channels-live-128768'];
const FEATURED = 'new-releases-125327';

test('stap 9: /catalog — Channels Live eerst, rijen == categorieën met inhoud, zoekveld + Filters, featured band', async ({ page }) => {
  test.setTimeout(120_000); // 25 categorie-queries server-side + 3 gepagineerde REST-tellingen in de test
  const { categorieen, perSlug } = await zichtbareItemsPerCategorie();
  const verwacht = categorieen.filter((c) => !LIVE.includes(c.slug) && c.slug !== FEATURED && (perSlug.get(c.slug) ?? 0) > 0);
  expect(verwacht.length).toBeGreaterThan(0);

  const res = await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Albunyaan | Catalog');
  // de pagina streamt (loading.tsx) → alleen auto-wachtende asserties (review I-1); telling én volgorde van de rijen in één keer
  await expect(page.locator('main section.group\\/row h2')).toHaveText(['Channels Live 📡', ...verwacht.map((c) => c.name)]);
  // live-rij: kanalen óf de B67-placeholder, nooit stil weg
  await expect(page.locator('main section.group\\/row').first().locator('a[href^="/programs/"], [data-live-placeholder]').first()).toBeVisible();
  await expect(page.locator('main form[role="search"] input[name="q"]')).toHaveCount(1);
  await expect(page.locator('main [data-filters] summary', { hasText: 'Filters' })).toBeVisible();
  // Category-select zoals gemeten: All + alle categorieën behalve de featured (search__1440__en: 25 opties)
  await expect(page.locator('main [data-filters] select#filter-category option')).toHaveCount(categorieen.length);
  await expect(page.locator('main [data-featured]')).toHaveCount(1);
  const featuredVerwacht = perSlug.get(FEATURED) ?? 0;
  await expect(page.locator('main [data-featured] li')).toHaveCount(featuredVerwacht);
  if (featuredVerwacht > 0) await expect(page.locator('main [data-featured] a', { hasText: 'Watch Here' }).first()).toBeVisible();
});

test('stap 9: /search — startweergave met raster en filterbalk; ?q=, ?category= en onbekende categorie', async ({ page }) => {
  test.setTimeout(120_000);
  const perSlugWelcome = (await zichtbareItemsPerCategorie()).perSlug.get('welcome-to-albunyaan-128766') ?? 0;
  expect(perSlugWelcome).toBeGreaterThan(0);
  const res = await page.goto('/search', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Albunyaan');
  await expect(page.locator('main [data-raster] a[href^="/programs/"]').first()).toBeVisible();
  await expect(page.locator('main form[role="search"] input[name="q"]')).toHaveCount(1);
  await expect(page.locator('main [data-filters] summary', { hasText: 'Filters' })).toBeVisible();
  await expect(page.locator('main [data-filters] details')).toHaveAttribute('open', ''); // storefront: paneel open op de zoekpagina
  await page.goto('/search?q=Sirah', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main a[href^="/programs/"]').first()).toBeVisible();
  await expect(page.locator('main [data-raster]')).toHaveCount(0);
  // ?category= → de inhoud van die categorie (zelfde telling als de categoriepagina); q + category zoekt in die inhoud
  await page.goto('/search?category=welcome-to-albunyaan-128766', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main [data-raster] a[href^="/programs/"]')).toHaveCount(perSlugWelcome);
  await expect(page.locator('main [data-filters] select#filter-category')).toHaveValue('welcome-to-albunyaan-128766');
  await page.goto('/search?category=welcome-to-albunyaan-128766&q=Albunyaan', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main [data-raster] a[href^="/programs/"]').first()).toBeVisible();
  // onbekende categorie → de not-found-pagina (HTTP-status blijft 200 door streaming via loading.tsx — soft-404, VRAAG teamreview)
  await page.goto('/search?category=bestaat-niet', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText('This page could not be found');
  await expect(page.locator('main [data-raster]')).toHaveCount(0);
});
