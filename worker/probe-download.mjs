import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0]; const page = await ctx.newPage();
// capture network for video/manifest URLs + look for download UI
const media = [];
page.on('response', r => { const u=r.url(); if(/\.m3u8|\.mp4|\.ts|manifest|playlist|download|source/i.test(u)) media.push(r.status()+' '+u.slice(0,130)); });
// a known published video
await page.goto('https://app.uscreen.tv/manage/videos/4255266/details', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(4000);
if(page.url().includes('login')){ console.log('LOGGED OUT'); await page.close(); process.exit(0); }
// download-related buttons/links
const dl = await page.$$eval('button,a', els=>els.map(e=>({t:(e.textContent||'').trim(), href:e.getAttribute('href')||''})).filter(x=>/download|export|master|source|original/i.test(x.t)).slice(0,10));
console.log('=== download/export UI on video detail ===');
dl.forEach(d=>console.log(`  "${d.t}" ${d.href}`));
// is there an API/source hint in page data?
const hasApi = await page.evaluate(()=>{
  const html=document.documentElement.innerHTML;
  return {
    hlsInPage: /\.m3u8/.test(html),
    mp4InPage: /\.mp4/.test(html),
    downloadUrl: (html.match(/https:\/\/[^"']*download[^"']*/)||[])[0]||null,
    videoId: (html.match(/"(?:video_id|content_id|asset_id)"\s*:\s*"?(\d+)/)||[])[1]||null,
  };
});
console.log('=== page data hints ===', JSON.stringify(hasApi,null,1));
console.log('=== media/manifest network seen ===');
[...new Set(media)].slice(0,10).forEach(m=>console.log('  '+m));
await page.close(); process.exit(0);
