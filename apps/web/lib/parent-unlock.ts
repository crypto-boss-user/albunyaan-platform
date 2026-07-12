/**
 * Signed parent-unlock token — pure Node (no Next imports) so the worker test
 * harness can exercise it directly. session.ts wraps it with cookie plumbing.
 *
 * Why signed: the unlock cookie used to hold the bare household id, and
 * httpOnly only stops READING a cookie — devtools (or any XSS) can still SET a
 * same-named one, so any kid who learned the id could mint the unlock. The
 * value is now `<householdId>.<expiresAtMs>.<hmac>`, verified server-side.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/** Parent-unlock lifetime — mintParentUnlock embeds it, the cookie maxAge mirrors it. */
export const PARENT_UNLOCK_TTL_SECONDS = 60 * 15;

/**
 * HMAC key derived (HKDF, versioned info string) from the service-role key:
 * the one high-entropy secret guaranteed present server-side in every
 * environment. Deriving avoids provisioning ANOTHER cross-env secret, and a
 * service-key compromise is already total, so this adds no new exposure.
 */
function parentUnlockKey(): Buffer {
  const master = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!master) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to sign parent-unlock cookies');
  return Buffer.from(hkdfSync('sha256', master, 'albn', 'albn-parent-unlock-v1', 32));
}

function mac(payload: string): Buffer {
  return createHmac('sha256', parentUnlockKey()).update(payload).digest();
}

/** Signed parent-unlock cookie value: `<householdId>.<expiresAtMs>.<mac>`. */
export function mintParentUnlock(householdId: string, ttlSeconds: number = PARENT_UNLOCK_TTL_SECONDS): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${householdId}.${exp}`;
  return `${payload}.${mac(payload).toString('base64url')}`;
}

/** Does `value` prove a live unlock of exactly `householdId`? (MAC first, then claims.) */
export function verifyParentUnlock(value: string | undefined, householdId: string): boolean {
  if (!value) return false;
  const [hid, expStr, macStr] = value.split('.');
  if (!hid || !expStr || !macStr) return false;
  const expected = mac(`${hid}.${expStr}`);
  const got = Buffer.from(macStr, 'base64url');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return false;
  const exp = Number(expStr);
  return hid === householdId && Number.isFinite(exp) && exp > Date.now();
}
