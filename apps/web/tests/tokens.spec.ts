import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 1 — tokenwissel (B13, plan §1 regel 9): norm = de gemeten storefront (SR 2b Theme Customization:
 * kop- en broodtekstfont Cairo, kleurschema Light met witte achtergrond, primaire kleur #447525; geen donkere hero/footer).
 */
test('stap 1: Cairo als font, witte achtergrond, geen donkere hero', async ({ page }) => {
  test.setTimeout(180_000); // de dev-testserver compileert traag en de home doet catalogusqueries (gemeten 40–70 s op 2026-09-05)
  // domcontentloaded: de home laadt catalogusposters van een CDN dat na de Bunny-stop (2026-09-02) kan hangen — het load-event is onbetrouwbaar.
  const res = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 150_000 });
  expect(res?.status()).toBe(200);
  const fonts = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector('h1')!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    brand: getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim(),
  }));
  expect(fonts.h1.replace(/["']/g, '')).toMatch(/^Cairo/);
  expect(fonts.body.replace(/["']/g, '')).toMatch(/^Cairo/);
  expect(fonts.bodyBg).toBe('rgb(255, 255, 255)');
  expect(fonts.brand.toLowerCase()).toBe('#447525');
  await expect(page.locator('.gradient-hero')).toHaveCount(0);
  await expect(page.locator('footer')).not.toHaveClass(/surface-deep|surface-dark/);
});
