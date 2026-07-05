import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://albunyaan.tv/catalog', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(5000);
for (let i=0;i<10;i++){ await page.evaluate(()=>window.scrollBy(0,1400)); await page.waitForTimeout(800); }
// grab EVERY link that points to a program/series, with its heading title (aria/alt) and image
const cards = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('a[href*="/programs/"], a[href*="/catalog/"]').forEach(a => {
    const img = a.querySelector('img');
    const src = img?.currentSrc || img?.src || '';
    const alt = img?.getAttribute('alt') || '';
    // title often in a sibling/child heading
    const t = a.querySelector('h1,h2,h3,h4,[class*="title"]')?.textContent?.trim() || alt || a.getAttribute('aria-label') || '';
    if (src) out.push({href:a.getAttribute('href'), title:(t||'').slice(0,45), img:src});
  });
  return out;
});
// filter to series (has an alt/title that isn't 'Live'), dedupe
const series = [...new Map(cards.filter(c=>c.img.includes('uscreencdn')).map(c=>[c.href,c])).values()];
console.log('total cards:', series.length);
console.log('\n=== sample series cards (real site) — title | image path ===');
series.filter(c=>c.title && !/^live$/i.test(c.title)).slice(0,15).forEach(c=>{
  const path = c.img.replace(/^https:\/\/[^/]+\//,'').slice(0,55);
  console.log(`  ${c.title.padEnd(30)} | ${path}`);
});
await page.close();
process.exit(0);
