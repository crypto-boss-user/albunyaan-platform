/**
 * STAP 8-verkenning — WAAR leven de comments (ta3lieqaat) op de storefront?
 *
 * Community-module in de admin staat UIT (werkorder §7), dus reacties leven op
 * de storefront-videopagina's. Dit script opent een paar programmapagina's,
 * luistert het netwerk af en scant de DOM op comment-secties, en rapporteert
 * ALLEEN wat het ziet — fail-honest, geen aannames. Alleen-lezen.
 *
 * Run (vanuit worker/):  node discover-comments.mjs [permalink…]
 */
import { chromium } from 'playwright';

const targets = process.argv.slice(2);
if (!targets.length) targets.push('kidsplace-app', 'protection-in-ios', 'albunyaan-cbfcf4');
const ts = () => new Date().toISOString().slice(11, 19);

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());

for (const t of targets) {
  const hits = [];
  const listener = (r) => {
    const u = r.url();
    if (/comment|review|discuss|disqus|reaction/i.test(u)) hits.push(`${r.status()} ${u.slice(0, 140)}`);
  };
  page.on('response', listener);
  try {
    await page.goto(`https://albunyaan.tv/programs/${t}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    const dom = await page.evaluate(() => {
      const txt = document.body.innerText;
      const els = [...document.querySelectorAll('[class*="comment" i], [id*="comment" i], [data-testid*="comment" i]')];
      return {
        url: location.href,
        loginWall: /sign.?in|log.?in/i.test(document.querySelector('nav')?.innerText ?? ''),
        commentEls: els.slice(0, 6).map((e) => `${e.tagName}.${e.className}`.slice(0, 80)),
        arabicHits: (txt.match(/تعليق[^\n]{0,60}/g) ?? []).slice(0, 4),
        englishHits: (txt.match(/[Cc]omment[^\n]{0,60}/g) ?? []).slice(0, 4),
      };
    });
    console.log(`[${ts()}] == /programs/${t}`);
    console.log('  netwerk:', hits.length ? hits : '(geen comment-achtige requests)');
    console.log('  dom:', JSON.stringify(dom, null, 1));
  } catch (e) {
    console.log(`[${ts()}] ${t}: FOUT ${String(e.message).slice(0, 80)}`);
  }
  page.off('response', listener);
}
await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
process.exit(0);
