import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0]; const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/contents/collections/2527833/details', {waitUntil:'domcontentloaded', timeout:40000}).catch(()=>{});
await page.waitForTimeout(3500);
if(page.url().includes('login')){ console.log('LOGGED OUT'); await page.close(); process.exit(0); }
// ALL images + their dimensions + orientation
const imgs = await page.$$eval('img', els=>els.map(e=>({src:e.src,w:e.naturalWidth,h:e.naturalHeight})).filter(x=>x.src&&x.src.includes('uscreencdn')));
console.log('=== all collection images ===');
imgs.forEach(i=>{ const orient=i.h>i.w?'PORTRAIT':'landscape'; console.log(`  ${i.w}x${i.h} [${orient}] ${i.src.replace(/^https:..[^/]+./,'').slice(0,58)}`); });
// also check the edit/settings page for a poster upload
await page.goto('https://app.uscreen.tv/manage/contents/collections/2527833/edit', {waitUntil:'domcontentloaded', timeout:30000}).catch(()=>{});
await page.waitForTimeout(2500);
const imgs2 = await page.$$eval('img', els=>els.map(e=>e.src).filter(s=>s&&s.includes('uscreencdn')));
console.log('=== edit page images ===');
[...new Set(imgs2)].slice(0,8).forEach(s=>console.log('  '+s.replace(/^https:..[^/]+./,'').slice(0,60)));
console.log('edit url:', page.url().includes('login')?'LOGGED OUT':page.url().slice(-40));
await page.close(); process.exit(0);
