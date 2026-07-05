import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.HOME + '/.albunyaan-cc/uscreen-people.jsonl';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/people?page=1', { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(3000);
const lastPage = await page.evaluate(()=>Math.max(1,...[...document.querySelectorAll('a[href*="people?page="]')].map(a=>parseInt((a.getAttribute('href').match(/page=(\d+)/)||[])[1])||1)));
console.log('PEOPLE_LAST_PAGE:', lastPage);
const seen=new Set();
if (fs.existsSync(OUT)) fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).forEach(l=>{try{seen.add(JSON.parse(l).key)}catch{}});
for (let p=1;p<=lastPage;p++){
  if(p>1){ await page.goto('https://app.uscreen.tv/manage/people?page='+p,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{}); }
  await page.waitForTimeout(600);
  const rows = await page.$$eval('tr', trs=>trs.map(tr=>{
    const email=(tr.textContent.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)||[])[0];
    const link=tr.querySelector('a[href*="/manage/people/"]')?.getAttribute('href')||null;
    const id=(link&&link.match(/people\/(\d+)/)||[])[1]||null;
    if(!email&&!id) return null;
    return { id, email, text: tr.textContent.replace(/\s+/g,' ').trim().slice(0,200) };
  }).filter(Boolean));
  let added=0; for(const r of rows){ const k=r.id||r.email; if(k&&!seen.has(k)){seen.add(k); fs.appendFileSync(OUT,JSON.stringify({...r,key:k,page:p})+'\n'); added++;} }
  if(p<=3||p%20===0||p===lastPage) console.log('people page',p,'/',lastPage,'| +'+added,'| total',seen.size);
  await page.waitForTimeout(1500);
}
console.log('PEOPLE_DONE total:', seen.size);
await page.close();
