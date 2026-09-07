import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * AD 2.6 — inloglink: een beheerder komt na /auth/confirm (magic link zonder expliciete `next`) op /admin (of de MFA-stap ervan);
 * leden blijven naar /account (confirmAuthAction). Gebruikt de admin-test-account via generate_link (geen e-mail), zoals tests/lib/admin-login.ts.
 * Draait zonder gedeelde storageState: dit is een verse login in een eigen context.
 */
function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(path.resolve(__dirname, '..', process.env.E2E_ENV_FILE ?? '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

test.use({ storageState: { cookies: [], origins: [] } });

test('AD 2.6: beheerder → /admin na de inloglink zonder next (lid-pad /account = code-lezing, niet hier getest; worker/e2e-member-auth.ts dekt het)', async ({ page }) => {
  const e = env();
  test.skip(!e.ADMIN_TEST_EMAIL || !e.SUPABASE_SERVICE_ROLE_KEY, 'ADMIN_TEST_* ontbreekt');
  const res = await fetch(`${e.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: e.ADMIN_TEST_EMAIL }),
  });
  expect(res.ok).toBe(true);
  const { hashed_token } = (await res.json()) as { hashed_token: string };
  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(hashed_token)}&type=magiclink`);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/confirm'), { timeout: 60_000 });
  expect(new URL(page.url()).pathname).toMatch(/^\/admin(\/mfa)?$/); // beheerder: admin (aal1 → MFA-stap van de admin), niet /account
});
