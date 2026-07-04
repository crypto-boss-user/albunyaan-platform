// One-time HEADED login to capture the Uscreen session (storageState).
// Copied from ~/projects/albunyaan-command-center/worker/uscreen-login.ts —
// adapted imports only (env via process.env instead of the CC env module).
//
// Run `pnpm --filter @albunyaan/worker uscreen:login`, sign in as the admin
// (incl. any 2FA), and this saves the session for the headless scraper.
// Re-run whenever the scraper reports "login_lost".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SIGN_IN_URL = 'https://app.uscreen.tv/manage/home';

async function main() {
  const statePath =
    process.env.USCREEN_STORAGE_STATE ?? path.join(os.homedir(), '.albunyaan-cc', 'uscreen-storageState.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SIGN_IN_URL);

  console.log('\n➡  Sign in to the Uscreen admin in the opened window (incl. 2FA).');
  console.log('   Waiting until the /manage dashboard loads (max 5 minutes)…\n');

  const deadline = Date.now() + 5 * 60_000;
  let ok = false;
  while (Date.now() < deadline) {
    const url = page.url();
    const passwordField = await page.locator('input[type="password"]').count().catch(() => 1);
    if (url.includes('/manage') && !url.includes('sign_in') && passwordField === 0) {
      ok = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ok) {
    console.error('✗ Timed out — no signed-in /manage session detected. Nothing saved.');
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: statePath });
  await browser.close();
  console.log(`✓ Session saved to ${statePath} — the headless scraper can now run.`);
}

void main();
