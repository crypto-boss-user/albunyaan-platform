import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.HOME + '/.albunyaan-cc/uscreen-videos-rich.jsonl';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/videos?page=1', { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForSelector('a[href*="/manage/videos/"][href*="/details"]', { timeout:30000 });
const lastPage = await page.$$eval('a[href*="/manage/videos?page="]', as => Math.max(1,...as.map(a=>parseInt((a.getAttribute('href').match(/page=(\d+)/)||[])[1],10)||1)));
console.log('LAST_PAGE:', lastPage);
const seen = new Set();
if (fs.existsSync(OUT)) fs.readFileSync(OUT,'utf8').trim().split('\n').filter(Boolean).forEach(l=>{try{seen.add(JSON.parse(l).id)}catch{}});
console.log('resuming, already have', seen.size);
for (let p=1;p<=lastPage;p++){
  if(p>1){ await page.goto('https://app.uscreen.tv/manage/videos?page='+p,{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
    await page.waitForSelector('a[href*="/manage/videos/"][href*="/details"]',{timeout:20000}).catch(()=>{}); }
  await page.waitForTimeout(300);
  const rows = await page.evaluate(()=>{
    const byId={};
    document.querySelectorAll('a[href*="/manage/videos/"][href*="/details"]').forEach(a=>{
      const m=a.getAttribute('href').match(/videos\/(\d+)\/details/); if(!m)return; const id=m[1];
      const row=a.closest('tr')||a.closest('[role="row"]')||a.parentElement?.parentElement;
      const rec=byId[id]||(byId[id]={id,title:'',thumb:null,duration:null,status:null});
      const img=a.querySelector('img[src*="uscreencdn"]')||row?.querySelector('img[src*="uscreencdn"]');
      if(img&&!rec.thumb) rec.thumb=img.getAttribute('src');
      const dur=(a.textContent.match(/(\d+):(\d+)(?::(\d+))?/)||[])[0]; if(dur&&!rec.duration) rec.duration=dur;
      const txt=(a.textContent||'').replace(/\d+:\d+(?::\d+)?/,'').trim();
      if(txt&&txt.length>rec.title.length) rec.title=txt;
      const rt=row?.textContent||''; if(!rec.status) rec.status=/Published/.test(rt)?'published':/Unpublished/.test(rt)?'draft':null;
    });
    return Object.values(byId);
  });
  let added=0; for(const r of rows){ if(!seen.has(r.id)){ seen.add(r.id); fs.appendFileSync(OUT,JSON.stringify(r)+'\n'); added++; } }
  if(p<=3||p%25===0||p===lastPage) console.log('page',p,'/',lastPage,'| +'+added,'| total',seen.size);
  await page.waitForTimeout(1400);
}
console.log('ENUM_DONE total:', seen.size);
await page.close();
