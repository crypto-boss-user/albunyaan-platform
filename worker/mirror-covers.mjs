import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
for (const line of fs.readFileSync(path.join(os.homedir(),'.albunyaan-cc/cloud.env'),'utf8').split('\n')){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2];
}
const SB=process.env.SUPABASE_URL, KEY=process.env.SUPABASE_SERVICE_ROLE_KEY, BUCKET='posters';
const sb=createClient(SB,KEY,{auth:{persistSession:false}});
let from=0, done=0, skip=0, fail=0;
for(;;){
  const {data,error}=await sb.from('collections').select('id,external_id,raw').eq('source','uscreen').range(from,from+999);
  if(error) throw error; if(!data.length) break;
  for(const c of data){
    const cov=c.raw?.cover_url;
    if(!cov || cov.includes(new URL(SB).host)){ skip++; continue; }
    try{
      const res=await fetch(cov); if(!res.ok){fail++;continue;}
      const buf=Buffer.from(await res.arrayBuffer());
      const key=`series/${c.external_id}.jpg`;
      const up=await sb.storage.from(BUCKET).upload(key,buf,{contentType:'image/jpeg',upsert:true});
      if(up.error){fail++;continue;}
      const pub=sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
      await sb.from('collections').update({raw:{...c.raw,cover_url:pub}}).eq('id',c.id);
      done++; if(done%50===0) process.stdout.write(`\r  covers mirrored ${done} skip ${skip} fail ${fail}`);
    }catch{fail++;}
    await new Promise(r=>setTimeout(r,120));
  }
  from+=1000;
}
console.log(`\nCOVER_MIRROR_DONE done=${done} skip=${skip} fail=${fail}`); process.exit(0);
