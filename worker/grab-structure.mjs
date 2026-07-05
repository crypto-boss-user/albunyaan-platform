import { chromium } from 'playwright';
import fs from 'node:fs';
const DIR = process.env.HOME + '/.albunyaan-cc/uscreen-structure';
fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const grab = async (name, url, sel, mapFn) => {
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(2500);
    const rows = await page.$$eval(sel, mapFn).catch(()=>[]);
    fs.writeFileSync(`${DIR}/${name}.json`, JSON.stringify(rows,null,2));
    console.log(name+':', rows.length);
    await page.waitForTimeout(1500);
    return rows;
  } catch(e){ console.log(name,'ERR', String(e).slice(0,80)); return []; }
};
await grab('categories','https://app.uscreen.tv/manage/categories','a[href*="/manage/categories/"], tr',
  trs=>trs.map(t=>({href:t.getAttribute?.('href')||null, text:(t.textContent||'').trim().slice(0,80)})).filter(x=>x.text));
await grab('collections','https://app.uscreen.tv/manage/contents/collections','a[href*="collection"], tr',
  trs=>trs.map(t=>({href:t.getAttribute?.('href')||null, text:(t.textContent||'').trim().slice(0,80)})).filter(x=>x.text));
await grab('authors','https://app.uscreen.tv/manage/authors','tr, a[href*="/manage/authors/"]',
  trs=>trs.map(t=>({href:t.getAttribute?.('href')||null, text:(t.textContent||'').trim().slice(0,80)})).filter(x=>x.text));
await grab('filters','https://app.uscreen.tv/manage/catalog-filters','tr, a',
  trs=>trs.map(t=>({text:(t.textContent||'').trim().slice(0,80)})).filter(x=>x.text));
await grab('plans','https://app.uscreen.tv/manage/subscription_plans','tr, [class*="plan"]',
  trs=>trs.map(t=>({text:(t.textContent||'').trim().slice(0,120)})).filter(x=>x.text));
// People: capture count + look for an Export button
await page.goto('https://app.uscreen.tv/manage/people', { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(3000);
const peopleMeta = await page.evaluate(()=>{
  const body=document.body.innerText;
  const exportBtn=[...document.querySelectorAll('button,a')].find(b=>/export/i.test(b.textContent||''));
  const lastPage=Math.max(1,...[...document.querySelectorAll('a[href*="people?page="]')].map(a=>parseInt((a.getAttribute('href').match(/page=(\d+)/)||[])[1])||1));
  return { hasExport:!!exportBtn, exportText:exportBtn?.textContent?.trim()||null, lastPage, snippet: body.slice(0,300) };
});
fs.writeFileSync(`${DIR}/people-meta.json`, JSON.stringify(peopleMeta,null,2));
console.log('people:', JSON.stringify(peopleMeta).slice(0,200));
await page.close();
