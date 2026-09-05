import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * SR 4 stap 8 — statische pagina's 1:1 (SR 2a page-*__1440__en; §5.16 titels; §5.13 coupon publiek; §5.7 contact):
 * per pagina: title == US, koppen (h1–h4) == US, whitespace-genormaliseerde tekst van `main` (minus [data-us-exclude]) ==
 * de US-tekst in tests/fixtures/us-tekst/<pagina>.txt (gegenereerd uit de SR 2a-HTML met tests/fixtures/us-tekst/genereer.py);
 * /coupon anoniem 200. Contact: alleen title + 200 (storefront = iframe zonder tekst/koppen; eigen formulier blijft, §5.7).
 */
const PAGINAS: { url: string; fixture: string; title: string; koppen: string[] }[] = [
  { url: '/about-us', fixture: 'about-us', title: 'Albunyaan', koppen: ['H3: About us'] },
  { url: '/dawah', fixture: 'dawah', title: 'Dawah', koppen: ['H3: Dawah projects', 'H3: Stichting Al-Istiqaamah', 'H3: Tarbiyah Consultancy'] },
  { url: '/download-app', fixture: 'downloads', title: 'Download Albunyaan TV', koppen: ['H3: جميع روابط منصة البنيان'] },
  { url: '/qa', fixture: 'qa', title: 'Q&A', koppen: ['H2: Frequently Asked Questions', 'H2: Who are we?'] },
  { url: '/coupon', fixture: 'coupon', title: 'Albunyaan', koppen: ['H3: Coupon كوبونات', 'H3: شرح كيفية تفعيل الكوبون How to activate the coupon'] },
];

/** Zelfde normalisatie als genereer.py: blok-tags = woordgrens, inline-tags niet; whitespace → één spatie (review I-4). */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const BLOK = 'p,div,li,ul,ol,h1,h2,h3,h4,h5,h6,br,section,figure,details,summary,button,label,form,article,header,footer,nav,tr,td,th,blockquote';

for (const p of PAGINAS) {
  test(`stap 8: ${p.url} — title, koppen en tekst == storefront`, async ({ page }) => {
    const res = await page.goto(p.url);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(p.title);
    const koppen = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((els) => els.map((el) => `${el.tagName}: ${el.textContent?.replace(/\s+/g, ' ').trim()}`));
    expect(koppen).toEqual(p.koppen);
    const tekst = await page.locator('main').evaluate((main, blok) => {
      const clone = main.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-us-exclude]').forEach((el) => el.remove());
      // textContent (ook dichte <details>), met een regeleinde rond elk blokelement — inline-grenzen blijven strak
      clone.querySelectorAll(blok).forEach((el) => {
        el.prepend(document.createTextNode('\n'));
        el.append(document.createTextNode('\n'));
      });
      return clone.textContent ?? '';
    }, BLOK);
    const verwacht = fs.readFileSync(path.join(__dirname, 'fixtures', 'us-tekst', `${p.fixture}.txt`), 'utf8');
    expect(norm(tekst)).toBe(norm(verwacht));
  });
}

test('stap 8: /contact anoniem 200 met de storefront-titel; /coupon anoniem 200 zonder login-redirect', async ({ page }) => {
  const contact = await page.goto('/contact');
  expect(contact?.status()).toBe(200);
  await expect(page).toHaveTitle('Contact');
  await expect(page.locator('main form')).toHaveCount(1);
  const coupon = await page.goto('/coupon');
  expect(coupon?.status()).toBe(200);
  await expect(page).toHaveURL(/\/coupon$/);
  await expect(page.locator('main [data-us-exclude] form')).toHaveCount(1);
});
