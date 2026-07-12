// Capture PUBLISHED STATUS per collection from the Uscreen admin Collections list.
// WS1 needs this: the "published unit" on Uscreen is the collection, and no prior
// scrape captured its status. Polite: sequential pages, ~1.2s delay, one tab.
// Output: ~/.albunyaan-cc/uscreen-collection-status.jsonl  {id,title,status,videosCount,page}
// Resumable by page (rewrites whole file per run — it's only ~60 pages, simpler than resume).
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';

const CC = os.homedir() + '/.albunyaan-cc';
const OUT = CC + '/uscreen-collection-status.jsonl';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

const rowsAll = [];
await page.goto('https://app.uscreen.tv/manage/contents/collections?page=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const lastPage = await page.evaluate(() =>
  Math.max(1, ...[...document.querySelectorAll('a[href*="collections?page="]')]
    .map(a => parseInt((a.getAttribute('href').match(/page=(\d+)/) || [])[1]) || 1)));
console.log('pages:', lastPage);

for (let p = 1; p <= lastPage; p++) {
  if (p > 1) {
    await page.goto('https://app.uscreen.tv/manage/contents/collections?page=' + p, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  // each row: link to /collections/<id>/details + row text contains status word
  const rows = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/collections/"][href*="/details"]').forEach(a => {
      const m = a.getAttribute('href').match(/collections\/(\d+)\/details/);
      const title = (a.textContent || '').trim();
      if (!m || !title || seen.has(m[1])) return;
      seen.add(m[1]);
      // climb to the row element and read its full text for status
      let el = a; for (let i = 0; i < 6 && el && el.tagName !== 'TR'; i++) el = el.parentElement;
      const rowText = el ? el.innerText : '';
      const status = /unpublished/i.test(rowText) ? 'unpublished'
        : /published/i.test(rowText) ? 'published'
        : /draft/i.test(rowText) ? 'draft' : 'unknown';
      const count = (rowText.match(/(\d+)\s*(videos?|items?)/i) || [])[1] || null;
      out.push({ id: m[1], title, status, videosCount: count ? Number(count) : null });
    });
    return out;
  });
  rows.forEach(r => rowsAll.push({ ...r, page: p }));
  console.log(`page ${p}/${lastPage}: +${rows.length} (total ${rowsAll.length})`);
  await page.waitForTimeout(1200);
}

fs.writeFileSync(OUT, rowsAll.map(r => JSON.stringify(r)).join('\n') + '\n');
const counts = {};
rowsAll.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
console.log('DONE', rowsAll.length, 'collections →', OUT, JSON.stringify(counts));
await page.close();
process.exit(0);
