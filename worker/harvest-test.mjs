import { chromium } from 'playwright';
import fs from 'node:fs';
const ids = fs.readFileSync('/tmp/test-vids.txt','utf8').split('\n').filter(Boolean);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0]; const page = await ctx.newPage();
// FIRST: check if playback id is in the page's Remix data (no player load = fast)
let jsonHit=false;
const t0=Date.now();
const results=[];
for (const id of ids){
  let hls=null;
  const onResp = r => { const u=r.url(); if(/stream\.mux\.com\/[^?]+\.m3u8\?token=/.test(u)&&!hls) hls=u; };
  page.on('response', onResp);
  const start=Date.now();
  await page.goto(`https://app.uscreen.tv/manage/videos/${id}/details`, {waitUntil:'domcontentloaded', timeout:35000}).catch(()=>{});
  // also try to read playback id from embedded JSON (faster, no player)
  const embedded = await page.evaluate(()=>{
    const html=document.documentElement.innerHTML;
    const m=html.match(/([a-zA-Z0-9]{20,})\.m3u8/) || html.match(/"playback_id"\s*:\s*"([^"]+)"/) || html.match(/mux[^"]*?([a-zA-Z0-9]{20,})/);
    return m?m[1]:null;
  }).catch(()=>null);
  await page.waitForTimeout(2500); // let player load if needed
  page.off('response', onResp);
  const pid = hls ? (hls.match(/mux\.com\/([^.]+)\.m3u8/)||[])[1] : embedded;
  results.push({id, pid: pid||null, viaEmbed: !!embedded, viaPlayer: !!hls, ms: Date.now()-start});
  if(embedded) jsonHit=true;
}
const ok=results.filter(r=>r.pid).length;
console.log(`harvested ${ok}/${ids.length} playback IDs in ${((Date.now()-t0)/1000).toFixed(0)}s (avg ${((Date.now()-t0)/ids.length/1000).toFixed(1)}s/video)`);
console.log('embedded-JSON available (fast path):', jsonHit);
results.slice(0,12).forEach(r=>console.log(`  ${r.id}: pid=${r.pid?r.pid.slice(0,20):'NONE'} embed=${r.viaEmbed} player=${r.viaPlayer} ${r.ms}ms`));
await page.close(); process.exit(0);
