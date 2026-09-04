import { expect, test } from '@playwright/test';

/**
 * Structuurtest footer (RV 2 — de eerste groene structuurtest, plan §3.4 "Minimale RV-set").
 * Norm: de gemeten storefront (SR 2a, home__1440__en) heeft 6 tekstlinks in de footer:
 * Videos · Q&A · Contact · Donate · Terms of service · Privacy policy. De eigen app (SiteFooter.tsx) heeft er ook 6.
 * /terms is bewust gekozen: statische pagina, geen catalogusquery.
 */
const VERWACHT = ['Videos', 'Q&A', 'Contact', 'Donate', 'Terms of service', 'Privacy policy'];

test('footer heeft 6 tekstlinks in de volgorde van de storefront', async ({ page }) => {
  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  const links = page.locator('footer nav[aria-label="Footer"] a');
  await expect(links).toHaveCount(6);
  await expect(links).toHaveText(VERWACHT);
});
