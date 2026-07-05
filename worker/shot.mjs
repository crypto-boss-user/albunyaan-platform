import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('http://localhost:3010/catalog', {waitUntil:'domcontentloaded', timeout:45000});
await page.waitForTimeout(5000);
for(let i=0;i<3;i++){ await page.evaluate(()=>window.scrollBy(0,600)); await page.waitForTimeout(600); }
await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(1500);
await page.screenshot({path: process.env.HOME+'/.albunyaan-cc/catalog-covers.png'});
const covers = await page.$$eval('img', els=>els.filter(e=>/posters\/series|big_/.test(e.src)).length);
console.log('branded cover images rendering on screen:', covers);
await page.close(); process.exit(0);
