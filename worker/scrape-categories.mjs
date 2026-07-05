import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const OUT=CC+'/uscreen-category-members.jsonl';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/categories',{waitUntil:'domcontentloaded',timeout:40000});
await page.waitForTimeout(2500);
const cats=await page.$$eval('a[href*="/manage/categories/"][href*="/edit"]',as=>{const s=new Set(),o=[];for(const a of as){const m=a.getAttribute('href').match(/categories\/(\d+)\/edit/);if(m&&a.textContent.trim()&&!s.has(m[1])){s.add(m[1]);o.push({id:m[1],title:a.textContent.trim()});}}return o;});
fs.writeFileSync(CC+'/uscreen-categories-list.json',JSON.stringify(cats,null,2));
console.log('categories:',cats.length);
fs.writeFileSync(OUT,'');
for(const c of cats){
  try{
    await page.goto(`https://app.uscreen.tv/manage/categories/${c.id}/edit`,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForTimeout(1500);
    const vids=await page.$$eval('a[href*="/manage/videos/"][href*="/details"]',as=>{const s=new Set(),o=[];for(const a of as){const m=a.getAttribute('href').match(/videos\/(\d+)\/details/);if(m&&!s.has(m[1])){s.add(m[1]);o.push(m[1]);}}return o;});
    fs.appendFileSync(OUT,JSON.stringify({id:c.id,title:c.title,videoIds:vids})+'\n');
    console.log(`  ${c.title.slice(0,30)}: ${vids.length}`);
  }catch(e){ fs.appendFileSync(OUT,JSON.stringify({id:c.id,title:c.title,videoIds:[]})+'\n'); }
  await page.waitForTimeout(1100);
}
console.log('CATEGORIES_DONE');
await page.close();
process.exit(0);
