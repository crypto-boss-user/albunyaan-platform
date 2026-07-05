import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0]; const page = await ctx.newPage();
let hls=null, playbackId=null;
page.on('response', r => { const u=r.url();
  if(/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u) && !hls){ hls=u; playbackId=(u.match(/mux\.com\/([^.]+)\.m3u8/)||[])[1]; }
});
await page.goto('https://app.uscreen.tv/manage/videos/4255266/details', {waitUntil:'domcontentloaded', timeout:45000}).catch(()=>{});
await page.waitForTimeout(2000);
// the player may need a click/scroll to start loading the manifest
await page.evaluate(()=>window.scrollTo(0,300)).catch(()=>{});
await page.waitForTimeout(4000);
if(page.url().includes('login')){ console.log('LOGGED OUT'); await page.close(); process.exit(1); }
if(hls){
  fs.writeFileSync('/tmp/hls-url.txt', hls);
  console.log('CAPTURED playbackId:', playbackId);
  console.log('token len:', (hls.match(/token=(.+)/)||['',''])[1].length);
  console.log('URL saved to /tmp/hls-url.txt');
} else {
  console.log('NO HLS captured — player did not autoload. Trying to find a play trigger...');
  const btns = await page.$$eval('button,[role="button"],video', els=>els.map(e=>e.tagName+':'+((e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,20))).slice(0,15));
  console.log('elements:', JSON.stringify(btns));
}
await page.close(); process.exit(hls?0:2);
