import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
// Open a collection detail in the admin and find its OWN poster image
await page.goto('https://app.uscreen.tv/manage/contents/collections/4247706/details', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(3500);
const imgs = await page.$$eval('img', els => els.map(e=>e.src).filter(s=>s && s.includes('uscreencdn')));
const collectionImgs = imgs.filter(s=>/collection/i.test(s));
console.log('=== collection detail page images (uscreencdn) ===');
[...new Set(imgs)].slice(0,12).forEach(s=>console.log(' ', s));
console.log('collection-specific:', collectionImgs.length);
// also the public storefront series card
await page.goto('https://albunyaan.tv/catalog', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(6000);
const cardImgs = await page.$$eval('img', els => els.map(e=>e.src||e.getAttribute('data-src')).filter(Boolean).filter(s=>/uscreencdn|cdn|image/i.test(s)));
console.log('\n=== real storefront card images (sample) ===');
[...new Set(cardImgs)].slice(0,10).forEach(s=>console.log(' ', s));
await page.close();
process.exit(0);
