import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
await page.goto('https://app.uscreen.tv/manage/analytics/overview', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href*="analytics"], a[href*="/manage/sales"]')]
    .map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 40) }));
  const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 40))
    .filter((t) => t && /day|month|year|range|date|30|90|12/i.test(t)).slice(0, 10);
  return { url: location.href, links: links.slice(0, 25), dateButtons: buttons,
           bodyPreview: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200) };
});
console.log(JSON.stringify(info, null, 1));
await page.goto('about:blank').catch(() => {});
process.exit(0);
