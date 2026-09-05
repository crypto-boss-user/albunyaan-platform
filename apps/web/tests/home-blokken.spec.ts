import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 7 — homepage-blokken in US-volgorde (SR 2b `thema/pages/index.json`: 13 blokken, Header/Footer buiten `main`;
 * SR 2a `home__1440__en` KOPPEN + hero-img; B13/B68): blokvolgorde == blokkenlijst, koppen == US, h1 == US,
 * hero-src == bannerbestand; statistiekstrook en catalogusrijen weg.
 */
const BLOKKEN = [
  'Hero banner',
  'Text block',
  'Image and text',
  'Image and text',
  'Image and text',
  'Custom code',
  'Video and text',
  'Video and text',
  'Video and text',
  'Text block',
  'Mobile apps',
];
/** Alle <img src> in documentvolgorde (hero = 1 via <picture>, 3 Image-and-text, diagram, 3 posters, 2 in het mobile-apps-SVG). */
const BEELDEN = [
  '/home/hero-banner-mobile.1720720201.jpg',
  '/home/assets_page-editor_background.1718466357.jpg',
  '/home/image.1685289189.png',
  '/home/sadqa.1685262162.jpeg',
  '/home/juistevisualisatie.1685549178.jpg',
  '/home/review-poster-I4xT3UgTYGTg2w.jpg',
  '/home/review-poster-GfYD8aDAuLRoiQ.jpg',
  '/home/review-poster-dvLOhXF0il75HA.jpg',
  '/home/thumpnail.1722973512.jpg',
  '/home/hands.png',
];
/** Eén uniek fragment per alinea uit de SR 2a-HTML (hero-subkop, hero-alinea, blok 3, 5, 6). */
const ALINEA_FRAGMENTEN = [
  'fixed (sadaqah jaariyah) amount per month or year!',
  'making permissible films/series available at any time of the day.',
  "according to the Qor'aan and Sunnah.",
  'sit with grammar books.',
  'even after you have passed away!',
];
const KOPPEN = [
  'H1: I want to protect my Islamic identity',
  'H3: Islamic Identity',
  'H3: Watch unlimited series, movies, and programs on your phone, tablet, laptop, and TV.',
  'H3: Learning Arabic',
  'H3: Ongoing reward (sadaqah jaariyah)',
  'H3: Review teacher (NL)',
  'H3: Review teenager (NL)',
  'H3: Review parent (NL)',
  'H3: Ready to start watching?',
];

test('stap 7: 11 blokken in storefront-volgorde, koppen == US, hero-banner als beeld, geen strook/catalogusrijen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Albunyaan TV');
  const blokken = await page.locator('main [data-block]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block')));
  expect(blokken).toEqual(BLOKKEN);
  const koppen = await page
    .locator('main h1, main h2, main h3, main h4')
    .evaluateAll((els) => els.map((el) => `${el.tagName}: ${el.textContent?.replace(/\s+/g, ' ').trim()}`));
  expect(koppen).toEqual(KOPPEN);
  // hero = <picture>: één zichtbare img; op 1440 resolvet currentSrc naar de desktopbanner, op 390 naar de mobiele
  const hero = page.locator('main [data-block="Hero banner"] picture img');
  await expect(hero).toHaveCount(1);
  await expect(hero).toBeVisible();
  expect(await hero.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(/\/home\/hero-banner-albunyaan\.1720720104\.jpg$/);
  await expect(page.locator('main [data-block="Hero banner"] a', { hasText: 'Sign up!' })).toBeVisible();
  // alle beelden in documentvolgorde: byte-identieke bestanden uit var/storefront-referentie/assets/ (review M-1)
  const imgs = await page.locator('main img').evaluateAll((els) => els.map((el) => el.getAttribute('src')));
  expect(imgs).toEqual(BEELDEN);
  const links = await page.locator('main a[href]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(links).toEqual(['/login', '/programs/albunyaan-app-2749561', '/login']);
  for (const fragment of ALINEA_FRAGMENTEN) await expect(page.locator('main')).toContainText(fragment);
  await expect(page.locator('main [data-block="Video and text"] figure[data-poster] img')).toHaveCount(3);
  await expect(page.locator('main [data-block="Mobile apps"] svg img')).toHaveCount(2);
  await expect(page.locator('main')).not.toContainText('Fresh from the library');
  await expect(page.locator('main')).not.toContainText('non-profit waqf');
  await expect(page.locator('main .row-scroll')).toHaveCount(0);
  // 390: dezelfde <picture> resolvet naar de mobiele banner (900×1600)
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => hero.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(/\/home\/hero-banner-mobile\.1720720201\.jpg$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
