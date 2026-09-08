import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, maakTestRij, verwijderTestRijen } from './lib/supabase-rest';

/**
 * AD 1 stap 4 — People › All in de Uscreen-vorm (norm AD0-inventaris §2.2). Telling == REST (gepagineerd); detail 200 op een
 * TEST-AD1-lid dat de test zelf aanmaakt en opruimt (founder (d)); de test print geen persoonsgegevens (B82) — alleen tellingen.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 1.4: ledenlijst — telling == REST, gemeten kolommen, filters, oude /admin/members-route', async ({ page, playwright, baseURL }) => {
  test.setTimeout(180_000);
  const [alle, actief, leads] = await Promise.all([
    fetchAll<{ id: string }>('people?select=id'),
    fetchAll<{ id: string }>('people?select=id&raw->>Status=eq.active'),
    fetchAll<{ id: string }>('people?select=id&raw->>Status=eq.lead'),
  ]);
  const res = await page.goto('/admin/people');
  expect(res?.status()).toBe(200);
  await expect(page.locator('main h1')).toHaveText('People');
  await expect(page.locator('[data-people-table] thead')).toContainText(`${alle.length.toLocaleString('de-DE')} people`);
  for (const kolom of ['Tags', 'Status', 'Lifetime', 'Creation date']) await expect(page.locator('[data-people-table] thead')).toContainText(kolom);
  await expect(page.locator('[data-people-table] tbody tr')).toHaveCount(25);
  await expect(page.locator('[data-pagination]')).toContainText(`Showing 1–25 of ${alle.length.toLocaleString('de-DE')} people`);
  await expect(page.getByRole('button', { name: 'Add member' })).toBeDisabled();
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-4/admin-people-lijst__1440.png'), mask: [page.locator('[data-people-table] tbody'), page.locator('[data-admin-sidebar]')] }); // rijen + zijbalk (admin-adres) gemaskeerd (B82)
  await page.goto('/admin/people?status=active');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${actief.length.toLocaleString('de-DE')} people`);
  const badges = await page.locator('[data-people-table] tbody .ad-badge').allTextContents();
  expect(badges.length).toBe(await page.locator('[data-people-table] tbody tr').count()); // elke rij een Active-badge (koude review M-3)
  for (const b of badges) expect(b).toBe('Active');
  const zonderRaw = await fetchAll<{ id: string }>('people?select=id&raw=is.null');
  await page.goto('/admin/people?type=lead');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${(leads.length + zonderRaw.length).toLocaleString('de-DE')} people`); // zonder export-rij telt als Lead
  await page.goto('/admin/people?type=member');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${(alle.length - leads.length - zonderRaw.length).toLocaleString('de-DE')} people`);
  await page.goto('/admin/people?q=' + encodeURIComponent('a,b(c)')); // komma/haakjes mogen geen 500 geven
  await expect(page.locator('main h1')).toHaveText('People');
  await page.goto('/admin/members');
  await expect(page).toHaveURL(/\/admin\/people$/);
  // Codex A-i (T-5): de legacy-redirect draagt zelf de adminpoort — anoniem 307 rechtstreeks naar /login, niet via /admin/people
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const anon = await request.get('/admin/members?q=x', { maxRedirects: 0 });
  expect(anon.status()).toBe(307);
  expect(anon.headers()['location']).toMatch(/^\/login/);
  await request.dispose();
});

test('AD 1.4: TEST-AD1-lid — detail 200 met de gemeten velden, alleen lezen, zoeken, opruimen (geen PII in de uitvoer)', async ({ page, playwright, baseURL }) => {
  test.setTimeout(180_000);
  const ts = Date.now();
  const p = await maakTestRij<{ id: string }>('people', {
    external_id: `test-ad1-${ts}`, source: 'test-ad1', email: `test-ad1-${ts}@example.invalid`, full_name: `TEST-AD1-lid ${ts}`, language: 'nl',
    raw: { Status: 'lead', Lifetime: '€0.00', 'Lead Source': 'Email capture', 'Creation Source': 'test' },
  });
  let verwijderd = 0;
  try {
    const res = await page.goto(`/admin/people/${p.id}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText(`TEST-AD1-lid ${ts}`);
    for (const k of ['About', 'Invoices', 'Emails', 'Activity', 'Profile', 'Email Topic notifications', 'Watch history', 'Content access']) await expect(page.locator(`[data-card="${k}"]`)).toHaveCount(1);
    for (const label of ['Age', 'Country of residence', 'Preferred Language', 'Private notes', 'Email', 'Display Name', 'Tags']) await expect(page.locator('[data-card="About"]')).toContainText(label);
    await expect(page.locator('[data-card="About"]')).toContainText('nl');
    await expect(page.locator('[data-card="Profile"]')).toContainText('Lead');
    await expect(page.locator('[data-card="Profile"]')).toContainText('Email capture');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '+ Add membership' })).toBeDisabled();
    await expect(page.locator('[data-admin-main] form')).toHaveCount(0); // alleen lezen: geen formulieren die leden wijzigen (Sign out staat in de zijbalk)
    await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-4/admin-person-detail__1440.png'), fullPage: true, mask: [page.locator('main h1'), page.locator('[data-card="About"] .ad-input'), page.locator('[data-card="Profile"]'), page.locator('[data-admin-sidebar]')] });
    // zoeken op naam → 1 rij; oude route /admin/members/<id> → /admin/people/<id>
    await page.goto(`/admin/people?q=${encodeURIComponent(`TEST-AD1-lid ${ts}`)}`);
    await expect(page.locator(`[data-person-row="${p.id}"]`)).toHaveCount(1);
    await page.goto(`/admin/members/${p.id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/people/${p.id}$`));
    const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const anon = await request.get(`/admin/members/${p.id}`, { maxRedirects: 0 }); // Codex A-i: anoniem → /login, geen omweg
    expect(anon.status()).toBe(307);
    expect(anon.headers()['location']).toMatch(/^\/login/);
    await request.dispose();
  } finally {
    verwijderd += await verwijderTestRijen('people', 'id', p.id);
    console.log(`OPRUIMTELLING AD 1.4: aangemaakt 1 lid; verwijderd ${verwijderd}; rest: ${(await fetchAll(`people?select=id&id=eq.${p.id}`)).length}`);
  }
  expect((await fetchAll(`people?select=id&id=eq.${p.id}`)).length).toBe(0);
});
