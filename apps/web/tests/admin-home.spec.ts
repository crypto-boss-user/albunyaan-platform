import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll } from './lib/supabase-rest';

/**
 * AD 2.1 — Home in de Uscreen-vorm. Norm = de meting van AD 0b (reference/admin-2026-09/ad0b-2026-09-07/text/home.json, 2026-09-07):
 * kopbalk "Welcome, <naam>.", blok "Last 30-day performance" met Gross Revenue · Sign Ups · Video Views, elk met "View more".
 * Founder 2026-09-07 (vraag 5, B84): voorbeeldtegels alleen op Home met zichtbaar label VOORBEELD + tooltip; echte cijfers zonder label.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const TOOLTIP = 'echte cijfers na betaal-/kijkplatformkoppeling';

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 2.1: Home — bloktitels == meting; VOORBEELD-label alleen op de voorbeeldtegels; Sign Ups == REST-telling (30 d)', async ({ page }) => {
  const home = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/ad0b-2026-09-07/text/home.json'), 'utf8')) as {
    koppen: { tag: string; tekst: string }[];
    links: { tekst: string; href: string }[];
    tekst: string;
  };
  const gemetenKop = home.koppen.map((k) => k.tekst);
  expect(gemetenKop).toEqual(['Last 30-day performance']);
  // de drie tegeltitels staan in de gemeten paginatekst, in deze volgorde (Uscreen toont waarde boven titel)
  const gemetenTegels = ['Gross Revenue', 'Sign Ups', 'Video Views'];
  const tekstVolgorde = gemetenTegels.map((t) => home.tekst.indexOf(t));
  expect(tekstVolgorde.every((i, n) => i >= 0 && (n === 0 || i > tekstVolgorde[n - 1]))).toBe(true);
  const gemetenViewMore = home.links.filter((l) => l.tekst === 'View more').length;
  expect(gemetenViewMore).toBe(3);

  const res = await page.goto('/admin');
  expect(res?.status()).toBe(200);
  await expect(page.locator('.admin-shell nav[aria-label="Breadcrumb"]')).toHaveText(/^Welcome, .+\.$/);
  await expect(page.locator('[data-admin-home] h1')).toHaveText(gemetenKop);
  await expect(page.locator('[data-home-tile] [data-tile-title]')).toHaveText(gemetenTegels);
  await expect(page.locator('[data-home-tile] a', { hasText: 'View more' })).toHaveCount(gemetenViewMore);

  // voorbeeldtegels: label + tooltip; echte tegel: geen label
  for (const t of ['Gross Revenue', 'Video Views']) {
    const tile = page.locator(`[data-home-tile="${t}"]`);
    await expect(tile).toHaveAttribute('data-voorbeeld', 'true');
    await expect(tile.locator('[data-voorbeeld-label]')).toHaveText('VOORBEELD');
    await expect(tile.locator('[data-voorbeeld-label]')).toHaveAttribute('title', TOOLTIP);
  }
  const signups = page.locator('[data-home-tile="Sign Ups"]');
  await expect(signups).toHaveAttribute('data-voorbeeld', 'false');
  await expect(signups.locator('[data-voorbeeld-label]')).toHaveCount(0);

  // Sign Ups == onafhankelijke REST-telling van people.signup_at in de laatste 30 dagen (gepagineerd, geen 1000-clamp)
  const sinds = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await fetchAll<{ id: string }>(`people?select=id&signup_at=gte.${encodeURIComponent(sinds)}`);
  await expect(signups.locator('[data-tile-value]')).toHaveText(rows.length.toLocaleString('en-US'));

  // Home in het zijmenu actief; View more van de echte tegel → People
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Home"] a[data-active="true"]')).toHaveCount(1);
  await expect(page.locator('[data-recent-activity] h2')).toHaveText('Recent activity');
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad2/stap-1/admin-home__1440.png'), fullPage: false, mask: [page.locator('[data-admin-sidebar]'), page.locator('.admin-shell nav[aria-label="Breadcrumb"]')] }); // B82: adres/naam gemaskeerd zoals admin-people.spec.ts
  await signups.locator('a', { hasText: 'View more' }).click();
  await expect(page).toHaveURL(/\/admin\/people$/);
});
