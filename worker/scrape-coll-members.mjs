import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const list=JSON.parse(fs.readFileSync(CC+'/uscreen-collections-list.json','utf8'));
const OUT=CC+'/uscreen-collection-members.jsonl';
fs.writeFileSync(OUT,'');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
for(const c of list){
  try{
    await page.goto(`https://app.uscreen.tv/manage/contents/collections/${c.id}/details`,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForSelector('a[href*="/manage/videos/"][href*="/details"]',{timeout:12000}).catch(()=>{});
    await page.waitForTimeout(800);
    const vids=await page.$$eval('a[href*="/manage/videos/"][href*="/details"]',as=>{const s=new Set(),o=[];for(const a of as){const m=a.getAttribute('href').match(/videos\/(\d+)\/details/);if(m&&!s.has(m[1])){s.add(m[1]);o.push(m[1]);}}return o;});
    fs.appendFileSync(OUT,JSON.stringify({id:c.id,title:c.title,videoIds:vids})+'\n');
    console.log(`  ${c.title.slice(0,30)}: ${vids.length}`);
  }catch(e){ console.log(`  ${c.title.slice(0,30)}: ERR ${String(e).slice(0,40)}`); }
  await page.waitForTimeout(1200);
}
console.log('MEMBERS_DONE');
await page.close();
