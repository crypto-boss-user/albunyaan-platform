import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: process.env.HOME + '/.albunyaan-cc/uscreen-storageState.json' });
const page = await ctx.newPage();
for (const url of ['https://app.uscreen.tv/manage','https://app.uscreen.tv/manage/dashboard','https://app.uscreen.tv/manage/videos','https://app.uscreen.tv/manage/content']) {
  const r = await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 }).catch(()=>null);
  await page.waitForTimeout(1200);
  const login = /login/i.test(page.url());
  console.log(url.replace('https://app.uscreen.tv',''), '->', r?.status(), login?'LOGIN-WALL':'OK', '|', page.url().replace('https://app.uscreen.tv',''));
}
await browser.close();
