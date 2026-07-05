import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://albunyaan.tv/catalog', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(5000);
// scroll to force lazy images to load
for (let i=0;i<6;i++){ await page.evaluate(()=>window.scrollBy(0,1200)); await page.waitForTimeout(900); }
// map each series card: link (slug) -> image
const cards = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href')||'';
    if (!/\/programs\/|\/catalog\/|\/categories\//.test(href)) return;
    const img = a.querySelector('img');
    const src = img?.src || img?.getAttribute('data-src') || '';
    const title = (a.textContent||'').trim().slice(0,50);
    if (src && /uscreencdn/.test(src)) out.push({href, title, img: src});
  });
  return out;
});
const uniq = [...new Map(cards.map(c=>[c.href,c])).values()];
console.log('series cards with covers:', uniq.length);
uniq.slice(0,14).forEach(c=>console.log(`  ${c.title.slice(0,28).padEnd(28)} | ${c.img.slice(0,75)}`));
// what image-path patterns appear?
const pats = {};
uniq.forEach(c=>{ const m=c.img.match(/uscreencdn\.com\/([a-z_%0-9]+)/i); const k=m?m[1].slice(0,25):'?'; pats[k]=(pats[k]||0)+1; });
console.log('\nimage path patterns:', JSON.stringify(pats));
await page.close();
process.exit(0);
