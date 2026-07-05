import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/contents/collections/4247706/details', {waitUntil:'networkidle', timeout:45000}).catch(()=>{});
await page.waitForTimeout(3000);
// look for labels/sections mentioning image/thumbnail/cover/poster/artwork
const labels = await page.evaluate(()=>{
  const hits=[];
  document.querySelectorAll('label,h1,h2,h3,h4,button,span,div').forEach(e=>{
    const t=(e.textContent||'').trim();
    if(t.length<40 && /thumbnail|cover|poster|artwork|image|صورة/i.test(t)) hits.push(t);
  });
  return [...new Set(hits)].slice(0,15);
});
console.log('cover/image field labels on collection detail:', JSON.stringify(labels));
// any image with a data src or in an upload preview
const anyImg = await page.$$eval('img,[style*="background-image"]', els=>els.length);
console.log('total img/bg elements on page:', anyImg);
const url = page.url(); console.log('final url:', url);
await page.close(); process.exit(0);
