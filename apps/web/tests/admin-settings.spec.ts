import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, noteerAfwezig, registreerTestSleutel, verwijderRijAlsNieuw, verwijderTestRijenWaar } from './lib/supabase-rest';

/**
 * AD 2.2 — Settings in de Uscreen-vorm. Norm = AD0-inventaris §2.8 (reference/admin-2026-09/ad0b-2026-09-07/text/settings-*.json, 2026-09-07)
 * en SR 2b (General, Domain, Email templates, Snippets). Founder 2026-09-07 (vraag 6): alle 14 kaarten met alle gemeten velden; opslaan via de
 * settings-tabel; betaal-/Stripe-/PayPal-velden uitgeschakeld "tot de betaalbeslissing"; secrets nooit tonen. Testrecords: TEST-AD2-…, daarna opruimen en tellen.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const AD0B = path.join(REPO, 'reference/admin-2026-09/ad0b-2026-09-07/text');
const SR2B = path.join(REPO, 'reference/storefront-2026-09/sr2b-2026-09-04/admin');
const lees = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as { koppen: ({ tekst: string } | string)[]; links?: { tekst: string; href: string }[]; tekst?: string };
const kop = (k: { tekst: string } | string) => (typeof k === 'string' ? k.replace(/^H\d: /, '') : k.tekst);

/** Eigen route → gemeten bestand + wat de gemeten koppen zijn (h1 = paginatitel, of h2's = sectiekoppen). */
const PAGINAS: { route: string; bron: string; h1?: string; h2s?: true }[] = [
  { route: '/admin/settings/general', bron: `${SR2B}/D-general-settings.json` },
  { route: '/admin/settings/domain', bron: `${SR2B}/E-domain-settings.json` },
  { route: '/admin/settings/checkout', bron: `${AD0B}/settings-checkout.json`, h1: 'Checkout', h2s: true },
  { route: '/admin/settings/checkout/localized-pricing', bron: `${AD0B}/settings-checkout-tab-localized-pricing.json` },
  { route: '/admin/settings/snippets', bron: `${SR2B}/snippets/B-snippets-pagina.json` },
  { route: '/admin/settings/user-fields', bron: `${AD0B}/settings-user-fields.json` },
  { route: '/admin/settings/marketing-email', bron: `${AD0B}/settings-marketing-email.json` },
  { route: '/admin/settings/email-templates', bron: `${SR2B}/email-templates/00-lijst.json` },
  { route: '/admin/settings/calendar-push-templates', bron: `${AD0B}/settings-calendar-push-templates.json` },
  { route: '/admin/settings/video-comments', bron: `${AD0B}/settings-video-comments.json` },
  { route: '/admin/settings/exported-files', bron: `${AD0B}/settings-exported-files.json` },
  { route: '/admin/settings/webhooks', bron: `${AD0B}/settings-webhooks.json` },
  { route: '/admin/settings/integrations', bron: `${AD0B}/settings-integrations.json`, h1: 'Integrations', h2s: true },
  { route: '/admin/settings/security', bron: `${AD0B}/settings-security.json` },
  { route: '/admin/settings/geo-blocking', bron: `${AD0B}/settings-geo-blocking.json` },
];

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 2.2: hub — 3 groepen en 14 kaarten == meting (+ eigen kaart Team); elke subpagina 200 met de gemeten kop; anoniem 307', async ({ page, playwright, baseURL }) => {
  test.setTimeout(240_000);
  const hub = lees(`${AD0B}/settings-hub.json`);
  const gemetenKaarten = (hub.links ?? []).filter((l) => l.href.startsWith('/manage')).map((l) => l.href);
  expect(gemetenKaarten.length).toBe(14);
  expect(hub.koppen.map(kop)).toEqual(['Storefront setup', 'Communication', 'Integration & security']);

  const res = await page.goto('/admin/settings');
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-settings-hub] h2')).toHaveText(hub.koppen.map(kop));
  await expect(page.locator('[data-settings-card]:not([data-extra])')).toHaveCount(14);
  await expect(page.locator('[data-settings-card][data-extra]')).toHaveText(/Team/);
  // gemeten kaarttitels in volgorde (uit de hub-tekst: titel gevolgd door de uitlegregel)
  const titels = await page.locator('[data-settings-card]:not([data-extra]) > span:first-child').allInnerTexts();
  const tekst = hub.tekst ?? '';
  let pos = 0;
  for (const t of titels) {
    const i = tekst.indexOf(t, pos);
    expect(i, `kaart "${t}" in gemeten volgorde`).toBeGreaterThanOrEqual(pos);
    pos = i + t.length;
  }
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad2/stap-2/admin-settings-hub__1440.png'), fullPage: false });

  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const p of PAGINAS) {
    const bron = lees(p.bron);
    const r = await page.goto(p.route);
    expect(r?.status(), p.route).toBe(200);
    const koppen = bron.koppen.map(kop);
    if (p.h2s) {
      await expect(page.locator('h1'), p.route).toHaveText(p.h1!);
      await expect(page.locator('[data-settings-page] h2'), p.route).toHaveText(koppen);
    } else {
      await expect(page.locator('h1'), p.route).toHaveText(koppen[0]);
    }
    // geen geheime waarden of Uscreen-account-ID's in de pagina (B84)
    const bevatGeheim = await page.locator('main').evaluate((main) => {
      const elementen = [main, ...main.querySelectorAll('*')];
      const waarden = elementen.flatMap((el) => [
        ...Array.from(el.attributes, (attr) => attr.value),
        ...(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? [el.value] : []),
      ]);
      return /acct_[A-Za-z0-9]|sk_(live|test)_|whsec_/.test([main instanceof HTMLElement ? main.innerText : main.textContent, ...waarden].join('\n'));
    });
    expect(bevatGeheim, `${p.route}: geen geheime waarden in tekst, velden of attributen`).toBe(false);
    const anon = await request.get(p.route, { maxRedirects: 0 });
    expect(anon.status(), `anoniem ${p.route}`).toBe(307);
  }
  await request.dispose();
  // betaal-velden zichtbaar maar uit (founder: "tot de betaalbeslissing")
  await page.goto('/admin/settings/checkout');
  await expect(page.locator('[data-provider]')).toHaveCount(3);
  await expect(page.locator('[data-save]')).toBeDisabled();
  await expect(page.locator('[data-knop-uit]').first()).toBeDisabled();
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad2/stap-2/admin-settings-checkout__1440.png'), fullPage: false });
});

test('AD 2.2: TEST-AD2-instelling opslaan en terugzetten (User fields); Team == platform_admins; opruimtelling', async ({ page }) => {
  const key = 'user_fields.field_1';
  // opslaan van de sectie upsert ALLE drie user_fields-keys (koude review AD 2.2 I-1) → per key noteren of de rij al bestond
  const KEYS = ['user_fields.field_1', 'user_fields.field_2', 'user_fields.field_3'];
  const bestaand = new Set((await fetchAll<{ key: string }>(`admin_settings?select=key&key=in.(${KEYS.join(',')})`)).map((r) => r.key));
  for (const k of KEYS) if (!bestaand.has(k)) noteerAfwezig('admin_settings', 'key', k);
  const bestondAl = bestaand.has(key);
  const waarde = `TEST-AD2-veld ${Date.now()}`;
  registreerTestSleutel(waarde); // de unieke waarde is de eigen sleutel voor de audit-opruiming (jsonb-contains)

  await page.goto('/admin/settings/user-fields');
  const veld = page.locator(`input[name="${key}"]`);
  const vorige = await veld.inputValue();
  let audit = 0, rijWeg = 0;
  let restAudit: unknown[] = [], restRijen: { key: string }[] = [];
  try {
    await veld.fill(waarde);
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-form-saved]')).toBeVisible();
    await page.reload();
    await expect(page.locator(`input[name="${key}"]`)).toHaveValue(waarde);
    const rij = await fetchAll<{ value: string }>(`admin_settings?select=value&key=eq.${key}`);
    expect(rij[0]?.value).toBe(waarde);

    // Team == REST-telling van platform_admins (geen e-mailadressen in de uitvoer)
    const admins = await fetchAll<{ auth_user_id: string }>('platform_admins?select=auth_user_id');
    await page.goto('/admin/settings/team');
    await expect(page.locator('[data-team] tbody tr')).toHaveCount(admins.length);
    await expect(page.locator('[data-knop-uit="Add admin"]')).toBeDisabled();

  } finally {
    try {
      await page.goto('/admin/settings/user-fields');
      // terugzetten
      await page.locator(`input[name="${key}"]`).fill(vorige);
      await page.locator('[data-save]').click();
      await expect(page.locator('[data-form-saved]')).toBeVisible();
      await page.reload();
      await expect(page.locator(`input[name="${key}"]`)).toHaveValue(vorige);

    } finally {
      // opruimen: audit-rijen van deze test (after óf before bevat de TEST-AD2-waarde; jsonb-contains, want de key bevat een punt) + de settings-rij als die nieuw was
      const bevat = encodeURIComponent(JSON.stringify({ [key]: waarde }));
      const auditFilter = `entity=eq.admin_settings&or=(after.cs.${bevat},before.cs.${bevat})`;
      audit = await verwijderTestRijenWaar('admin_audit_log', auditFilter, waarde);
      for (const k of KEYS) if (!bestaand.has(k)) rijWeg += await verwijderRijAlsNieuw('admin_settings', 'key', k);
      restAudit = await fetchAll(`admin_audit_log?select=id&${auditFilter}`);
      restRijen = (await fetchAll<{ key: string }>(`admin_settings?select=key&key=in.(${KEYS.join(',')})`)).filter((r) => !bestaand.has(r.key));
      console.log(`OPRUIMTELLING AD 2.2: finally-opruiming; audit-rijen verwijderd ${audit}; settings-rijen nieuw aangemaakt ${KEYS.length - bestaand.size}, verwijderd ${rijWeg}; audit-rest ${restAudit.length}; settings-rest ${restRijen.length}`);
    }
  }
  expect(audit).toBe(2);
  expect(rijWeg).toBe(KEYS.length - bestaand.size);
  expect(restAudit.length).toBe(0);
  expect(restRijen.length).toBe(0);
});
