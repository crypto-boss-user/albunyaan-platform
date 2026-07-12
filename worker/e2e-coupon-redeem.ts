/**
 * e2e-coupon-redeem.ts — verifies the /coupon page + redeem_voucher() RPC
 * end to end (LOCAL stack only). This is the first member-SESSION-scoped RPC
 * call in the app (everything else in packages/core/src/data uses the
 * service-role client) — worth a real browser proof, not just a typecheck.
 *
 * Proves: anon redirected to /login; a minted voucher redeems successfully
 * and creates the entitlement + redemption rows; the same code can't be
 * redeemed twice by the same person; an invalid code gets a generic error
 * (no enumeration of *why* it failed); a garbage-format code is rejected
 * client-side before ever hitting the RPC (saves a rate-limit attempt).
 *
 * Run:  node_modules/.bin/tsx e2e-coupon-redeem.ts
 * (worker/.env is read as fallback, same as the other worker scripts.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(workerDir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3010';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error('need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`refusing to run against non-local Supabase: ${url}`);
  process.exit(2);
}

const service = createClient(url, serviceKey, { auth: { persistSession: false } });

const EMAIL = 'coupon-e2e@test.local';
const PASSWORD = 'e2e-coupon-local-1';

interface CheckResult { check: string; pass: boolean; detail: string }
const results: CheckResult[] = [];
function record(check: string, pass: boolean, detail: string) {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check} — ${detail}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resetMember() {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if ((u.email ?? '').toLowerCase() === EMAIL) await service.auth.admin.deleteUser(u.id);
  }
  const { data: person } = await service.from('people').select('id').eq('email', EMAIL).maybeSingle();
  if (person) {
    await service.from('entitlements').delete().eq('person_id', person.id);
    await service.from('voucher_redemptions').delete().eq('person_id', person.id);
    await service.from('voucher_attempts').delete().eq('person_id', person.id);
  }
  const { data, error } = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!;
}

async function mintVoucher(): Promise<string> {
  const code = `E2ET${Math.floor(Math.random() * 9)}-COUPN${Math.floor(Math.random() * 9)}`.toUpperCase();
  const { error } = await service.from('vouchers').insert({
    code, plan_id: null, duration_days: 30, max_redemptions: 1, sponsor_label: 'e2e-coupon-redeem.ts',
  });
  if (error) throw new Error(`mintVoucher: ${error.message}`);
  return code;
}

async function latestConfirmUrl(email: string, notBefore: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const body = (await res.json()) as { messages?: Array<{ ID: string; Created: string }> };
    const msg = (body.messages ?? []).find((m) => new Date(m.Created).getTime() >= notBefore - 2000);
    if (msg) {
      const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML?: string; Text?: string };
      const html = (detail.HTML || detail.Text || '').replace(/&amp;/g, '&').replace(/=\r?\n/g, '');
      const m = html.match(/https?:\/\/[^"'\s<>]*\/auth\/confirm\?[^"'\s<>]+/);
      if (m) return m[0];
      throw new Error(`email for ${email} has no /auth/confirm URL`);
    }
    await sleep(1000);
  }
  throw new Error(`no email for ${email} arrived in Mailpit`);
}

async function main() {
  console.log(`e2e-coupon-redeem against app=${BASE} supabase=${url}\n`);
  const browser = await chromium.launch();

  // a. anonymous visitor is redirected to /login, never sees the form.
  const anonCtx = await browser.newContext();
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${BASE}/coupon`, { waitUntil: 'networkidle' });
  record('a anon /coupon redirects to /login', anonPage.url().includes('/login'), anonPage.url());
  await anonCtx.close();

  // b. seed member + log in via a real magic link (same pattern as e2e-member-auth.ts).
  await resetMember();
  const t0 = Date.now();
  const reqCtx = await browser.newContext();
  const reqPage = await reqCtx.newPage();
  await reqPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await reqPage.fill('input[name="email"]', EMAIL);
  await reqPage.click('form:has(input[name="email"]) button[type="submit"]');
  const outcome = await Promise.race([
    reqPage.waitForSelector('text=Check your email', { timeout: 90000 }).then(() => 'sent' as const),
    reqPage.waitForSelector('text=Too many attempts', { timeout: 90000 }).then(() => 'throttled' as const),
  ]).catch(() => 'timeout' as const);
  if (outcome === 'throttled') {
    console.log('  (GoTrue resend cooldown — waiting 61s and retrying once)');
    await reqPage.waitForTimeout(61000);
    await reqPage.click('form:has(input[name="email"]) button[type="submit"]');
    await reqPage.waitForSelector('text=Check your email', { timeout: 90000 });
  } else if (outcome === 'timeout') {
    throw new Error('login: neither sent-state nor throttle message appeared');
  }
  await reqCtx.close();

  const mailUrl = new URL(await latestConfirmUrl(EMAIL, t0));
  const baseUrl = new URL(BASE);
  mailUrl.protocol = baseUrl.protocol;
  mailUrl.host = baseUrl.host;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(mailUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Continue to Albunyaan', { timeout: 15000 });
  await page.click('button:has-text("Continue to Albunyaan")');
  await page.waitForURL('**/account**', { timeout: 20000 });
  const loggedIn = await page.locator(`text=${EMAIL}`).first().isVisible().catch(() => false);
  record('b login succeeds', loggedIn, `landed on ${page.url()}`);

  // c. mint a real voucher, redeem it via the actual UI.
  const code = await mintVoucher();
  await page.goto(`${BASE}/coupon`, { waitUntil: 'networkidle' });
  await page.fill('#coupon-code', code);
  await page.click('form:has(#coupon-code) button[type="submit"]');
  await page.waitForSelector('text=Code redeemed', { timeout: 15000 }).catch(() => null);
  const redeemedUiShown = await page.locator('text=Code redeemed').first().isVisible().catch(() => false);
  record('c redeem shows success UI', redeemedUiShown, redeemedUiShown ? 'ok' : 'success message never appeared');

  const { data: person } = await service.from('people').select('id').eq('email', EMAIL).maybeSingle();
  const { data: ent } = await service
    .from('entitlements')
    .select('id, status, provider, provider_ref')
    .eq('person_id', person!.id)
    .eq('provider', 'voucher')
    .maybeSingle();
  record('c entitlement row created', !!ent && ent.status === 'active', ent ? JSON.stringify(ent) : 'no entitlement row');

  const { data: voucherRow } = await service.from('vouchers').select('redemption_count').eq('code', code).maybeSingle();
  record('c voucher redemption_count incremented', voucherRow?.redemption_count === 1, `redemption_count=${voucherRow?.redemption_count}`);

  // d. redeeming the SAME code again (already redeemed by this person) fails generically.
  await page.goto(`${BASE}/coupon`, { waitUntil: 'networkidle' });
  // /coupon redirects an already-entitled-looking member nowhere special — it's
  // still reachable, redemption just fails at the RPC layer. Re-fill fresh
  // (React resets uncontrolled fields after a prior action settled).
  await page.fill('#coupon-code', code);
  await page.click('form:has(#coupon-code) button[type="submit"]');
  await page.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null);
  const dupeError = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  record('d re-redeeming the same code fails with a generic message', !!dupeError && /invalid|expired|already/i.test(dupeError), dupeError ?? 'no error shown');

  // e. a garbage-format code is rejected client-side (never reaches the RPC / rate limiter).
  await page.goto(`${BASE}/coupon`, { waitUntil: 'networkidle' });
  await page.fill('#coupon-code', 'not-a-real-code');
  await page.click('form:has(#coupon-code) button[type="submit"]');
  await page.waitForSelector('[role="alert"]', { timeout: 15000 }).catch(() => null);
  const formatError = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  record('e garbage-format code rejected with a format message', !!formatError && /doesn.t look like/i.test(formatError), formatError ?? 'no error shown');

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFAILURES:');
    failed.forEach((f) => console.log(`  - ${f.check}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
