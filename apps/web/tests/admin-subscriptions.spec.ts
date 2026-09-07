import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, leesRij, registreerTestId, verwijderTestRijenWaar } from './lib/supabase-rest';

/**
 * AD 2.3 — Subscriptions in de Uscreen-vorm. Norm = AD0-inventaris §2.5 (reference/admin-2026-09/ad0b-2026-09-07/text/subscriptions-lijst.json,
 * -plan-edit.json, -plan-new.json, 2026-09-07). Founder 2026-09-07 (vraag 7): de 11 plannen als data (naam, prijs, valuta, interval, proef,
 * Public/Private, volgorde), geen ledenkoppeling; melding "koppeling aan betaalprovider volgt". Testrecords: TEST-AD2-…, daarna opruimen en tellen.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const AD0B = path.join(REPO, 'reference/admin-2026-09/ad0b-2026-09-07/text');
const KOLOMMEN = ['Plan', 'Visibility', 'In trial', 'Members', 'Content', 'Price', 'Billing'];

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 2.3: lijst — telling == REST (11 geïmporteerde Uscreen-plannen), kolommen/volgorde/prijs/interval == meting, performance-tegels leeg met reden', async ({ page }) => {
  const lijst = JSON.parse(fs.readFileSync(path.join(AD0B, 'subscriptions-lijst.json'), 'utf8')) as { tekst: string; links: { tekst: string; href: string }[] };
  const bron = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/plans-uscreen-2026-09-07.json'), 'utf8')) as { plannen: { uscreen_id: string; title: string; visibility: string; amount_cents: number; billing_period: string }[] };
  expect(bron.plannen.length).toBe(11);
  // de gemeten edit-links (11 ids) == de bron-ids, in volgorde
  const gemetenIds = lijst.links.filter((l) => /\/subscription_plans\/\d+\/edit$/.test(l.href)).map((l) => l.href.match(/(\d+)\/edit$/)![1]);
  expect(gemetenIds).toEqual(bron.plannen.map((p) => p.uscreen_id));
  for (const k of KOLOMMEN) expect(lijst.tekst).toContain(k);

  const alle = await fetchAll<{ id: string; external_id: string; source: string; title: string; visibility: string; amount_cents: number; billing_period: string }>('plans?select=id,external_id,source,title,visibility,amount_cents,billing_period');
  const uscreen = alle.filter((p) => p.source === 'uscreen' && !p.title.startsWith('TEST-AD'));
  expect(uscreen.length).toBe(11);
  for (const b of bron.plannen) {
    const rij = uscreen.find((p) => p.external_id === b.uscreen_id);
    expect(rij, b.title).toBeTruthy();
    expect([rij!.title, rij!.visibility, rij!.amount_cents, rij!.billing_period]).toEqual([b.title, b.visibility, b.amount_cents, b.billing_period]);
  }

  const res = await page.goto('/admin/subscriptions');
  expect(res?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Subscriptions');
  await expect(page.getByRole('link', { name: 'New plan' })).toHaveAttribute('href', '/admin/subscriptions/new');
  await expect(page.locator('[data-plans-table] thead th').filter({ hasText: /\S/ })).toHaveText(KOLOMMEN);
  const rijen = page.locator('[data-plans-table] tbody tr[data-plan-row]');
  await expect(rijen).toHaveCount(alle.length);
  // volgorde en waarden van de 11 Uscreen-rijen zoals gemeten (titel, Public/Private, €prijs, Monthly/Annual)
  const titels = await page.locator('[data-plans-table] tbody tr[data-plan-row] [data-plan-title]').allInnerTexts();
  expect(titels.filter((t) => !t.startsWith('TEST-AD')).slice(0, 11)).toEqual(bron.plannen.map((p) => p.title));
  const eerste = rijen.first();
  await expect(eerste).toContainText('Public');
  await expect(eerste).toContainText('€65.00');
  await expect(eerste).toContainText('Annual');
  await expect(page.locator('[data-performance-overview] h2')).toHaveText('Performance overview');
  await expect(page.locator('[data-overview-tile]')).toHaveCount(3);
  await expect(page.locator('[data-overview-tile="MRR"] [data-tile-value]')).toHaveText('—');
  await expect(page.locator('[data-overview-tile="MRR"] [data-tile-reden]')).toContainText('betaalprovider');
  await expect(page.locator('[data-home-tile], [data-voorbeeld-label]')).toHaveCount(0); // geen VOORBEELD buiten Home (founder vraag 5)
  // zoeken op titel
  await page.goto('/admin/subscriptions?q=Sadaqah');
  await expect(page.locator('[data-plans-table] tbody tr[data-plan-row]')).toHaveCount(2);
  await page.goto('/admin/subscriptions');
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad2/stap-3/admin-subscriptions__1440.png'), fullPage: false, mask: [page.locator('[data-admin-sidebar]')] });
});

test('AD 2.3: TEST-AD2-plan aanmaken (New plan), bewerken (prijs, interval, zichtbaarheid, proef), verwijderen, opruimtelling', async ({ page }) => {
  const edit = JSON.parse(fs.readFileSync(path.join(AD0B, 'subscriptions-plan-edit.json'), 'utf8')) as { tekst: string; koppen: { tekst: string }[] };
  expect(edit.koppen.map((k) => k.tekst)).toEqual(['Edit plan']);
  const titel = `TEST-AD2-plan ${Date.now()}`;

  let id = '';
  let restPlanPrefix = -1;
  let auditWeg = -1;
  try {
    await page.goto('/admin/subscriptions/new');
    await expect(page.locator('h1')).toHaveText('New plan');
    // gemeten velden aanwezig: Plan name, Description, Image, Billing period, Price, Free trial, Pausing, Reduce cancellation churn, Visibility, Content
    for (const label of ['Plan name', 'Description', 'Image', 'Billing period', 'Price', 'Free trial', 'Pausing', 'Reduce cancellation churn', 'Visibility', 'Content']) {
      expect(edit.tekst, label).toContain(label);
      await expect(page.locator('[data-plan-form]'), label).toContainText(label);
    }
    await expect(page.locator('[data-plan-form]')).toContainText('koppeling aan betaalprovider volgt');
    await expect(page.locator('[data-valuta] input').first()).toBeDisabled();
    await page.fill('input[name="title"]', titel);
    await page.fill('textarea[name="description"]', 'TEST-AD2 beschrijving');
    await page.selectOption('select[name="billing_period"]', 'yearly');
    await page.fill('input[name="price"]', '65.00');
    await page.check('input[name="visibility"][value="private"]');
    await page.locator('[data-save]').click();
    await page.waitForURL(/\/admin\/subscriptions\/[0-9a-f-]{36}\/edit\?created=1$/);
    id = page.url().match(/subscriptions\/([0-9a-f-]{36})\/edit/)![1];
    await registreerTestId('plans', id, 'title');
    await expect(page.locator('[data-plan-created]')).toHaveText('Plan created');
    await expect(page.locator('h1')).toHaveText('Edit plan');
    let rij = await leesRij<{ title: string; amount_cents: number; billing_period: string; visibility: string; trial_days: number; source: string; stripe_price_id: string | null }>('plans', id, 'title,amount_cents,billing_period,visibility,trial_days,source,stripe_price_id');
    expect(rij).toMatchObject({ title: titel, amount_cents: 6500, billing_period: 'yearly', visibility: 'private', trial_days: 0, source: 'admin', stripe_price_id: null });

    // bewerken: prijs, interval, zichtbaarheid, proef aan (7 dagen)
    await page.fill('input[name="price"]', '6.50');
    await page.selectOption('select[name="billing_period"]', 'monthly');
    await page.check('input[name="visibility"][value="public"]');
    await page.check('input[name="free_trial"]');
    await page.fill('input[name="trial_period"]', '7');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-form-saved]')).toBeVisible();
    rij = await leesRij('plans', id, 'title,amount_cents,billing_period,visibility,trial_days,source,stripe_price_id');
    expect(rij).toMatchObject({ amount_cents: 650, billing_period: 'monthly', visibility: 'public', trial_days: 7 });
    // in de lijst zichtbaar met de nieuwe waarden
    await page.goto('/admin/subscriptions');
    const eigenRij = page.locator(`[data-plan-row="${id}"]`);
    await expect(eigenRij).toContainText('Public');
    await expect(eigenRij).toContainText('€6.50');
    await expect(eigenRij).toContainText('Monthly');
    // ongeldige prijs → foutmelding, geen wijziging
    await page.goto(`/admin/subscriptions/${id}/edit`);
    await page.fill('input[name="price"]', 'abc');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-form-error]')).toContainText('Price');
    expect((await leesRij<{ amount_cents: number }>('plans', id, 'amount_cents'))?.amount_cents).toBe(650);

    // verwijderen via ⋯ → Delete
    await page.goto('/admin/subscriptions');
    await eigenRij.locator('summary[aria-label^="More options"]').click();
    await eigenRij.locator('[data-confirm-delete] > summary').click();
    await eigenRij.locator('[data-confirm-delete] form button[type="submit"]').click();
    await page.waitForURL(/\/admin\/subscriptions$/);
    await expect(page.locator(`[data-plan-row="${id}"]`)).toHaveCount(0);
    expect(await leesRij('plans', id, 'id')).toBeNull();

  } finally {
    // opruimen ook bij een crash vóór de UI-delete (koude review AD 2.3 I-2): eigen prefix + eigen id
    restPlanPrefix = await verwijderTestRijenWaar('plans', `title=like.${encodeURIComponent('TEST-AD2-plan%')}`, id || 'geen-id');
    auditWeg = id ? await verwijderTestRijenWaar('admin_audit_log', `entity=eq.plans&entity_id=eq.${id}`, id) : 0;
    console.log(`OPRUIMTELLING AD 2.3: aangemaakt 1 plan; via UI verwijderd (verwacht 1); finally: plannen op prefix verwijderd ${restPlanPrefix} (verwacht 0), audit-rijen verwijderd ${auditWeg} (verwacht 3)`);
  }
  // tellingen buiten de finally, zodat een crash in de flow zijn eigen foutmelding houdt
  expect(restPlanPrefix).toBe(0);
  expect(auditWeg).toBe(3);
  const restTitels = await fetchAll(`plans?select=id&title=like.${encodeURIComponent('TEST-AD2-plan%')}`);
  const restAudit = id ? await fetchAll(`admin_audit_log?select=id&entity=eq.plans&entity_id=eq.${id}`) : [];
  expect(restTitels.length).toBe(0);
  expect(restAudit.length).toBe(0);
});
