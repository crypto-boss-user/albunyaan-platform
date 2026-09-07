import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';

/**
 * AD 1 stap 1 — admin-raamwerk in Uscreen-look. Norm = de meting van AD 0 (reference/admin-2026-09/ad0-2026-09-06/menu-inventaris.json),
 * minus de door de founder uitgesloten secties (plan §5 B81). Sinds AD 2.1 (B84, founder 2026-09-07) horen Home, Subscriptions, Sales,
 * Analytics (Overview/Content/People/Sales/Subscriptions/Marketing) en Settings (ondergroep) er wél bij. Ingelogd via admin-test (tests/lib/admin-login.ts).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const UITGESLOTEN_HOOFD = new Set(['Community', 'Bundles', 'Website', 'Mobile & TV apps', '— onderaan —', 'Changelog', 'Refer to Uscreen', 'Get help']);
const UITGESLOTEN_SUB = new Set(['Live Streaming', 'Calendar', 'Audiences', 'Tags', 'Comments', 'Community', 'Advanced']);

function verwachtMenu(): { hoofd: string[]; sub: Record<string, string[]> } {
  const inv = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/ad0-2026-09-06/menu-inventaris.json'), 'utf8')) as {
    hoofdmenu: { naam: string; href: string | null }[];
    subsecties: Record<string, { naam: string; href: string }[]>;
  };
  const hoofd = inv.hoofdmenu.map((h) => h.naam).filter((n) => !UITGESLOTEN_HOOFD.has(n));
  const sub: Record<string, string[]> = {
    Content: inv.subsecties['https://app.uscreen.tv/manage/videos'].map((s) => s.naam).filter((n) => !UITGESLOTEN_SUB.has(n)),
    People: inv.subsecties['https://app.uscreen.tv/manage/people'].map((s) => s.naam).filter((n) => !UITGESLOTEN_SUB.has(n)),
    Analytics: inv.subsecties['https://app.uscreen.tv/manage/analytics/overview'].map((s) => s.naam).filter((n) => !UITGESLOTEN_SUB.has(n)),
  };
  return { hoofd, sub };
}

const ROUTES = [
  '/admin', '/admin/videos', '/admin/collections', '/admin/resources', '/admin/categories', '/admin/custom-filters', '/admin/authors',
  '/admin/people', '/admin/marketing', '/admin/marketing/landing-pages', '/admin/marketing/giveaway-funnels', '/admin/marketing/youtube-lead-generator',
  '/admin/marketing/link-in-bio', '/admin/marketing/email-capture', '/admin/marketing/automations', '/admin/marketing/email-broadcasts',
  '/admin/marketing/push-notifications', '/admin/marketing/coupons', '/admin/marketing/gifts', '/admin/marketing/subscription-upsell', '/admin/marketing/abandoned-cart',
  // AD 2.1: de B84-secties (placeholders tot hun stap)
  '/admin/subscriptions', '/admin/sales/invoices', '/admin/settings', '/admin/analytics/overview', '/admin/analytics/content', '/admin/analytics/people',
  '/admin/analytics/sales', '/admin/analytics/subscriptions', '/admin/analytics/marketing',
  '/admin/analytics', '/admin/sales', // redirect-pagina's: ingelogd → doel, anoniem → /login (koude review AD 2.1, M-1)
];
const REDIRECTS: Record<string, string> = { '/admin/analytics': '/admin/analytics/overview', '/admin/sales': '/admin/sales/invoices' };

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } }); // aal2-adminsessie uit de global setup

test('AD 1.1: zijmenu == inventaris minus uitsluitingen (B81), volgorde en namen', async ({ page }) => {
  const { hoofd, sub } = verwachtMenu();
  // bewijs dat de uitsluitingslijst het gemeten JSON tot precies de scope reduceert; Settings staat bij Uscreen in de ondergroep
  expect(hoofd).toEqual(['Home', 'Content', 'People', 'Subscriptions', 'Sales', 'Marketing', 'Analytics', 'Settings']);
  const res = await page.goto('/admin/videos');
  expect(res?.status()).toBe(200);
  const secties = await page.locator('[data-admin-sidebar] nav > ul > li[data-menu-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-section')));
  expect(secties).toEqual(hoofd);
  await expect(page.locator('[data-admin-sidebar] nav > ul[data-menu-onderaan] > li[data-menu-section]')).toHaveAttribute('data-menu-section', 'Settings');
  await expect(page.locator('[data-admin-sidebar] nav > ul:not([data-menu-onderaan]) > li[data-menu-section]')).toHaveCount(hoofd.length - 1);
  // Content staat open (actieve sectie) met de gemeten subsecties in volgorde
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Content"] ul a')).toHaveText(sub.Content);
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Content"] a[data-active="true"]')).toHaveText('Videos');
  // People uitklappen → alleen "All"
  await page.locator('[data-admin-sidebar] li[data-menu-section="People"] > button').click();
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="People"] ul a')).toHaveText(sub.People);
  // Analytics uitklappen → de zes B84-subsecties in gemeten volgorde (Community/Advanced = alleen menunaam, weggelaten)
  await page.locator('[data-admin-sidebar] li[data-menu-section="Analytics"] > button').click();
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Analytics"] ul a')).toHaveText(sub.Analytics);
  expect(sub.Analytics).toEqual(['Overview', 'Content', 'People', 'Sales', 'Subscriptions', 'Marketing']);
  // Kopbalk: broodkruimel Content › Videos; geen storefront-kop/-voet zichtbaar; Inter als font in de schil
  await expect(page.locator('.admin-shell nav[aria-label="Breadcrumb"]')).toHaveText(/Content.*Videos/);
  await expect(page.locator('body > header, body > footer').filter({ visible: true })).toHaveCount(0);
  const font = await page.locator('.admin-shell').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(font.replace(/["']/g, '')).toMatch(/Inter/);
  // Uitgesloten secties komen nergens in het menu voor
  const menuTekst = await page.locator('[data-admin-sidebar] nav').innerText();
  for (const n of ['Live Streaming', 'Calendar', 'Audiences', 'Community', 'Bundles', 'Website', 'Mobile & TV apps', 'Advanced', 'Changelog', 'Get help']) expect(menuTekst).not.toContain(n);
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-1/admin-videos__1440.png'), fullPage: false });
});

test('AD 1.1: elke scope-route 200 ingelogd en 307 → /login anoniem; placeholders zonder dode knoppen', async ({ page, playwright, baseURL }) => {
  test.setTimeout(240_000); // 32 routes × (ingelogde GET + anonieme GET); onder belasting > 30 s gemeten (2026-09-06)
  // playwright.request.newContext erft test.use({ storageState }) — expliciet leeg, anders is "anoniem" ingelogd (gemeten 2026-09-06: 200 i.p.v. 307)
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    expect(new URL(page.url()).pathname, r).toBe(REDIRECTS[r] ?? r);
    const anon = await request.get(r, { maxRedirects: 0 });
    expect(anon.status(), `anoniem ${r}`).toBe(307);
    expect(anon.headers()['location'], `anoniem ${r}`).toMatch(/\/login/);
    if (await page.locator('[data-nog-niet-gebouwd]').count()) {
      await expect(page.locator('[data-nog-niet-gebouwd]')).toContainText(/Nog niet gebouwd — AD stap (2\.[2-5]|[2-5])(?![.\d])/);
      await expect(page.locator('[data-nog-niet-gebouwd] button')).toHaveCount(0);
    }
  }
  // Marketing-hub: kaarten == gemeten hub-links (text/marketing-hub.json: 14) minus Refer a friend en Try again for free (B81) = 12, elk een echte link
  const hub = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/ad0-2026-09-06/text/marketing-hub.json'), 'utf8')) as { links: { href: string }[] };
  const gemetenKaarten = hub.links.filter((l) => /^\/manage\/(marketings\/|link-in-bio)/.test(l.href) && !/referral_program|try_again_for_free/.test(l.href));
  expect(gemetenKaarten.length).toBe(12);
  await page.goto('/admin/marketing');
  await expect(page.locator('[data-marketing-card]')).toHaveCount(gemetenKaarten.length);
  await expect(page.locator('main h2')).toHaveText(['Generate leads', 'Nurture audience']);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await expect(page.locator('[data-admin-sidebar]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await expect(page.locator('[data-admin-sidebar]')).toHaveCount(1);
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-1/admin-marketing__1440.png'), fullPage: false });
  await request.dispose();
});
