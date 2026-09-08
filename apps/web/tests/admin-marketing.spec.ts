import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, leesRij, registreerTestId, registreerTestSleutel, verwijderTestRijen, verwijderTestRijenWaar } from './lib/supabase-rest';

/**
 * AD 1 stap 5 — Marketing › Coupons (op de vouchers-tabel) en Landing pages (norm AD0-inventaris §2.3). Coupon aanmaken/deactiveren
 * alleen met een TEST-AD1-code die de test zelf opruimt (founder (d)); landing-pages-lijst == de 9 gemeten pagina's.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 1.5: coupons — lijst == REST, TEST-AD1-coupon aanmaken (Uscreen-velden), deactiveren, opruimen; oude /admin/vouchers-route', async ({ page }) => {
  test.setTimeout(180_000);
  const code = `TEST-AD1-${Date.now().toString(36).toUpperCase()}`;
  registreerTestSleutel(code); // de code is de eigen sleutel voor de opruiming (vouchers.code, audit entity_id)
  let id = '', verwijderd = 0;
  try {
    const alle = await fetchAll<{ id: string }>('vouchers?select=id');
    await page.goto('/admin/marketing/coupons');
    await expect(page.locator('main h1')).toHaveText('Coupons');
    for (const k of ['Coupon', 'Discount', 'Redeemed', 'Status', 'Expires']) await expect(page.locator('[data-coupons-table] thead')).toContainText(k);
    await expect(page.locator('[data-coupons-page]')).toContainText(`${alle.length} coupons`);
    await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-5/admin-coupons-lijst__1440.png') });
    // New coupon: Code · Discount (100 %) · description · Expires on · Limit to 5 · Subscription
    await page.goto('/admin/marketing/coupons/new');
    for (const k of ['Coupon details', 'Redemption limits', 'Content']) await expect(page.locator(`[data-card="${k}"]`)).toHaveCount(1);
    await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-5/admin-coupon-new__1440.png'), fullPage: true });
    await page.fill('#code', code.toLowerCase()); // wordt hoofdletters
    await page.fill('#durationDays', '30');
    await page.fill('#sponsorLabel', 'TEST-AD1 testcoupon');
    await page.locator('[data-expires] input[value="expires_on"]').check();
    await page.fill('input[name="expiresAt"]', '2030-12-31');
    await page.locator('[data-limit] input[value="limit_to"]').check();
    await page.fill('input[name="maxRedemptions"]', '5');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-form-saved]')).toContainText(code);
    const rows = await fetchAll<{ id: string; code: string; duration_days: number; max_redemptions: number; status: string; expires_at: string; sponsor_label: string }>(`vouchers?select=id,code,duration_days,max_redemptions,status,expires_at,sponsor_label&code=eq.${code}`);
    expect(rows).toHaveLength(1);
    id = rows[0].id;
    await registreerTestId('vouchers', id, 'code');
    expect(rows[0]).toMatchObject({ duration_days: 30, max_redemptions: 5, status: 'active', sponsor_label: 'TEST-AD1 testcoupon' });
    expect(rows[0].expires_at.slice(0, 10)).toBe('2030-12-31');
    // lijst toont de coupon in Uscreen-vorm; deactiveren via bevestiging
    await page.goto(`/admin/marketing/coupons?q=${code}`);
    const rij = page.locator(`[data-coupon-row="${code}"]`);
    await expect(rij).toContainText('100% Off · Subscription · 30 days');
    await expect(rij).toContainText('0/5');
    await expect(rij.locator('.ad-badge')).toHaveText('Active');
    await expect(rij).toContainText('December 31, 2030');
    await rij.locator('[data-confirm-delete] summary').click();
    await rij.locator('[data-confirm-delete] form button').click();
    await expect(page.locator(`[data-coupon-row="${code}"] .ad-badge`)).toHaveText('Deactivated');
    expect(await leesRij('vouchers', id, 'status')).toMatchObject({ status: 'disabled' });
    // filter Expires on → de testcoupon zit erbij; Never expires → niet
    await page.goto(`/admin/marketing/coupons?q=${code}&exp=expires`);
    await expect(page.locator(`[data-coupon-row="${code}"]`)).toHaveCount(1);
    await page.goto(`/admin/marketing/coupons?q=${code}&exp=never`);
    await expect(page.locator(`[data-coupon-row="${code}"]`)).toHaveCount(0);
    await page.goto('/admin/vouchers');
    await expect(page).toHaveURL(/\/admin\/marketing\/coupons$/);
  } finally {
    if (id) verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', id);
    // altijd op code opruimen — ook als de test crashte vóór de id bekend was (koude review: geen levende gratis-toegangscode achterlaten)
    verwijderd += await verwijderTestRijenWaar('vouchers', `code=like.TEST-AD1-*&code=eq.${encodeURIComponent(code)}`, code);
    // voucher.create logt de code als entity_id → opruimen op de eigen TEST-AD1-code
    verwijderd += await verwijderTestRijenWaar('admin_audit_log', `action=eq.voucher.create&entity_id=like.TEST-AD1-*&entity_id=eq.${encodeURIComponent(code)}`, code);
    console.log(`OPRUIMTELLING AD 1.5: aangemaakt ${id ? 1 : 0} coupon; verwijderd ${verwijderd} rijen; rest: ${id ? (await fetchAll(`vouchers?select=id&id=eq.${id}`)).length : 0}`);
  }
  expect((await fetchAll(`vouchers?select=id&code=eq.${code}`)).length).toBe(0);
});

test('AD 1.5: landing pages — 9 gemeten pagina\'s met instellingen en inhoud; builder uitgeschakeld', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/admin/marketing/landing-pages');
  await expect(page.locator('[data-landing-pages-table] tbody tr')).toHaveCount(9);
  await expect(page.locator('[data-landing-pages-table]')).toContainText('Sign in form');
  await expect(page.locator('[data-landing-pages-table]')).toContainText('/pages/qa');
  await expect(page.getByRole('button', { name: 'Create a page' })).toBeDisabled();
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-5/admin-landing-pages__1440.png') });
  await page.goto('/admin/marketing/landing-pages/52371');
  await expect(page.locator('main h1')).toHaveText('Q&A');
  await expect(page.locator('[data-card="Settings"]')).toContainText('/pages/qa');
  await expect(page.locator('[data-card="Settings"]')).toContainText('Yes');
  await expect(page.locator('[data-card="Content"] pre')).toContainText(/Q&A|question/i);
  await expect(page.getByRole('button', { name: 'Edit in builder' })).toBeDisabled();
  const r = await page.goto('/admin/marketing/landing-pages/000000');
  expect(r?.status()).toBe(404);
});
