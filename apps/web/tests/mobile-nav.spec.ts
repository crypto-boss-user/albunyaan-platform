import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 4 — mobiele navigatie < 1024 px (B13; storefront SR 2a home__390: hamburger met 11 links).
 */
const LINKS = ['Home', 'Videos', 'Contact', 'Contact', 'About us', 'Dawah', 'Q&A', 'Coupon', 'Download apps', 'Log in', 'Sign up'];

test('stap 4: op 390 px een hamburger; na klik 11 zichtbare links in storefront-volgorde', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  await expect(page.locator('header nav[aria-label="Main"]')).toBeHidden();
  // geen horizontale overflow door de kop (review stap 4: 400 px op een 390-viewport)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const hamburger = page.locator('header summary[aria-label="Menu"]');
  await expect(hamburger).toBeVisible();
  const links = page.locator('header nav[aria-label="Mobile"] a');
  await expect(links.first()).toBeHidden();
  await hamburger.click();
  await expect(links).toHaveCount(11);
  for (let i = 0; i < 11; i++) await expect(links.nth(i)).toBeVisible();
  await expect(links).toHaveText(LINKS);
  await page.keyboard.press('Escape');
  await expect(links.first()).toBeHidden();
  await expect(hamburger).toBeFocused();
  await hamburger.click();
  await links.nth(4).click(); // About us
  await expect(page).toHaveURL(/\/about-us$/);
  await expect(page.locator('header nav[aria-label="Mobile"] a').first()).toBeHidden();
});

test('stap 4: op 1440 px geen hamburger, wel het hoofdmenu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/terms');
  await expect(page.locator('header summary[aria-label="Menu"]')).toBeHidden();
  await expect(page.locator('header nav[aria-label="Main"]')).toBeVisible();
});
