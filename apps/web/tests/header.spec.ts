import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 3 — header-menu exact als de gemeten storefront (SR 2a home__1440__en; SR3-werklijst §3):
 * Home · Videos · Contact▾ (Contact, About us, Dawah) · Q&A · Coupon · Download apps + Log in + Sign up; geen zoekveld in de kop.
 */
const TOP = ['Home', 'Videos', 'Contact', 'Q&A', 'Coupon', 'Download apps'];
const DROPDOWN = ['Contact', 'About us', 'Dawah'];

test('stap 3: menu-items in storefront-volgorde, Contact-dropdown met 3 links, Log in + Sign up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto('/terms');
  expect(res?.status()).toBe(200);
  const top = await page.locator('header nav[aria-label="Main"] > *').evaluateAll((els) =>
    els.map((el) => (el.matches('[data-dropdown]') ? el.querySelector('button')?.textContent : el.textContent)?.replace(/\s+/g, ' ').trim()),
  );
  expect(top).toEqual(TOP);
  const dropdown = page.locator('header nav[aria-label="Main"] [data-dropdown="contact"] ul a');
  await expect(dropdown).toHaveCount(3);
  await expect(dropdown).toHaveText(DROPDOWN);
  // gesloten → onzichtbaar; via toetsenbord-focus (Tab) zichtbaar; na navigatie via een dropdown-link weer gesloten
  await expect(dropdown.first()).toBeHidden();
  await page.locator('header nav[aria-label="Main"] [data-dropdown="contact"] button').focus();
  await expect(dropdown.first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dropdown.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dropdown.first()).toBeHidden();
  await page.locator('header nav[aria-label="Main"] [data-dropdown="contact"] button').hover();
  await expect(dropdown.first()).toBeVisible();
  await dropdown.nth(1).click(); // About us
  await expect(page).toHaveURL(/\/about-us$/);
  // na navigatie: muis weg van het menu (hover = open, zoals de storefront) → paneel dicht, geen blijvend open menu
  await page.mouse.move(720, 600);
  await expect(page.locator('header nav[aria-label="Main"] [data-dropdown="contact"] ul a').first()).toBeHidden();
  // zichtbaar op 1440: precies één Log in en één Sign up (de kopieën in het mobiele menu zijn verborgen)
  await expect(page.locator('header a', { hasText: /^Log in$/ }).filter({ visible: true })).toHaveCount(1);
  await expect(page.locator('header a', { hasText: /^Sign up$/ }).filter({ visible: true })).toHaveCount(1);
  await expect(page.locator('header form[role="search"]')).toHaveCount(0);
});
