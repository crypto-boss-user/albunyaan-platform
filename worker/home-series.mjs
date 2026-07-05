import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://albunyaan.tv/', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(6000);
for (let i=0;i<8;i++){ await page.evaluate(()=>window.scrollBy(0,1200)); await page.waitForTimeout(700); }
const cards = await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('a[href*="/programs/"]').forEach(a=>{
    const href=a.getAttribute('href'); const img=a.querySelector('img');
    const src=img?.currentSrc||img?.src||''; const alt=img?.getAttribute('alt')||a.textContent.trim().slice(0,40);
    if(href&&src&&src.includes('uscreencdn')) out.push({slug:href.replace(/.*\/programs\//,'').replace(/[/?].*/,''), alt, imgId:(src.match(/programs\/(\d+)/)||[])[1], full:src.slice(0,80)});
  });
  return out;
});
const uniq=[...new Map(cards.map(c=>[c.slug,c])).values()].filter(c=>!/live|category_id=1$/.test(c.slug));
console.log('non-live series cards from homepage:', uniq.length);
uniq.slice(0,15).forEach(c=>console.log(`  ${(c.alt||c.slug).slice(0,30).padEnd(30)} slug=${c.slug.slice(0,20).padEnd(20)} imgVideoId=${c.imgId}`));
await page.close(); process.exit(0);
