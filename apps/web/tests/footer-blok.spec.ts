import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 5 — footer als de storefront (SR 2a home__1440__en footer + SR 2b Footer-paneel; B13):
 * 6 tekstlinks (footer.spec.ts) + 5 icoonlinks met de storefront-doelen + "© Albunyaan <jaar>"; geen dev-tekst.
 */
const ICOON_DOELEN = [
  'https://apps.apple.com/nl/app/albunyaan-tv/id1666119687',
  'https://play.google.com/store/apps/details?id=tv.uscreen.albunyaan2',
  'https://www.instagram.com/albunyaantv/',
  'https://www.facebook.com/albunyaan',
  'https://m.youtube.com/@albunyaan?',
];

test('stap 5: footer heeft 2 app-badges + 3 social-iconen met storefront-doelen, © en geen dev-tekst', async ({ page }) => {
  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  await expect(page.locator('footer nav[aria-label="Footer"] a')).toHaveCount(6);
  const iconen = page.locator('footer a[aria-label][target="_blank"]');
  await expect(iconen).toHaveCount(5);
  const hrefs = await iconen.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(ICOON_DOELEN);
  for (let i = 0; i < 5; i++) await expect(iconen.nth(i)).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('footer')).toContainText(`© Albunyaan ${new Date().getFullYear()}`);
  await expect(page.locator('footer')).not.toContainText('Local parity build');
  await expect(page.locator('footer')).not.toContainText('shadow-seeded');
  await expect(page.locator('footer img').first()).toHaveAttribute('src', /logo-albunyaan/);
});
