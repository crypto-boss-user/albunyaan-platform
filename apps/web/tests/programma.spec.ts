import { expect, test } from '@playwright/test';
import { afleveringenVanCollectie } from './lib/supabase-rest';

/**
 * SR 4 stap 11 — programma- en afleveringspagina zoals de storefront (SR 2a program-my-words__1440__en; SR 2b
 * programmapagina-ingelogd): label COLLECTION, h1, "Start watching", Share ×4, categorie-tags, "N videos", playlist ≥ 1,
 * speler = poster; /watch/<slug> 200 met spelerplek (§5.14). Testslug = een collectie met zichtbare afleveringen
 * (watch-for-free-1969439: 4 published van 22); de gemeten storefront-collectie my-words-ar-1692483 heeft in de DB 18 van 18
 * afleveringen als draft → 0 zichtbare → dat blijft de T2-zichtbaarheidsvraag (zie commit-tekst), hier vastgelegd als 404.
 */
test('stap 11: /programs/<serie> — COLLECTION, Start watching, share, tags, N videos, playlist, poster', async ({ page }) => {
  const res = await page.goto('/programs/watch-for-free-1969439');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('Watch for Free');
  await expect(page.locator('main h1')).toHaveText('Watch for Free');
  await expect(page.locator('main p', { hasText: /^Collection$/ })).toBeVisible();
  await expect(page.locator('main [data-poster]')).toHaveCount(1);
  const start = page.locator('main a', { hasText: 'Start watching' });
  await expect(start).toHaveAttribute('href', /^\/watch\//);
  await expect(page.locator('main [data-share]')).toHaveCount(4);
  await expect(page.locator('main [data-tags] a')).toHaveCount(1);
  await expect(page.locator('main [data-tags] a').first()).toHaveText('Welcome to Albunyaan 👋');
  // playlist == zichtbare afleveringen in collection_items.position-volgorde (onafhankelijk geteld); Start watching = de eerste
  const verwacht = await afleveringenVanCollectie('watch-for-free-1969439');
  expect(verwacht.length).toBeGreaterThanOrEqual(1);
  const playlist = page.locator('main [data-playlist] a[href^="/watch/"]');
  await expect(playlist).toHaveCount(verwacht.length);
  expect(await playlist.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(verwacht);
  await expect(start).toHaveAttribute('href', verwacht[0]);
  await expect(page.locator('main [data-playlist] p').first()).toHaveText(`${verwacht.length} videos`);
  await expect(page.locator('main iframe')).toHaveCount(0); // speler = poster, geen embed (⛔ Bunny)
});

test('stap 11: /watch/<aflevering> — 200 met spelerplek, COLLECTION-link en playlist met huidige gemarkeerd', async ({ page }) => {
  const res = await page.goto('/watch/the-sirah-ar-1776263');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/watch\/the-sirah-ar-1776263$/);
  await expect(page.locator('main [data-player-slot]')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('The Sirah | (AR)');
  await expect(page.locator('main a', { hasText: /^Collection · / })).toHaveAttribute('href', '/programs/watch-for-free-1969439');
  await expect(page.locator('main [data-playlist] li[aria-current="true"] a')).toHaveAttribute('href', '/watch/the-sirah-ar-1776263');
  await expect(page.locator('main [data-playlist] li[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('main [data-playlist] li[data-locked]')).toHaveCount(0); // anoniem: geen kind-profiel, niets geblokkeerd
  await expect(page.locator('main iframe')).toHaveCount(0);
  // T2-grens (gemeld, niet gebouwd): een draft-aflevering van de gemeten storefront-collectie blijft 404 tot de zichtbaarheidsbeslissing
  const draft = await page.goto('/watch/01-1696848');
  expect(draft?.status()).toBe(404);
});
