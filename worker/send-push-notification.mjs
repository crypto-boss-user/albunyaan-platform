// Uscreen push-notification sender — sends the NEXT founder-approved item from
// the marketing repo's bank to all push-enabled app users (~1,287).
//
// SAFETY RAILS (all fail-closed):
//  1. The bank file's sha256 must be APPROVED in the manhaj gate log — any edit
//     to the bank after approval blocks sending until re-approved.
//  2. Refuses while the migration harvest is using the twin browser; waits for
//     a transfer window (up to WAIT_MAX). Same one-admin-scraper-at-a-time rule.
//  3. DRY_RUN=1 fills the form + screenshots but never clicks send.
//  4. Enforces Uscreen limits (title 65 / message 178) — refuses over-length.
//  5. Appends every send to logs/publish/push-log.txt in the marketing repo.
// Usage: DRY_RUN=1 node_modules/.bin/tsx send-push-notification.mjs
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const MKT = `${process.env.HOME}/Marketing-Pipelines-Albunyaan`;
const BANK = `${MKT}/state/push-notifications-bank.json`;
const GATE_LOG = `${MKT}/logs/compliance/gate-log.jsonl`;
const LOG = `${MKT}/logs/publish/push-log.txt`;
const DRY = process.env.DRY_RUN === '1';
const WAIT_MAX_MS = 2 * 60 * 60 * 1000;

// rail 1: bank approved?
const bankRaw = fs.readFileSync(BANK);
const sha = createHash('sha256').update(bankRaw).digest('hex');
const cleared = fs.readFileSync(GATE_LOG, 'utf8').split('\n').filter(Boolean).some((l) => {
  try { const e = JSON.parse(l); return e.content_sha256 === sha && ['PASS', 'APPROVED'].includes(e.verdict); }
  catch { return false; }
});
if (!cleared) {
  console.error(`BLOCKED: bank sha ${sha.slice(0, 12)}… has no PASS/APPROVED gate entry. Founder must approve (scripts/approve.py) after any bank edit.`);
  process.exit(3);
}
const bank = JSON.parse(bankRaw);
// Rotation state lives in a SEPARATE file so the approved bank stays byte-identical
// (its sha must remain valid across sends; only content edits require re-approval).
const ROT = `${MKT}/state/push-rotation.json`;
const rot = fs.existsSync(ROT) ? JSON.parse(fs.readFileSync(ROT, 'utf8')) : { next_index: 0 };
const item = bank.items[rot.next_index % bank.items.length];
if (item.title.length > 65 || item.message.length > 178) {
  console.error('BLOCKED: over Uscreen length limits.');
  process.exit(3);
}

// rail 2: wait for a harvest-free window
const started = Date.now();
for (;;) {
  try { execSync('pgrep -f "migrate-videos.ts --harvest"', { stdio: 'pipe' }); }
  catch { break; } // no harvest → safe
  if (Date.now() - started > WAIT_MAX_MS) { console.error('TIMEOUT waiting for a browser window.'); process.exit(2); }
  await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url() === 'about:blank') ?? (await ctx.newPage());
await page.goto('https://app.uscreen.tv/manage/marketings/push_notifications/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('login')) { console.error('LOGGED OUT'); process.exit(1); }
await page.waitForTimeout(5000);
await page.fill('#notification-title, [name="notification-title"], input[placeholder*="short and sweet"]', item.title);
await page.fill('#notification-message, [name="notification-message"], textarea', item.message);
await page.waitForTimeout(800);
await page.screenshot({ path: `${MKT}/logs/publish/push-preview-${Date.now()}.png` });
if (DRY) {
  console.log(`DRY RUN ok — form filled with item ${rot.next_index} (${item.lang}): "${item.title}" — NOT sent. Screenshot in logs/publish/.`);
  await page.goto('about:blank').catch(() => {});
  process.exit(0);
}
// real send: the primary submit button on the composer
const sendBtn = page.getByRole('button', { name: /send/i }).first();
await sendBtn.click({ timeout: 10000 });
await page.waitForTimeout(1500);
// some UIs confirm with a dialog — accept a visible confirm button if present
const confirm = page.getByRole('button', { name: /^(send|confirm|yes)/i }).first();
await confirm.click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(4000);
fs.appendFileSync(LOG, `${new Date().toISOString()} | sent item ${rot.next_index} (${item.lang}) | "${item.title}"\n`);
rot.next_index = (rot.next_index + 1) % bank.items.length;
rot.last_sent = new Date().toISOString();
fs.writeFileSync(ROT, JSON.stringify(rot, null, 2) + '\n');
console.log(`SENT item (${item.lang}): "${item.title}". next_index → ${rot.next_index}. Bank untouched (sha stays approved).`);
await page.goto('about:blank').catch(() => {});
process.exit(0);
