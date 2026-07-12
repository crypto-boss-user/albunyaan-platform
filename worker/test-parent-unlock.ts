/**
 * test-parent-unlock.ts — WS3 verification of the signed parent-unlock token
 * (apps/web/lib/parent-unlock.ts). Pure crypto, no DB needed — only
 * SUPABASE_SERVICE_ROLE_KEY must be set (the HMAC key derives from it).
 *
 * Proves:
 *   (a) mint→verify round-trip for the right household;
 *   (b) the OLD cookie format (bare household id) no longer verifies — the
 *       exact forgery this change kills;
 *   (c) any tampering (household, expiry, MAC) breaks the token;
 *   (d) expiry is enforced server-side, not just via cookie maxAge;
 *   (e) tokens minted under a different service key don't verify (env
 *       separation: a preview-minted cookie is dead on prod).
 *
 * Run:  node_modules/.bin/tsx worker/test-parent-unlock.ts
 */
import fs from 'node:fs';
import path from 'node:path';

// ── env: fall back to worker/.env (local stack) ─────────────────────────────
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = path.join(import.meta.dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { mintParentUnlock, verifyParentUnlock } = await import('../apps/web/lib/parent-unlock.ts');

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

const HID = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';

const token = mintParentUnlock(HID);
const [hid, exp, mac] = token.split('.');

console.log('(a) round-trip');
check(token.split('.').length === 3 && hid === HID, 'token = <householdId>.<exp>.<mac>');
check(verifyParentUnlock(token, HID), 'valid token verifies for its household');

console.log('(b) the old format is dead');
check(!verifyParentUnlock(HID, HID), 'bare household id (pre-signing cookie) is rejected');

console.log('(c) tampering');
check(!verifyParentUnlock(token, OTHER), 'valid token for household A does not unlock household B');
check(!verifyParentUnlock(`${OTHER}.${exp}.${mac}`, OTHER), 'swapping the household id breaks the MAC');
check(!verifyParentUnlock(`${hid}.${Number(exp) + 60_000}.${mac}`, HID), 'extending the expiry breaks the MAC');
const flipped = mac[0] === 'A' ? 'B' : 'A';
check(!verifyParentUnlock(`${hid}.${exp}.${flipped}${mac.slice(1)}`, HID), 'flipping a MAC character is rejected');
check(!verifyParentUnlock(undefined, HID), 'missing cookie is rejected');
check(!verifyParentUnlock('', HID), 'empty cookie is rejected');
check(!verifyParentUnlock('garbage', HID), 'garbage cookie is rejected');

console.log('(d) server-side expiry');
check(!verifyParentUnlock(mintParentUnlock(HID, -1), HID), 'expired token is rejected even with a correct MAC');

console.log('(e) key separation across environments');
const realKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-completely-different-environment-key';
const foreign = mintParentUnlock(HID);
process.env.SUPABASE_SERVICE_ROLE_KEY = realKey;
check(!verifyParentUnlock(foreign, HID), 'token minted under another service key does not verify');
check(verifyParentUnlock(mintParentUnlock(HID), HID), 'own-key token still verifies after the swap');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
