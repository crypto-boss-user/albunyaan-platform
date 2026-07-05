import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const list=JSON.parse(fs.readFileSync(CC+'/uscreen-collections-list-full.json','utf8'));
const OUT=CC+'/uscreen-collection-covers.jsonl';
const done=new Set();
if(fs.existsSync(OUT)) fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).forEach(l=>{try{done.add(JSON.parse(l).id)}catch{}});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
let i=0, found=0;
for(const c of list){
  i++; if(done.has(c.id)) { found++; continue; }
  try{
    await page.goto(`https://app.uscreen.tv/manage/contents/collections/${c.id}/details`, {waitUntil:'domcontentloaded', timeout:35000});
    await page.waitForTimeout(1400);
    if(page.url().includes('login')){ console.log('SESSION LOST at',i); break; }
    const cover = await page.$$eval('img', (els, cid) => {
      const imgs = els.map(e=>e.src).filter(s=>s&&s.includes('uscreencdn'));
      return imgs.find(s=>s.includes(`programs/${cid}/`)) || imgs.find(s=>s.includes('big_')) || null;
    }, c.id);
    if(cover){ fs.appendFileSync(OUT, JSON.stringify({id:c.id, cover})+'\n'); found++; }
    if(i%25===0||i<5) console.log(`[${i}/${list.length}] found ${found} covers`);
  }catch(e){ if(i%25===0) console.log(`[${i}] err`); }
  await page.waitForTimeout(1100);
}
console.log(`COVERS_DONE ${found}/${list.length}`);
await page.close(); process.exit(0);
