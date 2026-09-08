import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll } from './lib/supabase-rest';

/**
 * AD 2.5 — Analytics als eigen pagina's (geen Omni-iframe). Norm = AD0-inventaris §2.7 (reference/admin-2026-09/ad0b-2026-09-07/text/analytics-*.json,
 * iframe-tekst 2026-09-07); de gecureerde lijst reference/admin-2026-09/analytics-ad2.json wordt hier tegen de ruwe iframe-koppen gecontroleerd.
 * Founder 2026-09-07: geen voorbeeldcijfers — echte tellingen uit de DB, anders lege tegel met reden; periode-filter werkt.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const AD0B = path.join(REPO, 'reference/admin-2026-09/ad0b-2026-09-07/text');
type Bron = { paginas: Record<string, { kop: string; filters: string[]; periode_filter: string; tegels: string[]; tabs: string[]; blokken?: string[]; kolommen?: string[]; users?: string[]; subscription_status?: string[]; activity_status?: string[]; groepen?: { naam: string; kaarten: { naam: string }[] }[] }> };
const bron = JSON.parse(fs.readFileSync(path.join(REPO, 'reference/admin-2026-09/analytics-ad2.json'), 'utf8')) as Bron;
const PAGINAS = ['overview', 'content', 'people', 'sales', 'subscriptions', 'marketing'] as const;

/** Koppen van het Omni-iframe uit de meting (zonder CSS-/tile-ruis). */
function iframeKoppen(p: string): string[] {
  const d = JSON.parse(fs.readFileSync(path.join(AD0B, `analytics-${p}.json`), 'utf8')) as { koppen: { tekst: string }[]; frames: { url: string; koppen: string[]; tekst: string }[] };
  const frame = d.frames.find((f) => f.url.includes('omni.uscreen.tv/dashboards'))!;
  return frame.koppen.filter((k) => !/^#markdown|^Tile options|^CSS Not supported|^Add time frame|^Copy to|^How to copy/.test(k)).map((k) => k.replace(/ ›$/, '').trim());
}

test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 2.5: zes pagina\'s — kop, tegeltitels, tabs en filters == meting; geen VOORBEELD; lege tegels met reden; anoniem 307', async ({ page, playwright, baseURL }) => {
  test.setTimeout(180_000);
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const p of PAGINAS) {
    const b = bron.paginas[p];
    const gemeten = iframeKoppen(p);
    const gemetenPagina = JSON.parse(fs.readFileSync(path.join(AD0B, `analytics-${p}.json`), 'utf8')) as { koppen: { tekst: string }[]; frames: { url: string; tekst: string }[] };
    expect(gemetenPagina.koppen.map((k) => k.tekst), p).toEqual([b.kop]);
    const iframeTekst = gemetenPagina.frames.find((f) => f.url.includes('omni.uscreen.tv/dashboards'))!.tekst;
    // gecureerde tegels/tabs/filters komen letterlijk uit de gemeten iframe-koppen/-tekst
    for (const t of b.tegels) expect(gemeten.some((k) => k.startsWith(t)), `${p}: tegel "${t}" in de meting`).toBe(true);
    for (const t of b.tabs) expect(gemeten, `${p}: tab "${t}"`).toContain(t);
    for (const f of b.filters) expect(iframeTekst, `${p}: filter "${f}"`).toContain(f);
    expect(b.filters, `${p}: periode_filter`).toContain(b.periode_filter);
    for (const x of [...(b.blokken ?? []), ...(b.kolommen ?? []), ...(b.users ?? []), ...(b.subscription_status ?? []), ...(b.activity_status ?? [])]) expect(iframeTekst, `${p}: "${x}" in de meting`).toContain(x);
    for (const g of b.groepen ?? []) { expect(iframeTekst, `${p}: groep ${g.naam}`).toContain(g.naam); for (const k of g.kaarten) expect(gemeten, `${p}: kaart ${k.naam}`).toContain(k.naam); }

    const res = await page.goto(`/admin/analytics/${p}`);
    expect(res?.status(), p).toBe(200);
    await expect(page.locator('h1'), p).toHaveText(b.kop);
    await expect(page.locator('.admin-shell nav[aria-label="Breadcrumb"]'), p).toHaveText(new RegExp(`Analytics.*${b.kop}`));
    if (b.tegels.length) await expect(page.locator('[data-tegel] [data-tegel-titel]'), p).toHaveText(b.tegels.map((t) => `${t} ›`));
    if (b.tabs.length) await expect(page.locator('[data-analytics-tabs] [role="tab"]'), p).toHaveText(b.tabs);
    await expect(page.locator('[data-analytics-filters] [data-filter]'), p).toHaveCount(b.filters.length);
    await expect(page.locator(`[data-analytics-filters] [data-filter="${b.periode_filter}"] select[name="period"]`), `${p}: periode-select onder het gemeten filter`).toHaveCount(1);
    for (const blok of b.blokken ?? []) await expect(page.locator(`[data-blok="${blok}"]`), `${p}: blok ${blok}`).toHaveCount(1);
    // geen voorbeeldcijfers; elke lege tegel draagt een reden
    await expect(page.locator('[data-voorbeeld-label], [data-home-tile]'), p).toHaveCount(0);
    const legeTegels = page.locator('[data-tegel][data-leeg="true"]');
    for (let i = 0; i < (await legeTegels.count()); i++) await expect(legeTegels.nth(i).locator('[data-tegel-reden]'), `${p}: lege tegel ${i}`).not.toHaveText('');
    const anon = await request.get(`/admin/analytics/${p}`, { maxRedirects: 0 });
    expect(anon.status(), `anoniem ${p}`).toBe(307);
    await page.screenshot({ path: path.join(REPO, `var/admin-referentie/ad2/stap-5/admin-analytics-${p}__1440.png`), fullPage: false, mask: [page.locator('[data-admin-sidebar]')] });
  }
  await request.dispose();
});

test('AD 2.5: echte cijfers == REST — People (Total/Members/Leads, statusverdeling), Content-tabs (video\'s/collecties/categorieën), Coupons-redemptions; periode-filter werkt', async ({ page }) => {
  test.setTimeout(120_000);
  const people = await fetchAll<{ status: string | null }>('people?select=status:raw->>Status'); // alleen de status, geen naam/e-mail (B82, koude review M-9)
  const status = (s: string) => people.filter((r) => r.status === s).length;
  const leads = status('lead') + people.filter((r) => !r.status).length;
  const members = people.length - leads;
  await page.goto('/admin/analytics/people');
  await expect(page.locator('[data-users] [data-tegel="Total"] [data-tegel-waarde]')).toHaveText(people.length.toLocaleString('en-US'));
  await expect(page.locator('[data-users] [data-tegel="Members"] [data-tegel-waarde]')).toHaveText(members.toLocaleString('en-US'));
  await expect(page.locator('[data-users] [data-tegel="Leads"] [data-tegel-waarde]')).toHaveText(leads.toLocaleString('en-US'));
  await expect(page.locator('[data-users] [data-tegel="One-time Buyers"]')).toHaveAttribute('data-leeg', 'true');
  const actief = status('active') + status('new') + status('reactivated') + status('pending_cancellation');
  await expect(page.locator('[data-subscription-status] [data-status="Active"]')).toContainText(actief.toLocaleString('en-US'));
  await expect(page.locator('[data-subscription-status] [data-status="Churned"]')).toContainText(status('churned').toLocaleString('en-US'));
  await expect(page.locator('[data-activity-status] [data-status="New"]')).toContainText(status('new').toLocaleString('en-US'));
  await expect(page.locator('[data-subscription-status] li')).toHaveText(bron.paginas.people.subscription_status!.map((s) => new RegExp(s)));

  // Content-tabs: tellingen exact (REST gepagineerd). Sinds D-5 (playwright.config: fase 'lezen' vóór de schrijvende
  // specs) maakt geen parallelle spec meer TEST-AD-video's/-collecties aan — het interval [vóór, ná] van koude review M-8
  // is weg; het keurde een correcte waarde af als een spec tussen de twee REST-lezingen aanmaakte én verwijderde.
  const videos = await fetchAll<{ status: string }>('videos?select=status');
  const collecties = await fetchAll<{ id: string }>('collections?select=id');
  await page.goto('/admin/analytics/content?tab=Videos');
  await expect(page.locator('[data-content-tellingen="Videos"] [data-tegel="Videos in catalog"] [data-tegel-waarde]')).toHaveText(videos.length.toLocaleString('en-US'));
  await expect(page.locator('[data-content-tellingen="Videos"] [data-tegel="Published"] [data-tegel-waarde]')).toHaveText(videos.filter((v) => v.status === 'published').length.toLocaleString('en-US'));
  await page.goto('/admin/analytics/content?tab=Collections');
  await expect(page.locator('[data-content-tellingen="Collections"] [data-tegel="Collections"] [data-tegel-waarde]')).toHaveText(collecties.length.toLocaleString('en-US'));
  await expect(page.locator('[data-analytics-tabs] [aria-selected="true"]')).toHaveText('Collections');

  // Coupons-kaart == voucher_redemptions
  const redemptions = await fetchAll<{ id: string }>('voucher_redemptions?select=id');
  await page.goto('/admin/analytics/marketing');
  await expect(page.locator('[data-marketing-kaart="Coupons"] [data-tegel-waarde]')).toHaveText(redemptions.length.toLocaleString('en-US'));
  await expect(page.locator('[data-marketing-kaart="Email Broadcasts"]')).toHaveAttribute('data-leeg', 'true');

  // periode-filter: sign-ups in 7 dagen vs 12 maanden == REST
  const tel = async (dagen: number) => (await fetchAll<{ id: string }>(`people?select=id&signup_at=gte.${encodeURIComponent(new Date(Date.now() - dagen * 86_400_000).toISOString())}`)).length;
  const [d7, d365] = [await tel(7), await tel(365)];
  await page.goto('/admin/analytics/overview?period=7d');
  await expect(page.locator('[data-periode-bereik]')).toBeVisible();
  await expect(page.locator('[data-tegel="Net Growth"]')).toContainText(`New (sign-ups): ${d7}`);
  await page.selectOption('[data-analytics-filters] select[name="period"]', '12m');
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page).toHaveURL(/period=12m/);
  await expect(page.locator('[data-tegel="Net Growth"]')).toContainText(`New (sign-ups): ${d365}`);
});
