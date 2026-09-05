import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 2 — logo + favicon (B13): het Arabische woordmerk van de storefront (SR 2b Theme Customization, 385×313)
 * in header en footer, favicon 48×48 met link[rel=icon]. /terms = statische pagina (snel, geen catalogusquery).
 */
test('stap 2: woordmerk in header en footer, favicon aanwezig', async ({ page, request }) => {
  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  const headerLogo = page.locator('header img').first();
  await expect(headerLogo).toHaveAttribute('alt', /Albunyaan/);
  await expect(headerLogo).toHaveAttribute('src', /logo-albunyaan/);
  const footerLogo = page.locator('footer img').first();
  await expect(footerLogo).toHaveAttribute('src', /logo-albunyaan/);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /favicon\.png/);
  const fav = await request.get('/favicon.png');
  expect(fav.status()).toBe(200);
  expect(fav.headers()['content-type']).toContain('image/png');
});
