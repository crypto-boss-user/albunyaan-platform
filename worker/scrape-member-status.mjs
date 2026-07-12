// Fresh snapshot of Uscreen member subscription status (Active/Churned/…) for
// the Brevo churn-sync (lifecycle engine Phase 2). Based on scrape-people.mjs;
// differences: explicit status extraction, OVERWRITES a fresh dated snapshot
// (sync wants current truth, not an append-log). Sequential + polite delays —
// NEVER run while migrate-videos --harvest is active (one admin scraper at a
// time or Uscreen's bot detection trips; founder-approved pattern 2026-07-11:
// pause migration → sync → resume).
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.HOME + '/.albunyaan-cc/uscreen-member-status.jsonl';
if (process.env.SKIP_GUARD !== '0') {
  const { execSync } = await import('node:child_process');
  try {
    execSync('pgrep -f "migrate-videos.ts --harvest"', { stdio: 'pipe' });
    console.error('REFUSING: migration harvest is running — pause it first.');
    process.exit(2);
  } catch { /* no harvest → safe */ }
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
await page.goto('https://app.uscreen.tv/manage/people?page=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
if (page.url().includes('login')) { console.error('LOGGED OUT'); process.exit(1); }
// Pagination renders as BUTTONS (no hrefs) — read the page count from the
// pagination bar text ("Previous 1 2 3 … More pages 117 Next"); URL ?page=N
// navigation still works fine.
const lastPage = await page.evaluate(() => {
  const m = document.body.innerText.match(/More pages\s*(\d+)/i);
  if (m) return parseInt(m[1]);
  const nums = [...document.body.innerText.matchAll(/Previous([\d\s]+)Next/g)]
    .flatMap((x) => x[1].match(/\d+/g) || []).map(Number);
  return Math.max(1, ...nums);
});
console.log('PEOPLE_LAST_PAGE:', lastPage);
const rowsAll = [];
for (let p = 1; p <= lastPage; p++) {
  if (p > 1) await page.goto('https://app.uscreen.tv/manage/people?page=' + p, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(900);
  // Per-CELL extraction, never regex over the whole row's textContent: with
  // whitespace collapsed, "LOLotfi Smart lotfismartdz@gmail.com---Active"
  // yields emails with the NAME glued to the front and "---Active" glued to
  // the back (this poisoned 1,555 Brevo contacts on 2026-07-11 before being
  // caught). A cell (or element) whose OWN trimmed text is exactly an email
  // is unambiguous.
  const rows = await page.$$eval('tr', (trs) => trs.map((tr) => {
    const strict = /^[\w.+-]+@[\w-]+(\.[A-Za-z]{2,24})+$/;
    let email = null;
    for (const el of tr.querySelectorAll('td, span, a, div, p')) {
      const t = (el.textContent || '').trim();
      if (strict.test(t)) { email = t; break; }
    }
    if (!email) return null;
    const cellTexts = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim());
    const status = (cellTexts.find((t) => /^(Active|Churned|Trial|Paused|Upcoming|Cancelled)$/.test(t)) || '');
    const link = tr.querySelector('a[href*="/manage/people/"]')?.getAttribute('href') || null;
    const id = ((link && link.match(/people\/(\d+)/)) || [])[1] || null;
    return { id, email: email.toLowerCase(), status };
  }).filter(Boolean));
  rowsAll.push(...rows);
  if (p <= 2 || p % 10 === 0 || p === lastPage) console.log('page', p, '/', lastPage, '| rows so far', rowsAll.length);
  await page.waitForTimeout(1500); // politeness — same cadence as the harvest
}
// dedupe by email, last occurrence wins
const byEmail = new Map();
for (const r of rowsAll) byEmail.set(r.email, r);
// Fail-loud validation: refuse to write a snapshot that would poison the
// Brevo sync. Every email must pass the strict pattern; a single bad one
// means the extraction broke again — investigate, don't sync.
const strict = /^[\w.+-]+@[\w-]+(\.[a-z]{2,24})+$/;
const invalid = [...byEmail.keys()].filter((e) => !strict.test(e));
if (invalid.length > 0) {
  console.error(`VALIDATION FAILED: ${invalid.length}/${byEmail.size} emails malformed — NOT writing snapshot.`);
  console.error('examples:', invalid.slice(0, 5));
  process.exit(3);
}
fs.writeFileSync(OUT, [...byEmail.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
const counts = {};
for (const r of byEmail.values()) counts[r.status || 'none'] = (counts[r.status || 'none'] || 0) + 1;
console.log('DONE', byEmail.size, 'members →', OUT, JSON.stringify(counts));
await page.goto('about:blank').catch(() => {});
process.exit(0);
