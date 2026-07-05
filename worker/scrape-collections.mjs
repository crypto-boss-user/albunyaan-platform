import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
const CC = os.homedir()+'/.albunyaan-cc';
const list = JSON.parse(fs.readFileSync(CC+'/uscreen-collections-list.json','utf8'));
const OUT = CC+'/uscreen-collection-members.jsonl';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const done=new Set();
if(fs.existsSync(OUT)) fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).forEach(l=>{try{done.add(JSON.parse(l).id)}catch{}});
// First: grab the FULL collections list across pages to extend `list`
await page.goto('https://app.uscreen.tv/manage/contents/collections?page=1',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(2500);
const lastPage = await page.evaluate(()=>Math.max(1,...[...document.querySelectorAll('a[href*="collections?page="]')].map(a=>parseInt((a.getAttribute('href').match(/page=(\d+)/)||[])[1])||1)));
const all=new Map(list.map(c=>[c.id,c.title]));
for(let p=1;p<=lastPage;p++){
  if(p>1){await page.goto('https://app.uscreen.tv/manage/contents/collections?page='+p,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});await page.waitForTimeout(1200);}
  const rows=await page.$$eval('a[href*="/collections/"][href*="/details"]',as=>as.map(a=>{const m=a.getAttribute('href').match(/collections\/(\d+)\/details/);return m&&a.textContent.trim()?{id:m[1],title:a.textContent.trim()}:null}).filter(Boolean));
  rows.forEach(r=>all.set(r.id,r.title));
  await page.waitForTimeout(1000);
}
console.log('total collections found:',all.size,'over',lastPage,'pages');
// Now membership per collection
for(const [id,title] of all){
  if(done.has(id))continue;
  await page.goto(`https://app.uscreen.tv/manage/contents/collections/${id}/details`,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
  await page.waitForTimeout(1500);
  const vids=await page.$$eval('a[href*="/manage/videos/"][href*="/details"]',as=>{const s=new Set(),o=[];for(const a of as){const m=a.getAttribute('href').match(/videos\/(\d+)\/details/);if(m&&!s.has(m[1])){s.add(m[1]);o.push(m[1]);}}return o;});
  fs.appendFileSync(OUT,JSON.stringify({id,title,videoIds:vids})+'\n');
  console.log(`  ${title.slice(0,32)}: ${vids.length} videos`);
  await page.waitForTimeout(1400);
}
console.log('COLLECTIONS_DONE');
await page.close();
