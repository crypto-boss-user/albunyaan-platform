import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import type { Browser, BrowserContext } from '@playwright/test';

/**
 * Ingelogde admin-sessie voor de structuurtests (AD 1.1, founder-ja 2026-09-06 op het test-adminaccount `admin-test`).
 * Leest uit apps/web/.env.local (gitignored): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_TEST_EMAIL, ADMIN_TEST_TOTP_SECRET.
 * Flow = de echte app-flow: magic-link token_hash via de admin-API (generateLink verstuurt GEEN e-mail) → /auth/confirm → Continue →
 * /admin/mfa → TOTP-code (RFC 6238, zelfde functie als worker/e2e-admin-gate.ts) → aal2. Waarden worden nooit gelogd.
 */
function env(): Record<string, string> {
  const file = process.env.E2E_ENV_FILE ?? '.env.local';
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', '..', file), 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_TEST_EMAIL', 'ADMIN_TEST_TOTP_SECRET']) {
    if (!(process.env[k] ?? out[k])) throw new Error(`${k} ontbreekt in ${file} (admin-test, zie docs/cutover-runbook.md)`);
    out[k] = process.env[k] ?? out[k];
  }
  return out;
}

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret: string, atMs = Date.now()): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (bin % 1_000_000).toString().padStart(6, '0');
}

/** Nieuwe browsercontext met een aal2-adminsessie (admin-test). De aanroeper sluit de context. */
export async function loginAsAdmin(browser: Browser, baseURL = process.env.BASE_URL ?? 'http://localhost:3012'): Promise<BrowserContext> {
  const e = env();
  const res = await fetch(`${e.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: e.ADMIN_TEST_EMAIL }),
  });
  if (!res.ok) throw new Error(`generate_link → ${res.status}`);
  const { hashed_token } = (await res.json()) as { hashed_token: string };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();
  await page.goto(`${baseURL}/auth/confirm?token_hash=${encodeURIComponent(hashed_token)}&type=magiclink&next=/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/confirm'), { timeout: 60_000 });
  await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' });
  if (/\/admin\/mfa$/.test(page.url())) {
    // grensmarge: een code van seconde 28–29 kan verlopen vóór de submit (koude review AD 1.1) → even wachten op het volgende venster
    const rest = 30 - (Math.floor(Date.now() / 1000) % 30);
    if (rest <= 3) await page.waitForTimeout((rest + 1) * 1000);
    await page.fill('input[name="code"]', totp(e.ADMIN_TEST_TOTP_SECRET));
    await page.getByRole('button', { name: /unlock/i }).click();
    await page.waitForURL((u) => u.pathname === '/admin', { timeout: 60_000 });
  }
  if (new URL(page.url()).pathname !== '/admin') throw new Error(`admin-login eindigde op ${new URL(page.url()).pathname}`);
  await page.close();
  return ctx;
}
