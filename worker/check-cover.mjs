import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/contents/collections/4247706/details', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(4000);
const url = page.url();
console.log('URL:', url.includes('login') ? 'STILL LOGGED OUT' : 'LOGGED IN ✓');
if(url.includes('login')){ await page.close(); process.exit(0); }
// find the collection's cover image + any edit link
const imgs = await page.$$eval('img', els=>els.map(e=>({src:e.src,w:e.naturalWidth,h:e.naturalHeight})).filter(x=>x.src&&x.src.includes('uscreencdn')));
console.log('uscreencdn images:', imgs.length);
imgs.slice(0,8).forEach(i=>console.log(`  ${i.w}x${i.h} ${i.src.replace(/^https:\/\/[^/]+\//,'').slice(0,65)}`));
// try the edit page which usually has the artwork uploader
const editLink = await page.$$eval('a[href*="/collections/"][href*="edit"], a[href*="/collections/"]', els=>els.map(e=>e.getAttribute('href')).filter(h=>/edit|settings/.test(h))[0]||null).catch(()=>null);
console.log('edit link:', editLink);
await page.close(); process.exit(0);
