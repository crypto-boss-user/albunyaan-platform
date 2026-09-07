import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';

/**
 * AD 2.4 — Sales › Invoices in de Uscreen-vorm. Norm = AD0-inventaris §2.6 (reference/admin-2026-09/ad0b-2026-09-07/text/sales-invoices-lijst.json).
 * Founder 2026-09-07 (vraag 8): lege lijst met de gemeten kolommen en filters, "tot de betaalbeslissing", geen voorbeeldrijen; export-knop uit met reden.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 2.4: /admin/sales → Invoices 200; kolommen, filters en knoppen == meting; lege staat zonder voorbeeldrijen', async ({ page, playwright, baseURL }) => {
  const bron = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/ad0b-2026-09-07/text/sales-invoices-lijst.json'), 'utf8')) as {
    koppen: { tekst: string }[]; tekst: string; knoppen: { tekst: string; haspopup: string | null }[]; velden: { placeholder: string }[];
  };
  expect(bron.koppen.map((k) => k.tekst)).toEqual(['Invoices']);
  const kolommen = ['Invoice', 'User', 'Created', 'Status', 'Paid at', 'Coupon', 'Total'];
  const i = bron.tekst.indexOf('Invoice User Created Status Paid at Coupon Total');
  expect(i).toBeGreaterThan(0); // de zeven kolommen staan letterlijk in deze volgorde in de gemeten tekst
  const gemetenKnoppen = bron.knoppen.map((k) => k.tekst).filter((t) => ['Export CSV', 'All Statuses', 'Created (newest first)', 'More Filters'].includes(t));
  expect(gemetenKnoppen).toEqual(['Export CSV', 'All Statuses', 'Created (newest first)', 'More Filters']);
  expect(bron.velden.map((v) => v.placeholder)).toEqual(['Search...']);

  const res = await page.goto('/admin/sales');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/sales\/invoices$/);
  await expect(page.locator('h1')).toHaveText('Invoices');
  await expect(page.locator('.admin-shell nav[aria-label="Breadcrumb"]')).toHaveText(/Sales.*Invoices/);
  await expect(page.locator('[data-invoices-table] thead th')).toHaveText(kolommen);
  await expect(page.locator('[data-invoices-table] tbody tr')).toHaveCount(1);
  await expect(page.locator('[data-invoices-empty]')).toContainText('tot de betaalbeslissing');
  await expect(page.locator('[data-invoices-total]')).toHaveText('0 invoices • Total: €0.00');
  for (const naam of ['All Statuses', 'Created (newest first)', 'Search...']) await expect(page.getByLabel(naam)).toBeDisabled();
  for (const knop of ['Export CSV', 'More Filters']) {
    const b = page.locator(`[data-knop-uit="${knop}"]`);
    await expect(b).toBeDisabled();
    await expect(b).toHaveAttribute('title', /tot de betaalbeslissing/);
  }
  await expect(page.locator('[data-home-tile], [data-voorbeeld-label]')).toHaveCount(0);
  // anoniem → /login
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const anon = await request.get('/admin/sales/invoices', { maxRedirects: 0 });
  expect(anon.status()).toBe(307);
  await request.dispose();
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad2/stap-4/admin-sales-invoices__1440.png'), fullPage: false, mask: [page.locator('[data-admin-sidebar]')] });
});
