/**
 * e2e-admin-gate.ts — WS7 admin security-foundation verification (LOCAL only).
 *
 * Proves the gate end-to-end in a real browser:
 *   1. anonymous → /admin            → redirect /login
 *   2. logged-in NON-admin → /admin  → 404 (existence not disclosed, not 403)
 *   3. admin, aal1, no factor → /admin → redirect /admin/mfa/enroll
 *   4. enroll a TOTP factor + verify with a REAL computed code → session aal2 →
 *      /admin renders the dashboard
 *   5. a FRESH login (aal1, factor already verified) → /admin → redirect /admin/mfa
 *      (step-up), and a real code there unlocks the dashboard
 *   6. audit log recorded the enrollment
 *
 * Requires local Supabase with [auth.mfa.totp] enroll/verify enabled (config.toml,
 * needs a stack restart to take effect) — the harness detects and reports if not.
 *
 * Run:  BASE_URL=http://localhost:3012 node_modules/.bin/tsx worker/e2e-admin-gate.ts
 */
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = path.join(import.meta.dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
const BASE = process.env.BASE_URL ?? 'http://localhost:3012';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) { console.error(`refusing non-local Supabase: ${url}`); process.exit(2); }
const service = createClient(url, serviceKey, { auth: { persistSession: false } });
// Implicit-flow anon client → plain (non-pkce) token hash, verifiable via /auth/confirm.
const otpClient = createClient(url, anonKey, {
  auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ADMIN_EMAIL = 'admin-e2e@test.local';
const MEMBER_EMAIL = 'nonadmin-e2e@test.local';

let passed = 0, failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ FAIL: ${label}`); }
}

// ── RFC 6238 TOTP from a base32 secret ───────────────────────────────────────
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string, atMs = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (bin % 1_000_000).toString().padStart(6, '0');
}

async function purge(): Promise<void> {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if ([ADMIN_EMAIL, MEMBER_EMAIL].includes((u.email ?? '').toLowerCase())) {
      await service.from('platform_admins').delete().eq('auth_user_id', u.id);
      await service.from('admin_audit_log').delete().eq('actor_auth_user_id', u.id);
      const { data: p } = await service.from('people').select('id').eq('email', u.email!).maybeSingle();
      if (p) await service.from('households').delete().eq('owner_person_id', p.id);
      await service.auth.admin.deleteUser(u.id);
    }
  }
}

/** The /auth/confirm URL from the most recent magic-link email to `email`. */
async function confirmUrlFromMail(email: string, notBefore: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const body = (await res.json()) as { messages?: Array<{ ID: string; Created: string }> };
    const msg = (body.messages ?? []).find((m) => new Date(m.Created).getTime() >= notBefore - 2000);
    if (msg) {
      const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML?: string; Text?: string };
      const html = (detail.HTML || detail.Text || '').replace(/&amp;/g, '&').replace(/=\r?\n/g, '');
      const m = html.match(/https?:\/\/[^"'\s<>]*\/auth\/confirm\?[^"'\s<>]+/);
      if (m) { const u = new URL(m[0]); const b = new URL(BASE); u.protocol = b.protocol; u.host = b.host; return u.toString(); }
    }
    await sleep(1000);
  }
  throw new Error(`no magic-link email for ${email} arrived in Mailpit`);
}

/** Log a user in through the real interstitial (signInWithOtp → Mailpit → Continue). */
async function login(browser: Browser, email: string): Promise<BrowserContext> {
  const t0 = Date.now();
  const { error } = await otpClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw new Error(`signInWithOtp(${email}): ${error.message}`);
  const confirmUrl = await confirmUrlFromMail(email, t0);

  const ctx = await browser.newContext();
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();
  await page.goto(confirmUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL('**/account**', { timeout: 60_000 });
  await page.close();
  return ctx;
}

async function main(): Promise<void> {
  await purge();
  const { data: adminU } = await service.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true });
  const { data: memberU } = await service.auth.admin.createUser({ email: MEMBER_EMAIL, email_confirm: true });
  await service.from('platform_admins').insert({ auth_user_id: adminU!.user.id, role: 'owner', note: 'e2e' });

  const browser = await chromium.launch();
  try {
    // 1. anonymous
    const anon = await browser.newContext();
    anon.setDefaultNavigationTimeout(120_000);
    const anonPage = await anon.newPage();
    await anonPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    check(/\/login/.test(anonPage.url()), `anonymous /admin → /login (got ${new URL(anonPage.url()).pathname})`);
    await anon.close();

    // 2. non-admin → 404
    const member = await login(browser, MEMBER_EMAIL);
    const mPage = await member.newPage();
    const resp = await mPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    const is404 = resp?.status() === 404 || (await mPage.content()).includes('This page could not be found');
    check(is404, `non-admin /admin → 404 (status ${resp?.status()})`);
    await member.close();

    // 3. admin, aal1, no factor → enroll
    const admin = await login(browser, ADMIN_EMAIL);
    const aPage = await admin.newPage();
    await aPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    check(/\/admin\/mfa\/enroll/.test(aPage.url()), `admin no-factor /admin → /admin/mfa/enroll (got ${new URL(aPage.url()).pathname})`);

    // Detect whether MFA is actually enabled on the stack before the happy path.
    const enrollBody = await aPage.content();
    if (enrollBody.includes('Could not start authenticator setup')) {
      console.log('\n  ⚠ MFA enroll is DISABLED on this local stack (config.toml [auth.mfa.totp] enroll_enabled).');
      console.log('    Restart the stack (supabase stop && supabase start) then re-run for the aal2 happy path.');
      check(false, 'MFA must be enabled to prove the aal2 step-up path');
    } else {
      // 4. enroll: read the secret, compute a real code, verify → aal2 → dashboard
      const secret = (await aPage.locator('code').first().innerText()).replace(/\s+/g, '');
      check(secret.length >= 16, `enroll page exposed a TOTP secret (${secret.length} chars)`);
      await aPage.fill('input[name="code"]', totp(secret));
      await aPage.getByRole('button', { name: /verify/i }).click();
      await aPage.waitForURL((u) => u.pathname === '/admin', { timeout: 60_000 }).catch(() => {});
      const onDash = new URL(aPage.url()).pathname === '/admin' && (await aPage.content()).includes('Admin console');
      check(onDash, `verified TOTP → session aal2 → dashboard (at ${new URL(aPage.url()).pathname})`);

      // 6. audit recorded the enrollment
      const { data: audit } = await service.from('admin_audit_log')
        .select('action').eq('actor_auth_user_id', adminU!.user.id).eq('action', 'admin.mfa_enrolled');
      check((audit?.length ?? 0) >= 1, 'enrollment written to admin_audit_log');

      // 5. FRESH login (aal1, factor already verified) → step-up page → unlock
      const fresh = await login(browser, ADMIN_EMAIL);
      const fPage = await fresh.newPage();
      await fPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
      check(/\/admin\/mfa($|\/)/.test(fPage.url()) && !/enroll/.test(fPage.url()),
        `fresh admin session → /admin/mfa step-up (got ${new URL(fPage.url()).pathname})`);
      // Fresh code (avoid reusing the enroll code in the same 30s window).
      await fPage.fill('input[name="code"]', totp(secret));
      await fPage.getByRole('button', { name: /unlock/i }).click();
      await fPage.waitForURL((u) => u.pathname === '/admin', { timeout: 60_000 }).catch(() => {});
      check(new URL(fPage.url()).pathname === '/admin', `step-up code → dashboard (at ${new URL(fPage.url()).pathname})`);
      await fresh.close();
    }
    await admin.close();
  } finally {
    await browser.close();
    await purge();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await purge().catch(() => {}); process.exit(1); });
