/**
 * test-pin-hardening.ts — WS3/0009 verification against the LOCAL Supabase stack.
 *
 * Proves the PIN brute-force hardening:
 *   (a) hashPin emits salted scrypt (scrypt$<salt>$<hash>, random per call);
 *   (b) legacy bare-SHA-256 hashes still verify, and a successful verify
 *       transparently REHASHES them to salted scrypt;
 *   (c) wrong guesses count up; the 5th consecutive miss locks the household
 *       for 15 minutes — even the CORRECT PIN is rejected while locked;
 *   (d) the attempt slot is reserved atomically in the DB: a burst of 8
 *       CONCURRENT wrong guesses gets exactly 5 real tries, never 8 (the
 *       serverless read-check-write race this design exists to kill);
 *   (e) an expired lock restarts the window; success resets the counters;
 *   (f) setPin replaces the hash AND clears any lock/attempt state;
 *   (g) a household without a PIN can never verify and never locks.
 *
 * Run:  node_modules/.bin/tsx worker/test-pin-hardening.ts
 * (loads worker/.env itself when SUPABASE_URL is not already exported)
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { hashPin, setPin, verifyPin, type PinVerdict } from '@albunyaan/core/data';

// ── env: fall back to worker/.env (local stack) ─────────────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = path.join(import.meta.dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// ── tiny assertion harness ───────────────────────────────────────────────────
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

const PIN = '4321';
const WRONG = '0000';
const legacyHash = createHash('sha256').update(PIN).digest('hex');

interface HouseholdState {
  pin_hash: string;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
}

async function stateOf(id: string): Promise<HouseholdState> {
  const { data, error } = await db
    .from('households')
    .select('pin_hash, pin_failed_attempts, pin_locked_until')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as HouseholdState;
}

async function main(): Promise<void> {
  // fixtures: one legacy-hash household, one PIN-less household
  const { data: h, error: hErr } = await db
    .from('households')
    .insert({ name: 'PIN-hardening test household', pin_hash: legacyHash })
    .select('id')
    .single();
  if (hErr) throw hErr;
  const hid = (h as { id: string }).id;

  const { data: n, error: nErr } = await db
    .from('households')
    .insert({ name: 'PIN-less test household', pin_hash: '' })
    .select('id')
    .single();
  if (nErr) throw nErr;
  const nid = (n as { id: string }).id;

  try {
    console.log('(a) hashPin format');
    const h1 = hashPin(PIN);
    const h2 = hashPin(PIN);
    check(h1.startsWith('scrypt$') && h1.split('$').length === 3, 'scrypt$<salt>$<hash> format');
    check(h1 !== h2, 'salt is random — same PIN hashes differently per call');

    console.log('(g) PIN-less household');
    const noPin = await verifyPin(nid, PIN);
    check(!noPin.ok && noPin.reason === 'no-pin', "empty pin_hash → 'no-pin'");
    check((await stateOf(nid)).pin_failed_attempts === 0, 'no-pin path never consumes an attempt');

    console.log('(b) legacy SHA-256 verify + rehash');
    const miss = await verifyPin(hid, WRONG);
    check(!miss.ok && miss.reason === 'invalid', "wrong guess → 'invalid'");
    check((await stateOf(hid)).pin_failed_attempts === 1, 'wrong guess consumed one attempt');
    const hit = await verifyPin(hid, PIN);
    check(hit.ok, 'correct PIN verifies against legacy hash');
    const upgraded = await stateOf(hid);
    check(upgraded.pin_hash.startsWith('scrypt$'), 'legacy hash REHASHED to salted scrypt on success');
    check(upgraded.pin_failed_attempts === 0 && upgraded.pin_locked_until === null, 'success reset the window');

    console.log('(b2) scrypt verify');
    const missS = await verifyPin(hid, WRONG);
    check(!missS.ok && missS.reason === 'invalid', 'wrong guess vs scrypt → invalid');
    const hitS = await verifyPin(hid, PIN);
    check(hitS.ok, 'correct PIN verifies against scrypt hash');

    console.log('(d) concurrent burst — the race this design kills');
    await db.from('households').update({ pin_failed_attempts: 0, pin_locked_until: null }).eq('id', hid);
    const burst: PinVerdict[] = await Promise.all(
      Array.from({ length: 8 }, () => verifyPin(hid, WRONG)),
    );
    const invalids = burst.filter((v) => !v.ok && v.reason === 'invalid').length;
    const lockeds = burst.filter((v) => !v.ok && v.reason === 'locked').length;
    check(invalids === 5, `burst of 8 got exactly 5 real tries (got ${invalids})`);
    check(lockeds === 3, `remaining 3 were refused as locked (got ${lockeds})`);
    const lockedState = await stateOf(hid);
    check(lockedState.pin_failed_attempts === 5, 'counter stopped at 5');
    check(
      lockedState.pin_locked_until !== null && new Date(lockedState.pin_locked_until).getTime() > Date.now(),
      'lockout timestamp set in the future',
    );

    console.log('(c) locked household rejects even the CORRECT PIN');
    const lockedHit = await verifyPin(hid, PIN);
    check(!lockedHit.ok && lockedHit.reason === 'locked', "correct PIN while locked → 'locked'");
    check(!lockedHit.ok && lockedHit.lockedUntil !== null, 'locked verdict carries locked_until for UI');

    console.log('(e) expired lock restarts the window');
    await db
      .from('households')
      .update({ pin_locked_until: new Date(Date.now() - 1000).toISOString() })
      .eq('id', hid);
    const afterExpiry = await verifyPin(hid, PIN);
    check(afterExpiry.ok, 'correct PIN verifies once the lock expires');
    const cleared = await stateOf(hid);
    check(cleared.pin_failed_attempts === 0 && cleared.pin_locked_until === null, 'window fully reset');

    console.log('(f) setPin replaces hash + clears lock state');
    await db
      .from('households')
      .update({ pin_failed_attempts: 3, pin_locked_until: new Date(Date.now() + 60_000).toISOString() })
      .eq('id', hid);
    await setPin(hid, '9876');
    const reset = await stateOf(hid);
    check(reset.pin_hash.startsWith('scrypt$'), 'new PIN stored as salted scrypt');
    check(reset.pin_failed_attempts === 0 && reset.pin_locked_until === null, 'setPin cleared attempt/lock state');
    check((await verifyPin(hid, '9876')).ok, 'new PIN verifies');
    const oldPin = await verifyPin(hid, PIN);
    check(!oldPin.ok && oldPin.reason === 'invalid', 'old PIN no longer verifies');
  } finally {
    await db.from('households').delete().in('id', [hid, nid]);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
