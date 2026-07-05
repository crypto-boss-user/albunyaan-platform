import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const cats=JSON.parse(fs.readFileSync(CC+'/uscreen-categories-list.json','utf8'));
const OUT=CC+'/uscreen-category-collections.jsonl';
fs.writeFileSync(OUT,'');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
for(const c of cats){
  let colls=[], vids=[];
  try{
    await page.goto(`https://app.uscreen.tv/manage/categories/${c.id}/edit`,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForTimeout(1800);
    const found=await page.evaluate(()=>{
      const cs=new Set(),vs=new Set();
      document.querySelectorAll('a[href*="/collections/"]').forEach(a=>{const m=a.getAttribute('href').match(/collections\/(\d+)/);if(m)cs.add(m[1]);});
      document.querySelectorAll('a[href*="/manage/videos/"]').forEach(a=>{const m=a.getAttribute('href').match(/videos\/(\d+)/);if(m)vs.add(m[1]);});
      return {colls:[...cs], vids:[...vs]};
    });
    colls=found.colls; vids=found.vids;
  }catch(e){}
  fs.appendFileSync(OUT,JSON.stringify({id:c.id,title:c.title,collectionIds:colls,videoIds:vids})+'\n');
  console.log(`  ${c.title.slice(0,28)}: ${colls.length} colls, ${vids.length} vids`);
  await page.waitForTimeout(1500);
}
console.log('CAT_COLLECTIONS_DONE');
await page.close();
process.exit(0);
