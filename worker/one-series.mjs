import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
// Admin collection detail — does the collection have an uploaded cover/poster image field?
await page.goto('https://app.uscreen.tv/manage/contents/collections/4247706/details', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(4000);
const allImgs = await page.$$eval('img', els=>els.map(e=>({src:e.src, alt:e.alt||'', w:e.naturalWidth, h:e.naturalHeight})).filter(x=>x.src&&x.src.includes('uscreencdn')));
console.log('=== admin collection 4247706 (عدنان ولينا) images ===');
allImgs.slice(0,10).forEach(i=>console.log(`  ${i.w}x${i.h} ${i.alt.slice(0,20).padEnd(20)} ${i.src.replace(/^https:\/\/[^/]+\//,'').slice(0,60)}`));
// Is there an "artwork/thumbnail/cover" upload section with a bg-image style?
const bgImgs = await page.$$eval('[style*="background-image"]', els=>els.map(e=>e.getAttribute('style')).filter(s=>/uscreencdn/.test(s)).slice(0,5));
console.log('bg-image covers:', bgImgs.length);
bgImgs.forEach(s=>console.log('  ', (s.match(/url\(["']?([^"')]+)/)||[])[1]?.slice(0,70)));
await page.close();
process.exit(0);
