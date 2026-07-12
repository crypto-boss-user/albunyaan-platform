/**
 * e2e-member-auth.ts — WS3 verification harness (LOCAL stack only).
 *
 * Drives the real web app (http://localhost:3010) with Playwright against the
 * local Supabase stack + Mailpit, proving:
 *   a. auth.admin.createUser links people.auth_user_id (0003 trigger)
 *   b. full magic-link E2E: /login → Mailpit → /auth/confirm interstitial
 *      (GET sets NO session — scanner-proof; confirm happens in a SECOND browser
 *      context = cross-device; token hash is plain, not pkce_) → Continue POST → /account
 *   c. two-family isolation: households, PINs, profiles, forged cookies, overrides
 *   d. anonymous: public pages 200 with no profile; member pages redirect /login
 *   f. unknown email on /login → friendly closed-signup message
 *   g. change email (double-confirm, type=email_change) + people.email sync
 *
 * Run:  SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *         node_modules/.bin/tsx e2e-member-auth.ts
 * (worker/.env is read as fallback, same as the other worker scripts.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
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

const A_EMAIL = 'familya@test.local';
const B_EMAIL = 'familyb@test.local';
const A_PASSWORD = 'e2e-familyA-local-1'; // local throwaway creds, also used by verify-rls member mode
const B_PASSWORD = 'e2e-familyB-local-1';

interface CheckResult { check: string; pass: boolean; detail: string }
const results: CheckResult[] = [];
function record(check: string, pass: boolean, detail: string) {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check} — ${detail}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── setup: seed the two test members (idempotent) ────────────────────────────

async function resetMember(email: string, password: string, aliasEmails: string[] = []) {
  const purge = [email, ...aliasEmails];
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if (purge.includes((u.email ?? '').toLowerCase())) await service.auth.admin.deleteUser(u.id);
  }
  // Drop any household/person leftovers from a previous run (profiles/overrides cascade).
  for (const e of purge) {
    const { data: person } = await service.from('people').select('id').eq('email', e).maybeSingle();
    if (person) {
      await service.from('households').delete().eq('owner_person_id', person.id);
      if (e !== email) await service.from('people').delete().eq('id', person.id);
    }
  }

  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user!;
}

async function checkPersonLink(email: string, authUserId: string, label: string) {
  const { data } = await service.from('people').select('id, auth_user_id').eq('email', email).maybeSingle();
  record(`a people.auth_user_id linked (${label})`, data?.auth_user_id === authUserId,
    data ? `person ${data.id} → ${data.auth_user_id === authUserId ? 'linked' : 'WRONG/NULL link'}` : 'no people row created');
}

// ── mailpit helpers ──────────────────────────────────────────────────────────

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

/** Real session cookies only (sb-…-auth-token[.n]) — NOT the pkce code-verifier. */
const authCookies = async (ctx: BrowserContext) =>
  (await ctx.cookies()).filter(
    (c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name) && !c.name.includes('code-verifier'),
  );

// ── magic-link login flow (per family) ───────────────────────────────────────

async function loginViaMagicLink(browser: Browser, email: string, label: string): Promise<{ ctx: BrowserContext; page: Page }> {
  // Device 1 requests the link…
  const requestCtx = await browser.newContext();
  const reqPage = await requestCtx.newPage();
  const t0 = Date.now();
  await reqPage.goto(`${BASE}/login`);
  await reqPage.fill('input[name="email"]', email);
  await reqPage.click('button[type="submit"]');
  await reqPage.waitForSelector('text=Check your email', { timeout: 20000 });
  await requestCtx.close();

  const confirmUrl = await latestConfirmUrl(email, t0);
  const tokenHash = new URL(confirmUrl).searchParams.get('token_hash') ?? '';
  const hasParts = tokenHash.length > 0 && confirmUrl.includes('type=email');
  record(`b confirm URL shape (${label})`, hasParts, hasParts ? 'token_hash + type=email present' : confirmUrl);
  record(`b token hash is plain, not PKCE (${label})`, !tokenHash.startsWith('pkce_'),
    tokenHash.startsWith('pkce_') ? 'pkce_-prefixed — device-bound!' : `plain hash (${tokenHash.slice(0, 8)}…)`);

  // Scanner prefetch: a bare GET must NOT set any auth cookie or consume the token.
  const prefetch = await fetch(confirmUrl, { redirect: 'manual' });
  const setCookie = prefetch.headers.get('set-cookie') ?? '';
  record(`b scanner GET is inert (${label})`,
    prefetch.status === 200 && !/sb-.*auth-token/.test(setCookie),
    `status ${prefetch.status}, auth set-cookie: ${/sb-.*auth-token/.test(setCookie) ? 'LEAKED' : 'none'}`);

  // …device 2 (a FRESH context — proves cross-device) opens the link:
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(confirmUrl);
  await page.waitForSelector('text=Continue to Albunyaan', { timeout: 15000 });
  const before = await authCookies(ctx);
  record(`b interstitial GET sets no session (${label})`, before.length === 0,
    before.length === 0 ? 'no sb-*-auth-token cookie after GET' : `${before.length} auth cookie(s) already set!`);

  // …then the explicit button POST verifies and signs in (post-prefetch: proves GET didn't burn it).
  await page.click('button:has-text("Continue to Albunyaan")');
  await page.waitForURL('**/account**', { timeout: 20000 });
  const after = await authCookies(ctx);
  const emailShown = await page.locator(`text=${email}`).first().isVisible().catch(() => false);
  record(`b Continue POST creates session cross-device (${label})`, after.length > 0 && emailShown,
    `auth cookies: ${after.length}, /account shows ${email}: ${emailShown}`);

  return { ctx, page };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`e2e-member-auth against app=${BASE} supabase=${url}\n`);

  // a. seed members, verify trigger link
  const userA = await resetMember(A_EMAIL, A_PASSWORD);
  const userB = await resetMember(B_EMAIL, B_PASSWORD, ['familyb-new@test.local']);
  await checkPersonLink(A_EMAIL, userA.id, 'familyA');
  await checkPersonLink(B_EMAIL, userB.id, 'familyB');

  const browser = await chromium.launch();
  try {
    // f. unknown email → friendly closed-signup message
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/login`);
      await page.fill('input[name="email"]', 'stranger@test.local');
      await page.click('button[type="submit"]');
      const friendly = await page
        .waitForSelector('text=membership signup opens soon', { timeout: 15000 })
        .then(() => true).catch(() => false);
      record('f unknown email → closed-signup message', friendly,
        friendly ? 'friendly message rendered' : 'message missing');
      await ctx.close();
    }

    // b. full magic-link E2E for family A
    const A = await loginViaMagicLink(browser, A_EMAIL, 'familyA');

    // c1. A: first /profiles visit lazily creates the household + adult profile
    await A.page.goto(`${BASE}/profiles`);
    await A.page.waitForSelector('text=Who is watching?');
    const { data: personA } = await service.from('people').select('id').eq('email', A_EMAIL).single();
    const { data: hhA } = await service.from('households').select('id, pin_hash, owner_person_id').eq('owner_person_id', personA!.id).maybeSingle();
    record('c A household lazily created', !!hhA && !hhA.pin_hash,
      hhA ? `household ${hhA.id}, no PIN yet: ${!hhA.pin_hash}` : 'no household created');

    // c2. A: /parents prompts to SET a PIN (not verify), sets 1111
    await A.page.goto(`${BASE}/parents`);
    await A.page.waitForSelector('text=Choose a parent PIN');
    await A.page.fill('input[name="pin"]', '1111');
    await A.page.fill('input[name="confirm"]', '1111');
    await A.page.click('button:has-text("Set PIN")');
    await A.page.waitForSelector('text=Your children', { timeout: 15000 });
    record('c A set PIN 1111 → dashboard', true, 'SetPinGate → unlocked dashboard');

    // c3. add a kid to A (no profile-management UI in WS3 — data-level insert)
    const { error: kidErr } = await service.from('profiles').insert({
      household_id: hhA!.id, kind: 'kid', name: 'Kid A', age_band: '7-9', avatar_hue: 95, daily_limit_minutes: 60,
    });
    if (kidErr) throw kidErr;
    await A.page.goto(`${BASE}/parents`);
    await A.page.waitForSelector('text=Kid A');

    // c4. A blocks a whole series for Kid A via the dashboard UI
    const firstSeries = await A.page.locator('select[name="target"] optgroup[label="Whole series"] option').first().getAttribute('value');
    await A.page.selectOption('select[name="target"]', firstSeries!);
    await A.page.click('button[name="action"][value="block"]');
    await A.page.waitForSelector('text=Blocked', { timeout: 15000 });
    const { data: ovA } = await service.from('content_overrides').select('id, profile_id, profiles!inner(household_id)').eq('profiles.household_id', hhA!.id);
    record('c A blocked a series for Kid A', (ovA?.length ?? 0) >= 1, `${ovA?.length ?? 0} override(s) in A's household`);

    // b/c. B logs in via its own magic link
    const B = await loginViaMagicLink(browser, B_EMAIL, 'familyB');

    // c5. B sees ONLY B's profiles
    await B.page.goto(`${BASE}/profiles`);
    await B.page.waitForSelector('text=Who is watching?');
    const bSeesKidA = await B.page.locator('text=Kid A').count();
    const bProfileNames = await B.page.locator('main span.font-bold').allInnerTexts();
    record('c B sees only own profiles', bSeesKidA === 0 && bProfileNames.length === 1,
      `profiles shown: [${bProfileNames.join(', ')}], Kid A visible: ${bSeesKidA > 0}`);

    // c6. B: set-PIN-first flow with 2222, then lock, then A's PIN must FAIL
    await B.page.goto(`${BASE}/parents`);
    await B.page.waitForSelector('text=Choose a parent PIN');
    await B.page.fill('input[name="pin"]', '2222');
    await B.page.fill('input[name="confirm"]', '2222');
    await B.page.click('button:has-text("Set PIN")');
    await B.page.waitForSelector('text=Your children', { timeout: 15000 });
    await B.page.click('button:has-text("Lock dashboard")');
    await B.page.waitForSelector('text=Enter your PIN');
    // fresh page load per attempt: no stale "Wrong PIN" text, no pending-form races
    for (const [pin, label, shouldPass] of [['1111', "A's PIN 1111", false], ['1234', 'legacy demo PIN 1234', false], ['2222', "B's own PIN 2222", true]] as const) {
      await B.page.goto(`${BASE}/parents`);
      await B.page.waitForSelector('text=Enter your PIN');
      await B.page.fill('input[name="pin"]', pin);
      await B.page.click('button:has-text("Unlock dashboard")');
      if (shouldPass) {
        const ok = await B.page.waitForSelector('text=Your children', { timeout: 20000 }).then(() => true).catch(() => false);
        record(`c ${label} on B /parents`, ok, ok ? 'unlocked (correct)' : 'did NOT unlock');
      } else {
        const rejected = await B.page.waitForSelector('p[role="alert"]:has-text("Wrong PIN")', { timeout: 20000 }).then(() => true).catch(() => false);
        const dashboardLeak = await B.page.locator('text=Your children').count();
        record(`c ${label} on B /parents rejected`, rejected && dashboardLeak === 0,
          rejected && dashboardLeak === 0 ? 'Wrong PIN (correct)' : 'was ACCEPTED — leak!');
      }
    }

    // c7. forged albn_profile cookie: B carries A's Kid A profile id → server ignores it
    const { data: kidA } = await service.from('profiles').select('id').eq('household_id', hhA!.id).eq('kind', 'kid').single();
    await B.ctx.addCookies([{ name: 'albn_profile', value: kidA!.id, url: BASE }]);
    await B.page.goto(`${BASE}/profiles`);
    await B.page.waitForSelector('text=Who is watching?');
    const forgedActive = await B.page.locator('text=Kid A').count();
    const headerHasKidA = await B.page.locator('header >> text=Kid A').count();
    record('c forged albn_profile cookie ignored', forgedActive === 0 && headerHasKidA === 0,
      forgedActive + headerHasKidA === 0 ? "B still sees only B's profiles" : "A's kid profile leaked into B's session!");

    // c8. overrides for B's household are empty
    const { data: profB } = await service.from('profiles').select('id, households!inner(owner_person_id)').eq('households.owner_person_id', (await service.from('people').select('id').eq('email', B_EMAIL).single()).data!.id);
    const bProfileIds = (profB ?? []).map((p: { id: string }) => p.id);
    const { data: ovB } = bProfileIds.length
      ? await service.from('content_overrides').select('id').in('profile_id', bProfileIds)
      : { data: [] as unknown[] };
    record('c B household overrides empty', (ovB?.length ?? 0) === 0, `${ovB?.length ?? 0} override(s) for B`);

    // g. change email for B: double-confirm via /auth/confirm (type=email_change) + people.email sync
    {
      const NEW_B = 'familyb-new@test.local';
      // clean any stale person row holding the target email (unique constraint)
      const { data: stale } = await service.from('people').select('id').eq('email', NEW_B).maybeSingle();
      if (stale) await service.from('people').delete().eq('id', stale.id);

      const t0 = Date.now();
      await B.page.goto(`${BASE}/account`);
      await B.page.fill('input[name="email"]', NEW_B);
      await B.page.click('button:has-text("Change email")');
      await B.page.waitForSelector('text=Confirmation links were sent to BOTH', { timeout: 20000 });

      // Both addresses get an email_change link; confirm each through the interstitial.
      for (const addr of [B_EMAIL, NEW_B]) {
        const link = await latestConfirmUrl(addr, t0);
        const okType = link.includes('type=email_change');
        record(`g email_change link for ${addr}`, okType, okType ? 'type=email_change present' : link);
        await B.page.goto(link);
        await B.page.waitForSelector('text=Continue to Albunyaan');
        await B.page.click('button:has-text("Continue to Albunyaan")');
        await B.page.waitForURL('**/account**', { timeout: 20000 });
      }

      const { data: authB } = await service.auth.admin.getUserById(userB.id);
      const { data: personB } = await service.from('people').select('email').eq('auth_user_id', userB.id).maybeSingle();
      record('g auth email updated after double confirm', authB.user?.email === NEW_B,
        `auth email now ${authB.user?.email}`);
      record('g people.email synced by confirm action', personB?.email === NEW_B,
        `people.email now ${personB?.email ?? '(no row)'}`);
    }

    // d. anonymous surface
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const { data: video } = await service.from('videos').select('slug').eq('status', 'published').limit(1).single();

      for (const [path, mustContain] of [['/', 'Albunyaan'], ['/catalog', 'Albunyaan'], [`/programs/${video!.slug}`, 'Albunyaan']] as const) {
        const resp = await page.goto(`${BASE}${path}`);
        const ok = resp!.status() === 200 && (await page.content()).includes(mustContain);
        record(`d anonymous 200: ${path}`, ok, `status ${resp!.status()}`);
      }
      // no profile chip in the header for anon
      const chip = await page.locator('header a[href="/profiles"]').count();
      record('d anonymous has no active profile', chip === 0, chip === 0 ? 'no profile chip in header' : 'profile chip rendered for anon!');

      for (const path of ['/account', '/parents', '/profiles']) {
        await page.goto(`${BASE}${path}`);
        const redirected = page.url().includes('/login');
        record(`d anonymous ${path} → /login`, redirected, `landed on ${new URL(page.url()).pathname}`);
      }
      await ctx.close();
    }

    await A.ctx.close();
    await B.ctx.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  const width = Math.max(...results.map((r) => r.check.length));
  console.log('\n── summary ' + '─'.repeat(Math.max(1, width + 40 - 11)));
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check.padEnd(width)}  ${r.detail}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('e2e-member-auth crashed:', err);
  process.exit(1);
});
