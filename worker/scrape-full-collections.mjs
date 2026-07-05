import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os';
const CC=os.homedir()+'/.albunyaan-cc';
const OUT=CC+'/uscreen-collections-list-full.json';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
const all=new Map();
let p=1, empty=0;
while(p<=60 && empty<2){
  try{
    await page.goto(`https://app.uscreen.tv/manage/contents/collections?page=${p}`,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForSelector('a[href*="/collections/"][href*="/details"]',{timeout:12000}).catch(()=>{});
    await page.waitForTimeout(700);
    const rows=await page.$$eval('a[href*="/collections/"][href*="/details"]',as=>as.map(a=>{const m=a.getAttribute('href').match(/collections\/(\d+)\/details/);return m&&a.textContent.trim()?{id:m[1],title:a.textContent.trim()}:null}).filter(Boolean));
    const before=all.size; rows.forEach(r=>all.set(r.id,r.title));
    if(all.size===before) empty++; else empty=0;
    console.log(`page ${p}: ${rows.length} rows, total ${all.size}`);
  }catch(e){ console.log(`page ${p} ERR ${String(e).slice(0,50)}`); empty++; }
  p++; await page.waitForTimeout(900);
}
const out=[...all].map(([id,title])=>({id,title}));
fs.writeFileSync(OUT,JSON.stringify(out,null,2));
console.log('FULL_COLLECTIONS_DONE total:',out.length);
function ensure_ascii(){return null}
await page.close();
process.exit(0);
