/**
 * e2e-playback-gate.ts — WS5 entitlement-gate verification (LOCAL stack only).
 *
 * Drives the real web app in a real browser and proves all four gate states:
 *   1. anonymous + subscription video → Paywall, and the page HTML carries NO
 *      embed URL / bunny_video_id (the WS5 phase-gate invariant);
 *   2. anonymous + free video (live channel) → no paywall;
 *   3. logged-in member WITHOUT entitlement → 'renew' paywall, still no embed;
 *   4. member WITH an active entitlement → signed player iframe
 *      (?token=&expires= present — server must have BUNNY_EMBED_TOKEN_KEY).
 *
 * Run (dev server with local env + BUNNY_EMBED_TOKEN_KEY must be up):
 *   BASE_URL=http://localhost:3012 node_modules/.bin/tsx worker/e2e-playback-gate.ts
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

const BASE = process.env.BASE_URL ?? 'http://localhost:3012';
const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`refusing to run against non-local Supabase: ${url}`);
  process.exit(2);
}
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

const EMAIL = 'gate-e2e@test.local';
const SUB_SLUG = 'the-journey-to-the-high-morals-episode-1';
const FREE_SLUG = 'sharjah-quran-live-tv';
const FAKE_GUID = '00000000-e2e0-4000-8000-00000000e2e0';

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

async function cleanup(): Promise<void> {
  const { data: person } = await service.from('people').select('id, auth_user_id').eq('email', EMAIL).maybeSingle();
  if (person) {
    await service.from('entitlements').delete().eq('person_id', person.id);
    await service.from('households').delete().eq('owner_person_id', person.id);
    if (person.auth_user_id) await service.auth.admin.deleteUser(person.auth_user_id).catch(() => {});
    await service.from('people').delete().eq('id', person.id);
  }
  await service.from('videos').update({ bunny_video_id: null }).eq('slug', SUB_SLUG);
}

async function main(): Promise<void> {
  await cleanup(); // stale rows from a previous crashed run

  const browser = await chromium.launch();
  try {
    // Dev-mode route compilation can take 20-30s on first hit, racing Playwright's
    // default 30s nav timeout. Pre-warm both routes so the graded navigations are
    // fast, and give navigations a generous ceiling regardless.
    const warm = await browser.newContext();
    const warmPage = await warm.newPage();
    warmPage.setDefaultNavigationTimeout(120_000);
    for (const slug of [SUB_SLUG, FREE_SLUG]) {
      await warmPage.goto(`${BASE}/programs/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await warmPage.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await warm.close();

    // ── 1+2: anonymous ───────────────────────────────────────────────────────
    const anon = await browser.newContext();
    anon.setDefaultNavigationTimeout(120_000);
    const anonPage = await anon.newPage();

    await service.from('videos').update({ bunny_video_id: FAKE_GUID }).eq('slug', SUB_SLUG);

    await anonPage.goto(`${BASE}/programs/${SUB_SLUG}`, { waitUntil: 'domcontentloaded' });
    const anonHtml = await anonPage.content();
    check(anonHtml.includes('Members only'), 'anon + subscription video → paywall rendered');
    check(!anonHtml.includes('iframe.mediadelivery.net'), 'anon page HTML has NO embed URL');
    check(!anonHtml.includes(FAKE_GUID), 'anon page HTML has NO bunny_video_id');
    check(anonHtml.includes('/join'), 'paywall links to /join');

    await anonPage.goto(`${BASE}/programs/${FREE_SLUG}`, { waitUntil: 'domcontentloaded' });
    const freeHtml = await anonPage.content();
    check(!freeHtml.includes('Members only'), 'anon + FREE video → no paywall');
    await anon.close();

    // ── login: magic link via the /auth/confirm interstitial ────────────────
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: EMAIL,
    });
    if (linkErr) throw linkErr;
    const tokenHash = linkData.properties.hashed_token;

    const member = await browser.newContext();
    member.setDefaultNavigationTimeout(120_000);
    const memberPage = await member.newPage();
    await memberPage.goto(`${BASE}/auth/confirm?token_hash=${tokenHash}&type=email&next=/account`, {
      waitUntil: 'domcontentloaded',
    });
    await memberPage.getByRole('button', { name: /continue/i }).click();
    // Login BARRIER, not just a URL match: wait for the account page to prove the
    // session server-side (email rendered) before navigating on. Dev-mode compiles
    // run 10-30s cold, and moving on before the POST's Set-Cookie + follow-up GET
    // complete makes later navigations silently anonymous (burned once).
    await memberPage.waitForURL('**/account**', { timeout: 60_000 });
    await memberPage.waitForSelector(`text=${EMAIL}`, { timeout: 60_000 });
    check(true, 'member logged in via interstitial (/account shows the member)');

    const { data: person } = await service.from('people').select('id').eq('email', EMAIL).single();
    const personId = (person as { id: string }).id;

    // ── 3: member WITHOUT entitlement ────────────────────────────────────────
    await memberPage.goto(`${BASE}/programs/${SUB_SLUG}`, { waitUntil: 'domcontentloaded' });
    const lapsedHtml = await memberPage.content();
    check(lapsedHtml.includes('Members only'), 'member w/o entitlement → paywall');
    check(lapsedHtml.includes('isn’t active') || lapsedHtml.includes('isn&#x27;t active'), "…the 'renew' variant");
    check(!lapsedHtml.includes('iframe.mediadelivery.net'), 'still NO embed URL in HTML');

    // ── 4: member WITH active entitlement ────────────────────────────────────
    const { error: entErr } = await service.from('entitlements').insert({
      person_id: personId,
      provider: 'stripe',
      provider_ref: 'sub_gate_e2e',
      status: 'active',
      plan_id: null,
      current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
    });
    if (entErr) throw entErr;

    await memberPage.goto(`${BASE}/programs/${SUB_SLUG}`, { waitUntil: 'domcontentloaded' });
    const entitledHtml = await memberPage.content();
    check(!entitledHtml.includes('Members only'), 'entitled member → no paywall');
    const srcMatch = entitledHtml.match(/iframe\.mediadelivery\.net\/embed\/\d+\/[a-f0-9-]+\?[^"]*/);
    check(!!srcMatch, 'entitled member → player iframe rendered');
    check(!!srcMatch && /token=[a-f0-9]{64}/.test(srcMatch[0]) && /expires=\d{10}/.test(srcMatch[0]),
      'embed URL is SIGNED (token + expires present)');
    await member.close();
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
