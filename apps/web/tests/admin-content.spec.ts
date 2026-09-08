import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './lib/admin-global-setup';
import { fetchAll, leesRij, maakTestRij, registreerTestId, verwijderTestRijen } from './lib/supabase-rest';

/**
 * AD 1 stap 3 — Content › Collections, Categories, Resources, Custom Filters, Authors (norm AD0-inventaris §2.1).
 * Tellingen == REST (gepagineerd); bewerken alleen op TEST-AD1-records die de test zelf aanmaakt en opruimt (founder (d)).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SHOT = (n: string) => path.join(REPO, 'var/admin-referentie/ad1/stap-3', `${n}__1440.png`);
test.use({ storageState: ADMIN_STATE, viewport: { width: 1440, height: 900 } });

test('AD 1.3: tellingen — collecties 686, categorieën 25 in positie-volgorde, filters 2/14, resources, authors leeg', async ({ page }) => {
  test.setTimeout(180_000);
  const [collecties, categorieen, filters, waarden, metResources] = await Promise.all([
    fetchAll<{ id: string }>('collections?select=id'),
    fetchAll<{ id: string; name: string }>('categories?select=id,name,position&order=position.asc.nullslast,name.asc'),
    fetchAll<{ id: string }>('filters?select=id'),
    fetchAll<{ id: string }>('filter_values?select=id'),
    fetchAll<{ resources: unknown[] }>('videos?select=resources&resources=neq.%5B%5D'),
  ]);
  await page.goto('/admin/collections');
  await expect(page.locator('[data-collections-table] thead')).toContainText(`${collecties.length.toLocaleString('en-US')} collections`);
  await expect(page.locator('[data-collections-table] tbody tr')).toHaveCount(12);
  await expect(page.locator('[data-pagination]')).toContainText(`Showing 1–12 of ${collecties.length.toLocaleString('en-US')} collections`);
  await expect(page.locator('[data-collections-table] thead')).toContainText('Status');
  await expect(page.locator('[data-collections-table] thead')).toContainText('Created');
  await page.screenshot({ path: SHOT('admin-collections-lijst') });
  // statusfilter over ALLE collecties: Published-telling == REST-afleiding (≥ 1 published/live aflevering)
  const pubItems = await fetchAll<{ collection_id: string }>('collection_items?select=collection_id,videos!inner(status)&videos.status=in.(published,live)');
  const pubIds = new Set(pubItems.map((r) => r.collection_id));
  await page.goto('/admin/collections?status=published');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${pubIds.size.toLocaleString('en-US')} collections`);
  await page.goto('/admin/collections?status=draft');
  await expect(page.locator('[data-pagination]')).toContainText(`of ${(collecties.length - pubIds.size).toLocaleString('en-US')} collections`);
  for (const b of await page.locator('[data-collections-table] tbody .ad-badge').allTextContents()) expect(b).toBe('Unpublished');

  await page.goto('/admin/categories');
  await expect(page.locator('main')).toContainText(`${categorieen.length} categories`);
  const namen = await page.locator('[data-category-row] a').allTextContents();
  expect(namen).toEqual(categorieen.map((c) => c.name));
  await expect(page.locator('[data-save-order]')).toBeDisabled(); // niets versleept → niets te bewaren
  await page.screenshot({ path: SHOT('admin-categories-lijst') });

  await page.goto('/admin/custom-filters');
  await expect(page.locator('main')).toContainText(`${filters.length} filters, ${waarden.length} options`);
  await expect(page.locator('[data-filter="type"] [data-filter-values] li')).toHaveCount(4);
  await expect(page.locator('[data-filter="subject"] [data-filter-values] li')).toHaveCount(10);
  await expect(page.locator('[data-filter="type"]')).toContainText('Series - مسلسلات');
  await page.screenshot({ path: SHOT('admin-custom-filters') });

  await page.goto('/admin/resources');
  const aantal = metResources.reduce((n, v) => n + (v.resources?.length ?? 0), 0);
  await expect(page.locator('[data-resources-table] thead')).toContainText(`${aantal.toLocaleString('en-US')} resources`);
  await expect(page.getByRole('button', { name: 'Upload resources' })).toBeDisabled();
  await page.screenshot({ path: SHOT('admin-resources') });

  await page.goto('/admin/authors');
  await expect(page.locator('main')).toContainText('No authors yet');
  await expect(page.getByRole('button', { name: 'New author' })).toBeDisabled();
});

test('AD 1.3: TEST-AD1-collectie — aanmaken, 2 video\'s toevoegen, volgorde wijzigen, verwijderen, bewerken, filter op video, opruimen', async ({ page }) => {
  test.setTimeout(300_000);
  const ts = Date.now();
  let aangemaakt = 0, verwijderd = 0, collectionId = '';
  const videos: { id: string }[] = [];
  try {
    videos.push(await maakTestRij<{ id: string }>('videos', { external_id: `test-ad1-a-${ts}`, source: 'test-ad1', title: `TEST-AD1-video A ${ts}`, slug: `test-ad1-a-${ts}`, status: 'draft' }));
    videos.push(await maakTestRij<{ id: string }>('videos', { external_id: `test-ad1-b-${ts}`, source: 'test-ad1', title: `TEST-AD1-video B ${ts}`, slug: `test-ad1-b-${ts}`, status: 'published' }));
    aangemaakt = 2;
    const [v1, v2] = videos;
    // aanmaken via het formulier (geen directe aanmaak zoals Uscreen, B83)
    await page.goto('/admin/collections/new');
    await page.fill('#title', `TEST-AD1-collectie ${ts}`);
    await page.getByRole('button', { name: 'Create collection' }).click();
    await page.waitForURL(/\/admin\/collections\/[0-9a-f-]{36}$/);
    collectionId = page.url().split('/').pop()!;
    await registreerTestId('collections', collectionId); // UI-aangemaakt → opruimbaar op id, ook de audit-rijen (koude review I-1)
    aangemaakt += 1;
    await expect(page.locator('[data-collection-detail]')).toContainText('No items yet');
    // 2 video's toevoegen via de zoeker
    for (const t of [`TEST-AD1-video A ${ts}`, `TEST-AD1-video B ${ts}`]) {
      await page.goto(`/admin/collections/${collectionId}?add=${encodeURIComponent(t)}`);
      await page.locator('[data-add-results] button', { hasText: '+ Add video' }).first().click();
      await expect(page.locator('[data-add-results]')).toContainText('In playlist');
    }
    await page.goto(`/admin/collections/${collectionId}`);
    await expect(page.locator('[data-sortable] [data-sortable-item]')).toHaveCount(2);
    let posities = await fetchAll<{ video_id: string; position: number }>(`collection_items?select=video_id,position&collection_id=eq.${collectionId}&order=position.asc`);
    expect(posities.map((p) => p.video_id)).toEqual([v1.id, v2.id]);
    await page.screenshot({ path: SHOT('admin-collection-detail'), fullPage: true });
    // volgorde: B naar boven (▲ = zelfde handeling als slepen), bewaren → REST
    await page.getByRole('button', { name: 'Move up 2' }).click();
    await expect(page.locator('[data-save-order]')).toBeEnabled();
    await page.locator('[data-save-order]').click();
    await expect(page.locator('[data-save-order]')).toBeDisabled();
    posities = await fetchAll(`collection_items?select=video_id,position&collection_id=eq.${collectionId}&order=position.asc`);
    expect(posities.map((p) => `${p.video_id}:${p.position}`)).toEqual([`${v2.id}:1`, `${v1.id}:2`]);
    // afgeleide status: B is Published → collectie Published (lijst + detail)
    await page.goto(`/admin/collections?q=${encodeURIComponent(`TEST-AD1-collectie ${ts}`)}`);
    await expect(page.locator(`[data-collection-row="${collectionId}"] .ad-badge`)).toHaveText('Published');
    // video A verwijderen uit de playlist
    await page.goto(`/admin/collections/${collectionId}`);
    await page.getByRole('button', { name: `Remove TEST-AD1-video A ${ts}` }).click();
    await expect(page.locator('[data-sortable] [data-sortable-item]')).toHaveCount(1);
    expect((await fetchAll(`collection_items?select=id&collection_id=eq.${collectionId}`)).length).toBe(1);
    // bewerken: titel, categorie, cover-URL
    const catNaam = (await page.locator('[data-collection-form] [data-categories] label').first().textContent())!.trim();
    await page.fill('[data-collection-form] #title', `TEST-AD1-collectie ${ts} bewerkt`);
    await page.locator('[data-collection-form] [data-categories] label').first().locator('input').check();
    await page.fill('[data-collection-form] #cover_url', 'https://example.invalid/test-ad1-cover.jpg');
    await page.locator('[data-collection-form] button[type="submit"]', { hasText: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    const na = await leesRij<{ title: string; raw: { cover_url: string } }>('collections', collectionId, 'title,raw');
    expect(na).toMatchObject({ title: `TEST-AD1-collectie ${ts} bewerkt`, raw: { cover_url: 'https://example.invalid/test-ad1-cover.jpg' } });
    const cats = await fetchAll<{ categories: { name: string } }>(`category_items?select=categories(name)&collection_id=eq.${collectionId}`);
    expect(cats.map((c) => c.categories.name)).toEqual([catNaam]);
    // custom filter op video B (Type = eerste optie) → REST → terugzetten
    await page.goto(`/admin/videos/${v2.id}`);
    const typeSelect = page.locator('[data-filters] select[aria-label="Type"]');
    await typeSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    expect((await fetchAll(`video_filter_values?select=filter_value_id&video_id=eq.${v2.id}`)).length).toBe(1);
    await page.reload();
    await page.locator('[data-filters] select[aria-label="Type"]').selectOption('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    expect((await fetchAll(`video_filter_values?select=filter_value_id&video_id=eq.${v2.id}`)).length).toBe(0);
    // verwijderen via ⋯ → Delete collection (bevestiging)
    await page.goto(`/admin/collections/${collectionId}`);
    await page.locator('[data-card="Danger"] [data-confirm-delete] summary').click();
    await page.locator('[data-card="Danger"] [data-confirm-delete] form button').click();
    await page.waitForURL('**/admin/collections');
    expect((await fetchAll(`collections?select=id&id=eq.${collectionId}`)).length).toBe(0);
    verwijderd += 1; // collectie via de UI verwijderd (cascade: collection_items + category_items)
  } finally {
    // D-3 (Codex 2026-09-07): de id werd pas ná waitForURL vastgelegd; schreef de create wél maar bleef de redirect uit,
    // dan ruimde deze finally niets op. De titel draagt de eigen ts → REST-lookup op dat unieke prefix vóór het opruimen.
    if (!collectionId) {
      for (const r of await fetchAll<{ id: string }>(`collections?select=id&title=like.${encodeURIComponent(`TEST-AD1-collectie ${ts}*`)}`)) {
        await registreerTestId('collections', r.id);
        collectionId = r.id;
      }
    }
    if (collectionId && (await fetchAll(`collections?select=id&id=eq.${collectionId}`)).length) {
      verwijderd += await verwijderTestRijen('collections', 'id', collectionId); // fail-closed opruiming als de UI-verwijdering niet plaatsvond
    }
    for (const v of videos) {
      verwijderd += await verwijderTestRijen('video_filter_values', 'video_id', v.id);
      verwijderd += await verwijderTestRijen('category_items', 'video_id', v.id);
      verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', v.id);
      verwijderd += await verwijderTestRijen('videos', 'id', v.id);
    }
    if (collectionId) verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', collectionId); // alle collectie-audits (create/update/reorder/add/remove/categories/delete)
    const restAudit = collectionId ? (await fetchAll(`admin_audit_log?select=id&entity_id=eq.${collectionId}`)).length : 0;
    const restRecords = (collectionId ? (await fetchAll(`collections?select=id&id=eq.${collectionId}`)).length : 0) + (videos.length ? (await fetchAll(`videos?select=id&or=(${videos.map((v) => `id.eq.${v.id}`).join(',')})`)).length : 0);
    console.log(`OPRUIMTELLING AD 1.3 collectie: aangemaakt ${aangemaakt} (2 video's + 1 collectie); verwijderd ${verwijderd} rijen incl. afgeleide; rest (eigen ids): ${restRecords}; audit-rest ${restAudit}`);
    expect(restAudit).toBe(0);
  }
  expect((await fetchAll(`collections?select=id&id=eq.${collectionId}`)).length).toBe(0); // eigen id (parallelle specs)
});

test('AD 1.3: TEST-AD1-categorie — aanmaken, content toevoegen bovenaan, sortering, volgorde, verwijderen, opruimen', async ({ page }) => {
  test.setTimeout(300_000);
  const ts = Date.now();
  let aangemaakt = 0, verwijderd = 0, categoryId = '';
  const videos: { id: string }[] = [];
  const aantalVoor = (await fetchAll('categories?select=id')).length;
  try {
    videos.push(await maakTestRij<{ id: string }>('videos', { external_id: `test-ad1-c-${ts}`, source: 'test-ad1', title: `TEST-AD1-video C ${ts}`, slug: `test-ad1-c-${ts}`, status: 'draft' }));
    videos.push(await maakTestRij<{ id: string }>('videos', { external_id: `test-ad1-d-${ts}`, source: 'test-ad1', title: `TEST-AD1-video D ${ts}`, slug: `test-ad1-d-${ts}`, status: 'draft' }));
    aangemaakt = 2;
    const [v1, v2] = videos;
    await page.goto('/admin/categories/new');
    await page.fill('#name', `TEST-AD1-categorie ${ts}`);
    await page.getByRole('button', { name: 'Create category' }).click();
    await page.waitForURL(/\/admin\/categories\/[0-9a-f-]{36}$/);
    categoryId = page.url().split('/').pop()!;
    await registreerTestId('categories', categoryId, 'name');
    aangemaakt += 1;
    const cat = await leesRij<{ position: number; content_sort: string }>('categories', categoryId, 'position,content_sort');
    expect(cat).toMatchObject({ position: aantalVoor + 1, content_sort: 'manual' }); // achteraan in de site-nav, zoals Uscreen (positie 26 bij 25)
    await expect(page.locator('[data-card="Manage content"]')).toContainText('No content found');
    // content toevoegen: C, dan D → D komt bovenaan (Uscreen: "added to the top")
    for (const t of [`TEST-AD1-video C ${ts}`, `TEST-AD1-video D ${ts}`]) {
      await page.goto(`/admin/categories/${categoryId}?add=${encodeURIComponent(t)}`);
      await page.locator('[data-add-results] button', { hasText: '+ Add' }).first().click();
      await expect(page.locator('[data-add-results]')).toContainText('In category');
    }
    await page.goto(`/admin/categories/${categoryId}`);
    let items = await fetchAll<{ video_id: string; position: number }>(`category_items?select=video_id,position&category_id=eq.${categoryId}&order=position.asc`);
    expect(items.map((i) => i.video_id)).toEqual([v2.id, v1.id]);
    await page.screenshot({ path: SHOT('admin-category-edit'), fullPage: true });
    // volgorde: C naar boven, bewaren → REST 1..n
    await page.getByRole('button', { name: 'Move up 2' }).click();
    await page.locator('[data-save-order]').click();
    await expect(page.locator('[data-save-order]')).toBeDisabled();
    items = await fetchAll(`category_items?select=video_id,position&category_id=eq.${categoryId}&order=position.asc`);
    expect(items.map((i) => `${i.video_id}:${i.position}`)).toEqual([`${v1.id}:1`, `${v2.id}:2`]);
    // sortering + titel bewerken
    await page.fill('[data-category-form] #name', `TEST-AD1-categorie ${ts} bewerkt`);
    await page.locator('[data-category-form] #content_sort').selectOption('newest');
    await page.locator('[data-category-form] button[type="submit"]', { hasText: 'Save changes' }).click();
    await expect(page.locator('[data-form-saved]')).toHaveText('Changes saved');
    expect(await leesRij('categories', categoryId, 'name,content_sort')).toMatchObject({ name: `TEST-AD1-categorie ${ts} bewerkt`, content_sort: 'newest' });
    // item verwijderen
    await page.getByRole('button', { name: `Remove TEST-AD1-video D ${ts}` }).click();
    await expect(page.locator('[data-sortable] [data-sortable-item]')).toHaveCount(1);
    // categorie verwijderen via de bevestiging → lijst; REST weg, telling terug
    await page.locator('[data-card="Danger"] [data-confirm-delete] summary').click();
    await page.locator('[data-card="Danger"] [data-confirm-delete] form button').click();
    await page.waitForURL('**/admin/categories');
    expect((await fetchAll(`categories?select=id&id=eq.${categoryId}`)).length).toBe(0);
    expect((await fetchAll('categories?select=id')).length).toBe(aantalVoor);
    verwijderd += 1;
  } finally {
    if (!categoryId) { // D-3: zelfde opvang als bij de collectie — eigen rij op de unieke ts-naam
      for (const r of await fetchAll<{ id: string }>(`categories?select=id&name=like.${encodeURIComponent(`TEST-AD1-categorie ${ts}*`)}`)) {
        await registreerTestId('categories', r.id, 'name');
        categoryId = r.id;
      }
    }
    if (categoryId && (await fetchAll(`categories?select=id&id=eq.${categoryId}`)).length) {
      verwijderd += await verwijderTestRijen('categories', 'id', categoryId);
    }
    for (const v of videos) {
      verwijderd += await verwijderTestRijen('category_items', 'video_id', v.id);
      verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', v.id);
      verwijderd += await verwijderTestRijen('videos', 'id', v.id);
    }
    if (categoryId) verwijderd += await verwijderTestRijen('admin_audit_log', 'entity_id', categoryId);
    const restAudit = categoryId ? (await fetchAll(`admin_audit_log?select=id&entity_id=eq.${categoryId}`)).length : 0;
    const restRecords = (categoryId ? (await fetchAll(`categories?select=id&id=eq.${categoryId}`)).length : 0) + (videos.length ? (await fetchAll(`videos?select=id&or=(${videos.map((v) => `id.eq.${v.id}`).join(',')})`)).length : 0);
    console.log(`OPRUIMTELLING AD 1.3 categorie: aangemaakt ${aangemaakt} (2 video's + 1 categorie); verwijderd ${verwijderd} rijen incl. afgeleide; rest (eigen ids): ${restRecords}; audit-rest ${restAudit}`);
    expect(restAudit).toBe(0);
  }
  expect((await fetchAll(`categories?select=id&id=eq.${categoryId}`)).length).toBe(0); // eigen id (parallelle specs)
});
