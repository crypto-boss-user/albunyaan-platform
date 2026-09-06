import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, leesRij, maakTestRij, verwijderTestRijen, verwijderTestRijenWaar } from './lib/supabase-rest';

/**
 * AD 1 stap 2 — Content › Videos in de Uscreen-vorm (norm AD0-inventaris §2.1). Telling == REST-telling (gepagineerd per 1000);
 * bewerken alleen op een TEST-AD1-video die de test zelf aanmaakt en opruimt (founder (d)); opruimtelling in de uitvoer.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } }); // aal2-adminsessie uit de global setup

test('AD 1.2: lijst — telling == REST, kolommen/zoeken/filter/sortering/paginering zoals gemeten', async ({ page }) => {
  test.setTimeout(180_000);
  const alle = await fetchAll<{ id: string; status: string }>('videos?select=id,status');
  const res = await page.goto('/admin/videos');
  expect(res?.status()).toBe(200);
  await expect(page.locator('main h1')).toHaveText('Videos');
  await expect(page.locator('[data-videos-table] thead th', { hasText: /videos$/ })).toHaveText(`${alle.length.toLocaleString('en-US')} videos`);
  await expect(page.locator('[data-pagination]')).toContainText(`Showing 1–30 of ${alle.length.toLocaleString('en-US')} videos`);
  await expect(page.locator('[data-videos-table] tbody tr')).toHaveCount(30);
  await expect(page.locator('[data-videos-table] thead')).toContainText('Status');
  await expect(page.locator('[data-videos-table] thead')).toContainText('Age');
  await expect(page.locator('[data-videos-table] thead')).toContainText('Uploaded on');
  // Upload-knop aanwezig maar uitgeschakeld met reden (founder: na kijkplatformkeuze)
  await expect(page.getByRole('button', { name: 'Upload videos' })).toBeDisabled();
  await expect(page.locator('main')).toContainText('na kijkplatformkeuze');
  // statusnamen = Uscreen (Published/Unpublished), nooit "draft"
  const badges = await page.locator('[data-videos-table] tbody .ad-badge').allTextContents();
  for (const b of badges) expect(['Published', 'Unpublished', 'Scheduled', 'Live']).toContain(b);
  await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-2/admin-videos-lijst__1440.png'), fullPage: false });
  // filter Unpublished → telling == REST-telling van draft; alle badges Unpublished
  const drafts = alle.filter((v) => v.status === 'draft').length;
  await page.goto('/admin/videos?status=draft');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${drafts.toLocaleString('en-US')} videos`);
  for (const b of await page.locator('[data-videos-table] tbody .ad-badge').allTextContents()) expect(b).toBe('Unpublished');
  // sortering Title A→Z: titels oplopend; Rows per page 50 → 50 rijen; pagina 2 → "Showing 51–100"
  await page.goto('/admin/videos?sort=title_asc&per=50');
  const titels = await page.locator('[data-videos-table] tbody td:nth-child(3) a').allTextContents();
  expect(titels.length).toBe(50);
  const restVolgorde = (await fetchAll<{ title: string }>('videos?select=title,id&order=title.asc,id.asc&limit=50')).map((r) => r.title); // zelfde collatie als de lijst (koude review M-5)
  expect(titels).toEqual(restVolgorde.slice(0, 50));
  await page.goto('/admin/videos?sort=title_asc&per=50&page=2');
  await expect(page.locator('[data-pagination]')).toContainText('Showing 51–100 of');
  // zoeken
  await page.goto('/admin/videos?q=' + encodeURIComponent('عين جالوت'));
  const zoek = await fetchAll<{ id: string }>('videos?select=id&title=ilike.' + encodeURIComponent('*عين جالوت*'));
  await expect(page.locator('[data-pagination]')).toContainText(`of ${zoek.length.toLocaleString('en-US')} videos`);
});

test('AD 1.2: detail — TEST-AD1-video bewerken (titel, categorie, zichtbaarheid, cover-URL), terugzetten, bulk, opruimen', async ({ page }) => {
  test.setTimeout(240_000);
  const ts = Date.now();
  const v = await maakTestRij<{ id: string; slug: string }>('videos', {
    external_id: `test-ad1-${ts}`, source: 'test-ad1', title: `TEST-AD1-video ${ts}`, slug: `test-ad1-video-${ts}`, status: 'draft', access: 'subscription',
  });
  let aangemaakt = 1, verwijderd = 0;
  try {
      const res = await page.goto(`/admin/videos/${v.id}`);
    expect(res?.status()).toBe(200);
    // gemeten kaarten aanwezig
    for (const k of ['About', 'Thumbnails', 'Organize', 'SEO', 'Video', 'Visibility', 'Access', 'Subscription & Pricing', 'Subtitles and captions', 'Audio track', 'Preview']) {
      await expect(page.locator(`[data-card="${k}"]`)).toHaveCount(1);
    }
    await expect(page.locator('[data-card="Video"] button', { hasText: 'Replace' })).toBeDisabled();
    await expect(page.locator('[data-visibility]')).toContainText('Unpublished');
    await page.screenshot({ path: path.join(REPO, 'var/admin-referentie/ad1/stap-2/admin-video-detail__1440.png'), fullPage: true });
    // 1. bewerken: titel, eerste categorie aan, Published, cover-URL, SEO-titel
    const eersteCategorie = page.locator('[data-categories] label').first();
    const catNaam = (await eersteCategorie.textContent())!.trim();
    await page.fill('#title', `TEST-AD1-video ${ts} bewerkt`);
    await eersteCategorie.locator('input').check();
    await page.locator('[data-visibility] input[value="published"]').check();
    await page.fill('#thumbnail_url', 'https://example.invalid/test-ad1-cover.jpg');
    await page.fill('#seo_title', 'TEST-AD1 seo');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    const na = await leesRij<{ title: string; status: string; thumbnail_url: string; seo: { meta_title: string } }>('videos', v.id, 'title,status,thumbnail_url,seo');
    expect(na).toMatchObject({ title: `TEST-AD1-video ${ts} bewerkt`, status: 'published', thumbnail_url: 'https://example.invalid/test-ad1-cover.jpg', seo: { meta_title: 'TEST-AD1 seo' } });
    const items = await fetchAll<{ category_id: string; position: number; categories: { name: string } }>(`category_items?select=category_id,position,categories(name)&video_id=eq.${v.id}`);
    expect(items.map((i) => i.categories.name)).toEqual([catNaam]);
    // nieuw item staat bovenaan (Uscreen: "added to the top") = kleinste positie in die categorie
    const top = await fetchAll<{ position: number }>(`category_items?select=position&category_id=eq.${items[0].category_id}&order=position.asc&limit=1`);
    expect(items[0].position).toBe(top[0].position);
    // 2. terugzetten
    await page.reload();
    await page.fill('#title', `TEST-AD1-video ${ts}`);
    await page.locator('[data-categories] label').first().locator('input').uncheck();
    await page.locator('[data-visibility] input[value="draft"]').check();
    await page.fill('#thumbnail_url', '');
    await page.fill('#seo_title', '');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    const terug = await leesRij<{ title: string; status: string; thumbnail_url: string | null }>('videos', v.id, 'title,status,thumbnail_url');
    expect(terug).toMatchObject({ title: `TEST-AD1-video ${ts}`, status: 'draft', thumbnail_url: null });
    expect(await fetchAll(`category_items?select=id&video_id=eq.${v.id}`)).toHaveLength(0);
    // 3. bulk op de lijst: alleen de TEST-rij selecteren → Publish → Unpublish
    await page.goto('/admin/videos?q=' + encodeURIComponent(`TEST-AD1-video ${ts}`));
    await expect(page.locator(`[data-video-row="${v.id}"]`)).toHaveCount(1);
    await expect(page.locator('[data-bulk-bar] button', { hasText: /^Publish$/ })).toBeDisabled();
    await page.locator(`[data-video-row="${v.id}"] input[name="ids"]`).check();
    await expect(page.locator('[data-bulk-count]')).toHaveText('1 selected');
    await page.locator('[data-bulk-bar] button', { hasText: /^Publish$/ }).click();
    await expect(page.locator(`[data-video-row="${v.id}"] .ad-badge`)).toHaveText('Published');
    await page.locator(`[data-video-row="${v.id}"] input[name="ids"]`).check();
    await page.locator('[data-bulk-bar] button', { hasText: /^Unpublish$/ }).click();
    await expect(page.locator(`[data-video-row="${v.id}"] .ad-badge`)).toHaveText('Unpublished');
  } finally {
    verwijderd += await verwijderTestRijen('category_items', 'video_id', v.id);
    verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', v.id);
    verwijderd += await verwijderTestRijenWaar('admin_audit_log', `after=cs.${encodeURIComponent(JSON.stringify({ ids: [v.id] }))}`, v.id); // bulk-audits (entity_id "bulk:n", ids in jsonb)
    verwijderd += await verwijderTestRijen('videos', 'id', v.id);
    console.log(`OPRUIMTELLING AD 1.2: aangemaakt ${aangemaakt} video; verwijderd ${verwijderd} rijen (video 1 + afgeleide category_items/audit); rest videos: ${(await fetchAll(`videos?select=id&id=eq.${v.id}`)).length}`);
  }
  expect((await fetchAll(`videos?select=id&title=like.TEST-AD1-*`)).length).toBe(0);
});
