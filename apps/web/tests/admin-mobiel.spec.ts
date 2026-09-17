import { expect, test } from '@playwright/test';

/**
 * De admin moet op een telefoon bruikbaar zijn, niet alleen op een breed scherm (founder 17-09).
 * Tot dan had admin.css NUL media queries: vast zijmenu van 272 px, 48 px padding en tabellen
 * breder dan het scherm.
 *
 * Deze test meet het enige dat telt en met het oog makkelijk te missen is: kun je de pagina
 * horizontaal wegschuiven? Zo ja, dan valt inhoud buiten beeld. Een screenshot laat dat niet
 * betrouwbaar zien, een meting wel.
 *
 * Draait tegen een server met ALBUNYAAN_DEMO=1 (geen login nodig). BASE_URL wijst ernaar.
 */
const TELEFOON = { width: 390, height: 844 };   // iPhone 14/15
const KLEIN = { width: 320, height: 720 };      // smalste toestel dat nog telt

const PAGINAS = [
  '/admin',
  '/admin/videos',
  '/admin/people',
  '/admin/collections',
  '/admin/subscriptions',
  '/admin/settings',
  '/admin/analytics/people',
];

test.describe('admin op een telefoon', () => {
  test.use({ viewport: TELEFOON });

  for (const pad of PAGINAS) {
    test(`${pad} past binnen het scherm`, async ({ page }) => {
      await page.goto(pad, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-admin-root]')).toBeVisible();

      const breedte = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        zicht: document.documentElement.clientWidth,
      }));
      // 1 px speling voor afrondingen bij subpixel-randen.
      expect(breedte.scroll, `${pad} schuift horizontaal weg`).toBeLessThanOrEqual(breedte.zicht + 1);
    });
  }

  test('het zijmenu ligt dicht en gaat open met de knop', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const zijmenu = page.locator('[data-admin-sidebar]');
    const root = page.locator('[data-admin-root]');

    // Dicht: buiten beeld geschoven, dus de linkerrand ligt links van 0.
    await expect(root).toHaveAttribute('data-mobiel', 'dicht');
    const dicht = await zijmenu.boundingBox();
    expect(dicht!.x, 'zijmenu hoort buiten beeld te liggen').toBeLessThan(0);

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(root).toHaveAttribute('data-mobiel', 'open');
    await expect
      .poll(async () => (await zijmenu.boundingBox())!.x, { timeout: 3000 })
      .toBeGreaterThanOrEqual(0);

    // En de inhoud schuift NIET op: de lade ligt eroverheen.
    const body = await page.locator('[data-admin-body]').boundingBox();
    expect(body!.x).toBe(0);
  });

  test('een gesloten zijmenu vangt geen toetsenbordfocus', async ({ page }) => {
    // Cubic 17-09: alleen wegschuiven met transform houdt de links in de tabvolgorde, dus een
    // toetsenbordgebruiker belandde in een menu dat hij niet ziet. Nu ook `visibility: hidden`.
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    let inMenu = 0;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => !!document.activeElement?.closest('[data-admin-sidebar]'))) inMenu++;
    }
    expect(inMenu, 'focus hoort nooit in het gesloten menu te belanden').toBe(0);

    // En na openen moet het menu juist wél bereikbaar zijn.
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(page.locator('[data-admin-sidebar]')).toBeVisible();
    await expect(page.locator('[data-admin-sidebar] a').first()).toBeVisible();
  });

  test('een tabel schuift zelf, de pagina niet', async ({ page }) => {
    await page.goto('/admin/videos', { waitUntil: 'domcontentloaded' });
    const tabel = page.locator('table.ad-table').first();
    await expect(tabel).toBeVisible();
    const kan = await tabel.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(kan, 'de tabel hoort zelf horizontaal scrollbaar te zijn').toBe(true);
  });

  test('ook op 320 px blijft alles binnen beeld', async ({ page }) => {
    await page.setViewportSize(KLEIN);
    await page.goto('/admin/videos', { waitUntil: 'domcontentloaded' });
    const b = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      zicht: document.documentElement.clientWidth,
    }));
    expect(b.scroll).toBeLessThanOrEqual(b.zicht + 1);
  });
});
