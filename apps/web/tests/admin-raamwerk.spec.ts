import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { loginAsAdmin } from './lib/admin-login';

/**
 * AD 1 stap 1 — admin-raamwerk in Uscreen-look. Norm = de meting van AD 0 (reference/admin-2026-09/ad0-2026-09-06/menu-inventaris.json),
 * minus de door de founder uitgesloten secties (plan §5 B81). Ingelogd via admin-test (tests/lib/admin-login.ts).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const UITGESLOTEN_HOOFD = new Set(['Home', 'Community', 'Subscriptions', 'Bundles', 'Sales', 'Website', 'Analytics', 'Mobile & TV apps', '— onderaan —', 'Changelog', 'Refer to Uscreen', 'Get help', 'Settings']);
const UITGESLOTEN_SUB = new Set(['Live Streaming', 'Calendar', 'Audiences', 'Tags', 'Comments']);

function verwachtMenu(): { hoofd: string[]; sub: Record<string, string[]> } {
  const inv = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/ad0-2026-09-06/menu-inventaris.json'), 'utf8')) as {
    hoofdmenu: { naam: string; href: string | null }[];
    subsecties: Record<string, { naam: string; href: string }[]>;
  };
  const hoofd = inv.hoofdmenu.map((h) => h.naam).filter((n) => !UITGESLOTEN_HOOFD.has(n));
  const sub: Record<string, string[]> = {
    Content: inv.subsecties['https://app.uscreen.tv/manage/videos'].map((s) => s.naam).filter((n) => !UITGESLOTEN_SUB.has(n)),
    People: inv.subsecties['https://app.uscreen.tv/manage/people'].map((s) => s.naam).filter((n) => !UITGESLOTEN_SUB.has(n)),
  };
  return { hoofd, sub };
}

const ROUTES = [
  '/admin', '/admin/videos', '/admin/collections', '/admin/resources', '/admin/categories', '/admin/custom-filters', '/admin/authors',
  '/admin/people', '/admin/marketing', '/admin/marketing/landing-pages', '/admin/marketing/giveaway-funnels', '/admin/marketing/youtube-lead-generator',
  '/admin/marketing/link-in-bio', '/admin/marketing/email-capture', '/admin/marketing/automations', '/admin/marketing/email-broadcasts',
  '/admin/marketing/push-notifications', '/admin/marketing/coupons', '/admin/marketing/gifts', '/admin/marketing/subscription-upsell', '/admin/marketing/abandoned-cart',
];

let admin: BrowserContext;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000); // de echte login-flow (confirm → Continue → TOTP) doet 3 paginaloads; onder belasting > 30 s gemeten (2026-09-06)
  admin = await loginAsAdmin(browser);
});
test.afterAll(async () => { await admin?.close(); });

test('AD 1.1: zijmenu == inventaris minus uitsluitingen (B81), volgorde en namen', async () => {
  const { hoofd, sub } = verwachtMenu();
  expect(hoofd).toEqual(['Content', 'People', 'Marketing']); // bewijs dat de uitsluitingslijst het gemeten JSON tot precies de scope reduceert
  const page = await admin.newPage();
  const res = await page.goto('/admin/videos');
  expect(res?.status()).toBe(200);
  const secties = await page.locator('[data-admin-sidebar] nav > ul > li[data-menu-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-section')));
  expect(secties).toEqual(hoofd);
  // Content staat open (actieve sectie) met de gemeten subsecties in volgorde
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Content"] ul a')).toHaveText(sub.Content);
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="Content"] a[data-active="true"]')).toHaveText('Videos');
  // People uitklappen → alleen "All"
  await page.locator('[data-admin-sidebar] li[data-menu-section="People"] > button').click();
  await expect(page.locator('[data-admin-sidebar] li[data-menu-section="People"] ul a')).toHaveText(sub.People);
  // Kopbalk: broodkruimel Content › Videos; geen storefront-kop/-voet zichtbaar; Inter als font in de schil
  await expect(page.locator('.admin-shell nav[aria-label="Breadcrumb"]')).toHaveText(/Content.*Videos/);
  await expect(page.locator('body > header, body > footer').filter({ visible: true })).toHaveCount(0);
  const font = await page.locator('.admin-shell').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(font.replace(/["']/g, '')).toMatch(/Inter/);
  // Uitgesloten secties komen nergens in het menu voor
  const menuTekst = await page.locator('[data-admin-sidebar] nav').innerText();
  for (const n of ['Live Streaming', 'Calendar', 'Audiences', 'Community', 'Subscriptions', 'Bundles', 'Sales', 'Analytics', 'Settings']) expect(menuTekst).not.toContain(n);
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-1/admin-videos__1440.png'), fullPage: false });
  await page.close();
});

test('AD 1.1: elke scope-route 200 ingelogd en 307 → /login anoniem; placeholders zonder dode knoppen', async ({ request }) => {
  test.setTimeout(180_000); // 21 routes × (ingelogde GET + anonieme GET); onder belasting > 30 s gemeten (2026-09-06)
  const page = await admin.newPage();
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    expect(new URL(page.url()).pathname, r).toBe(r);
    const anon = await request.get(r, { maxRedirects: 0 });
    expect(anon.status(), `anoniem ${r}`).toBe(307);
    expect(anon.headers()['location'], `anoniem ${r}`).toMatch(/\/login/);
    if (await page.locator('[data-nog-niet-gebouwd]').count()) {
      await expect(page.locator('[data-nog-niet-gebouwd]')).toContainText(/Nog niet gebouwd — AD stap [2-5]/);
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
  await page.close();
});
