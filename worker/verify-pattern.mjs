import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
for (const cid of ['4235128','4229512','4217535']) { // المختبر السري, نيمو وتيمو, أخلاقي كنز
  await page.goto(`https://app.uscreen.tv/manage/contents/collections/${cid}/details`, {waitUntil:'domcontentloaded', timeout:40000}).catch(()=>{});
  await page.waitForTimeout(2500);
  const cover = await page.$$eval('img', (els, cid) => {
    const imgs = els.map(e=>({src:e.src,w:e.naturalWidth})).filter(x=>x.src&&x.src.includes('uscreencdn'));
    // cover = image whose program id == collection id, else first 'big_'
    return imgs.find(i=>i.src.includes(`programs/${cid}/`))?.src || imgs.find(i=>i.src.includes('big_'))?.src || null;
  }, cid);
  console.log(`collection ${cid}: ${cover ? cover.replace(/^https:\/\/[^/]+\//,'') : 'NO COVER'}`);
}
await page.close(); process.exit(0);
