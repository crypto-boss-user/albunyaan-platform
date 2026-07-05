import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
for (const line of fs.readFileSync(path.join(os.homedir(),'.albunyaan-cc/cloud.env'),'utf8').split('\n')){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2];
}
const sb=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const covers=fs.readFileSync(os.homedir()+'/.albunyaan-cc/uscreen-collection-covers.jsonl','utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
console.log('covers to apply:',covers.length);
let done=0;
for(const c of covers){
  const {data}=await sb.from('collections').select('id,raw').eq('source','uscreen').eq('external_id',String(c.id)).maybeSingle();
  if(!data) continue;
  const raw={...(data.raw||{}), cover_url:c.cover};
  await sb.from('collections').update({raw}).eq('id',data.id);
  done++; if(done%100===0) process.stdout.write(`\r  ${done}/${covers.length}`);
}
console.log(`\nCOVERS_APPLIED ${done}`);
process.exit(0);
