// Uscreen admin analytics sweep → screenshots + DOM-number JSON per page.
// One admin scraper at a time (SKIP_GUARD): never run while migrate harvest is
// active — pause the migration first (founder-approved pause-dance).
// Output: ~/Funnel-Albunyaan-Upgrade/docs/analytics-YYYY-MM-DD/
import { chromium } from 'playwright';
import fs from 'node:fs';
const DATE = new Date().toISOString().slice(0, 10);
const OUT = `${process.env.HOME}/Funnel-Albunyaan-Upgrade/docs/analytics-${DATE}`;
fs.mkdirSync(OUT, { recursive: true });
if (process.env.SKIP_GUARD !== '0') {
  const { execSync } = await import('node:child_process');
  try {
    execSync('pgrep -f "migrate-videos.ts --harvest"', { stdio: 'pipe' });
    console.error('REFUSING: migration harvest is running — pause it first.');
    process.exit(2);
  } catch { /* safe */ }
}
const PAGES = [
  ['overview', '/manage/analytics/overview'],
  ['content', '/manage/analytics/contents'],
  ['people', '/manage/analytics/people'],
  ['community', '/manage/analytics/community'],
  ['sales', '/manage/analytics/sales'],
  ['subscriptions', '/manage/analytics/subscriptions'],
  ['marketing', '/manage/analytics/marketing'],
  ['advanced', '/manage/analytics/advanced_analytics'],
];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
await page.setViewportSize({ width: 1600, height: 1200 });

// The real data lives in an embedded Omni Analytics iframe
// (omni.uscreen.tv/dashboards/...) — same-org, frame-accessible. Extract from
// ALL frames and scroll the Omni frame so lazy widgets render.
function omniFrame() {
  return page.frames().find((f) => f.url().includes('omni.uscreen.tv'));
}

async function settle() {
  for (let i = 0; i < 30; i++) {
    const of = omniFrame();
    if (of) {
      const len = await of.evaluate(() => (document.body ? document.body.innerText.length : 0)).catch(() => 0);
      if (len > 400) break;
    }
    await page.waitForTimeout(1000);
  }
  const of = omniFrame();
  if (of) {
    // scroll through the dashboard to trigger lazy widgets, then back to top
    await of.evaluate(async () => {
      const step = window.innerHeight || 800;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 700));
      }
      window.scrollTo(0, 0);
    }).catch(() => {});
  }
  await page.waitForTimeout(5000); // charts animate in after data
}

async function capture(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
  const frames = [];
  for (const f of page.frames()) {
    try {
      const d = await f.evaluate(() => ({
        url: location.href,
        innerText: document.body ? document.body.innerText : '',
        tables: [...document.querySelectorAll('table')].map((t) =>
          [...t.querySelectorAll('tr')].map((tr) =>
            [...tr.querySelectorAll('th,td')].map((c) => c.textContent.trim().replace(/\s+/g, ' ')))),
      }));
      frames.push(d);
    } catch { /* cross-origin frame — screenshot is the record */ }
  }
  fs.writeFileSync(`${OUT}/${name}.json`,
    JSON.stringify({ capturedAt: new Date().toISOString(), frames }, null, 1));
  return Math.max(...frames.map((f) => f.innerText.length), 0);
}

for (const [name, path] of PAGES) {
  try {
    await page.goto(`https://app.uscreen.tv${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (page.url().includes('login')) { console.error('LOGGED OUT'); process.exit(1); }
    await settle();
    const len = await capture(name);
    console.log(`${name}: captured (${len} chars)`);
    // try a 12-month range inside the Omni frame (best effort, non-fatal)
    const of = omniFrame();
    if (of) {
      const picked = await of.evaluate(() => {
        const el = [...document.querySelectorAll('button,[role="button"],input,div,span')]
          .find((e) => /in the past 30 days/i.test(e.textContent || e.value || '') && (e.textContent || '').length < 45);
        if (el) { el.click(); return true; }
        return false;
      }).catch(() => false);
      if (picked) {
        await page.waitForTimeout(2000);
        const yearly = await of.evaluate(() => {
          const opt = [...document.querySelectorAll('button,[role="option"],li,label,div,span')]
            .find((e) => /past (1 )?year|past 12 months|last year/i.test(e.textContent || '') && (e.textContent || '').length < 40);
          if (opt) { opt.click(); return true; }
          return false;
        }).catch(() => false);
        if (yearly) {
          await settle();
          const len2 = await capture(`${name}-12mo`);
          console.log(`${name}-12mo: captured (${len2} chars)`);
        } else {
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    }
    await page.waitForTimeout(1800); // politeness
  } catch (e) {
    console.error(`${name}: FAILED ${String(e).slice(0, 120)}`);
  }
}
console.log('SWEEP DONE →', OUT);
await page.goto('about:blank').catch(() => {});
process.exit(0);
