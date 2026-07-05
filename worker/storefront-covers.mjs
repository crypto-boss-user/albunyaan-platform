import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://albunyaan.tv/catalog', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(5000);
for (let i=0;i<14;i++){ await page.evaluate(()=>window.scrollBy(0,1500)); await page.waitForTimeout(700); }
const cards = await page.evaluate(() => {
  const out=[];
  document.querySelectorAll('a[href*="/programs/"]').forEach(a=>{
    const href=a.getAttribute('href'); const img=a.querySelector('img');
    const src=img?.currentSrc||img?.src||'';
    if(href&&src&&src.includes('uscreencdn')) out.push({slug:href.replace(/.*\/programs\//,'').replace(/\/.*/,''), img:src});
  });
  return out;
});
const uniq=[...new Map(cards.map(c=>[c.slug,c])).values()];
fs.writeFileSync(os.homedir()+'/.albunyaan-cc/storefront-covers.json', JSON.stringify(uniq,null,2));
// classify: how many use a UNIQUE image vs the episode-thumb pattern
const progIds=uniq.map(c=>(c.img.match(/programs\/(\d+)/)||[])[1]).filter(Boolean);
console.log('unique series cards captured:', uniq.length);
console.log('sample slug -> image video-id:');
uniq.slice(0,12).forEach(c=>console.log(`  ${c.slug.slice(0,30).padEnd(30)} -> ${(c.img.match(/programs\/(\d+)/)||[])[1]||'?'}`));
await page.close(); process.exit(0);
