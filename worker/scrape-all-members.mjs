import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const list=JSON.parse(fs.readFileSync(CC+'/uscreen-collections-list-full.json','utf8'));
const OUT=CC+'/uscreen-collection-members.jsonl';
const done=new Set();
if(fs.existsSync(OUT)) fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).forEach(l=>{try{done.add(JSON.parse(l).id)}catch{}});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
let i=0;
for(const c of list){
  i++; if(done.has(c.id)) continue;
  try{
    await page.goto(`https://app.uscreen.tv/manage/contents/collections/${c.id}/details`,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForSelector('a[href*="/manage/videos/"][href*="/details"]',{timeout:10000}).catch(()=>{});
    await page.waitForTimeout(600);
    const vids=await page.$$eval('a[href*="/manage/videos/"][href*="/details"]',as=>{const s=new Set(),o=[];for(const a of as){const m=a.getAttribute('href').match(/videos\/(\d+)\/details/);if(m&&!s.has(m[1])){s.add(m[1]);o.push(m[1]);}}return o;});
    fs.appendFileSync(OUT,JSON.stringify({id:c.id,title:c.title,videoIds:vids})+'\n');
    if(i%10===0||vids.length>0) console.log(`  [${i}/${list.length}] ${c.title.slice(0,28)}: ${vids.length}`);
  }catch(e){ console.log(`  [${i}] ${c.title.slice(0,28)}: ERR`); }
  await page.waitForTimeout(1100);
}
console.log('ALL_MEMBERS_DONE');
await page.close();
process.exit(0);
