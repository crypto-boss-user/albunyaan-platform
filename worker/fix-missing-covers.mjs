import { chromium } from 'playwright';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
for (const line of fs.readFileSync(path.join(os.homedir(),'.albunyaan-cc/cloud.env'),'utf8').split('\n')){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2];
}
const SB=process.env.SUPABASE_URL, KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb=createClient(SB,KEY,{auth:{persistSession:false}});
const ids=fs.readFileSync('/tmp/missing-cover-ids.txt','utf8').split('\n').filter(Boolean);
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx=browser.contexts()[0]; const page=await ctx.newPage();
for(const id of ids){
  await page.goto(`https://app.uscreen.tv/manage/contents/collections/${id}/details`,{waitUntil:'domcontentloaded',timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2500);
  if(page.url().includes('login')){ console.log('LOGGED OUT — need re-login'); break; }
  const cover=await page.$$eval('img',(els,cid)=>{
    const imgs=els.map(e=>e.src).filter(s=>s&&s.includes('uscreencdn'));
    return imgs.find(s=>s.includes(`programs/${cid}/`)&&s.includes('big_'))||imgs.find(s=>s.includes(`programs/${cid}/`))||null;
  },id);
  if(!cover){ console.log(`  ${id}: NO cover found`); continue; }
  // mirror to own storage
  let finalUrl=cover;
  try{
    const res=await fetch(cover); const buf=Buffer.from(await res.arrayBuffer());
    const key=`series/${id}.jpg`;
    await sb.storage.from('posters').upload(key,buf,{contentType:'image/jpeg',upsert:true});
    finalUrl=sb.storage.from('posters').getPublicUrl(key).data.publicUrl;
  }catch(e){ console.log(`  ${id}: mirror failed, using uscreen url`); }
  const {data}=await sb.from('collections').select('id,raw').eq('source','uscreen').eq('external_id',id).maybeSingle();
  if(data){ await sb.from('collections').update({raw:{...(data.raw||{}),cover_url:finalUrl}}).eq('id',data.id); console.log(`  ${id}: FIXED -> ${finalUrl.slice(-40)}`); }
}
await page.close(); process.exit(0);
