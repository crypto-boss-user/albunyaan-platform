/**
 * e2e-admin-crud.ts — WS7 admin CRUD verification (LOCAL only).
 *
 * Logs a real admin in (magic link + real computed TOTP, same as
 * e2e-admin-gate.ts) and drives all three admin sections in a real browser:
 *   videos:   search finds a seeded draft, publish toggle flips status in DB,
 *             detail edit form saves title/age-rating, audit log recorded both
 *   vouchers: mint a code, it appears in the list, disable removes the action
 *   members:  search finds a seeded member, detail shows their entitlement
 *
 * Run:  BASE_URL=http://localhost:3012 node_modules/.bin/tsx worker/e2e-admin-crud.ts
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
const otpClient = createClient(url, anonKey, {
  auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ FAIL: ${label}`); }
}

// ── RFC 6238 TOTP (same as e2e-admin-gate.ts) ────────────────────────────────
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

async function loginAndReachAal2(browser: Browser, email: string): Promise<{ ctx: BrowserContext; page: import('playwright').Page }> {
  const t0 = Date.now();
  const { error } = await otpClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw new Error(`signInWithOtp(${email}): ${error.message}`);
  const confirmUrl = await confirmUrlFromMail(email, t0);

  const ctx = await browser.newContext();
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();
  // Dev-mode compiles a route on first hit (can take 20-30s+); that blocks
  // navigation (covered by the nav timeout above) but fill/click have their
  // OWN separate actionability timeout — raise it too so a cold /admin/videos/[id]
  // hit doesn't fail a fill() that's really just waiting on the page to finish loading.
  page.setDefaultTimeout(60_000);
  await page.goto(confirmUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /continue/i }).click();
  // Barrier, not just a URL match: wait for /account to actually SHOW the
  // member's email (proves the session cookie landed), not just the route —
  // otherwise the next navigation can race the cookie and land anonymous
  // (same class of flake fixed in e2e-playback-gate.ts / e2e-member-auth.ts).
  await page.waitForURL('**/account**', { timeout: 60_000 });
  await page.waitForSelector(`text=${email}`, { timeout: 60_000 });

  // A freshly purged+recreated admin always has zero factors → /admin/mfa/enroll.
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const secret = (await page.locator('code').first().innerText()).replace(/\s+/g, '');
  await page.fill('input[name="code"]', totp(secret));
  await page.getByRole('button', { name: /verify/i }).click();
  await page.waitForURL((u) => u.pathname === '/admin', { timeout: 60_000 });
  return { ctx, page };
}

const ADMIN_EMAIL = 'crud-admin-e2e@test.local';
const MEMBER_EMAIL = 'crud-member-e2e@test.local';
const VIDEO_SLUG = 'e2e-admin-crud-video';

async function purge(): Promise<void> {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if ([ADMIN_EMAIL, MEMBER_EMAIL].includes((u.email ?? '').toLowerCase())) {
      await service.from('platform_admins').delete().eq('auth_user_id', u.id);
      await service.from('admin_audit_log').delete().eq('actor_auth_user_id', u.id);
      await service.auth.admin.deleteUser(u.id);
    }
  }
  await service.from('videos').delete().eq('slug', VIDEO_SLUG);
  await service.from('entitlements').delete().eq('provider_ref', 'sub_crud_e2e');
  await service.from('people').delete().eq('email', MEMBER_EMAIL);
  await service.from('vouchers').delete().eq('sponsor_label', 'e2e-crud-test');
  await service.from('plans').delete().eq('external_id', 'crud_e2e_plan');
}

async function main(): Promise<void> {
  await purge();

  const { data: adminU } = await service.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true });
  await service.from('platform_admins').insert({ auth_user_id: adminU!.user.id, role: 'owner', note: 'e2e-crud' });

  const { data: video, error: vErr } = await service.from('videos').insert({
    external_id: 'e2e-admin-crud', source: 'test', title: 'E2E Admin CRUD Draft Video', slug: VIDEO_SLUG,
    status: 'draft', access: 'subscription', age_rating: 'all',
  }).select('id').single();
  if (vErr) throw new Error(`seed video: ${vErr.message}`);
  const videoId = (video as { id: string }).id;

  const { data: plan } = await service.from('plans').insert({
    external_id: 'crud_e2e_plan', source: 'test', title: 'CRUD E2E Plan', platform: 'web',
    amount_cents: 650, currency: 'EUR', billing_period: 'monthly', visibility: 'private',
  }).select('id').single();
  const { data: memberPerson } = await service.from('people').insert({
    external_id: 'crud-member-e2e', source: 'test', email: MEMBER_EMAIL, full_name: 'CRUD E2E Member',
  }).select('id').single();
  await service.from('entitlements').insert({
    person_id: (memberPerson as { id: string }).id, plan_id: (plan as { id: string }).id,
    status: 'active', provider: 'stripe', provider_ref: 'sub_crud_e2e',
    current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });

  const browser = await chromium.launch();
  try {
    const { page } = await loginAndReachAal2(browser, ADMIN_EMAIL);
    check(new URL(page.url()).pathname === '/admin', 'admin reached the dashboard (aal2)');

    // ── videos ────────────────────────────────────────────────────────────
    console.log('videos:');
    await page.goto(`${BASE}/admin/videos?q=${encodeURIComponent('E2E Admin CRUD')}`, { waitUntil: 'domcontentloaded' });
    check((await page.content()).includes('E2E Admin CRUD Draft Video'), 'search finds the seeded draft video');

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.waitForLoadState('networkidle');
    const { data: afterPublish } = await service.from('videos').select('status').eq('id', videoId).single();
    check((afterPublish as { status: string }).status === 'published', 'Publish button flipped status in DB');

    await page.goto(`${BASE}/admin/videos/${videoId}`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="title"]', 'E2E Admin CRUD Video (edited)');
    await page.selectOption('select[name="age_rating"]', '13+');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForSelector('text=Saved.', { timeout: 60_000 });
    const { data: afterEdit } = await service.from('videos').select('title, age_rating, age_rating_source').eq('id', videoId).single();
    const edited = afterEdit as { title: string; age_rating: string; age_rating_source: string };
    check(edited.title === 'E2E Admin CRUD Video (edited)', 'title edit saved');
    check(edited.age_rating === '13+' && edited.age_rating_source === 'human', 'age rating saved + provenance stamped human');

    const { count: auditCount } = await service.from('admin_audit_log').select('id', { count: 'exact', head: true })
      .eq('entity_id', videoId).eq('action', 'video.update');
    check((auditCount ?? 0) >= 2, `both edits audited (${auditCount} entries)`);

    // ── vouchers ──────────────────────────────────────────────────────────
    console.log('vouchers:');
    await page.goto(`${BASE}/admin/vouchers`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="durationDays"]', '30');
    await page.fill('input[name="sponsorLabel"]', 'e2e-crud-test');
    await page.getByRole('button', { name: 'Mint vouchers' }).click();
    await page.waitForSelector('code', { timeout: 60_000 });
    const mintedCode = (await page.locator('div.bg-brand-soft code').first().innerText()).trim();
    check(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(mintedCode), `a code was minted in the expected format (${mintedCode})`);

    await page.goto(`${BASE}/admin/vouchers`, { waitUntil: 'domcontentloaded' });
    check((await page.content()).includes(mintedCode), 'minted code appears in the list');
    const { data: voucherRow } = await service.from('vouchers').select('id, status').eq('code', mintedCode).single();
    check((voucherRow as { status: string }).status === 'active', 'voucher row created active in DB');

    const row = page.locator('tr', { hasText: mintedCode });
    await row.getByRole('button', { name: 'Disable' }).click();
    await page.waitForLoadState('networkidle');
    const { data: afterDisable } = await service.from('vouchers').select('status').eq('id', (voucherRow as { id: string }).id).single();
    check((afterDisable as { status: string }).status === 'disabled', 'Disable button updated status in DB');

    // ── members ───────────────────────────────────────────────────────────
    console.log('members:');
    await page.goto(`${BASE}/admin/members?q=${encodeURIComponent('crud-member-e2e')}`, { waitUntil: 'domcontentloaded' });
    check((await page.content()).includes(MEMBER_EMAIL), 'member search finds the seeded member');

    await page.click(`text=${MEMBER_EMAIL}`);
    await page.waitForSelector('text=Entitlements', { timeout: 60_000 }); // first hit of a fresh dev-mode route
    const detailHtml = await page.content();
    check(detailHtml.includes('Has access'), 'member detail shows active-access badge');
    check(detailHtml.includes('CRUD E2E Plan'), 'entitlement shows the correct plan');
    check(detailHtml.includes('sub_crud_e2e'), 'entitlement shows the Stripe subscription ref');
  } finally {
    await browser.close();
    await purge();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await purge().catch(() => {}); process.exit(1); });
