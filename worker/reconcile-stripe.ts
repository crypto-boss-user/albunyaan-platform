/**
 * reconcile-stripe.ts — drift detector between Stripe (truth for provider
 * 'stripe') and our `entitlements` table. READ-ONLY by default.
 *
 * Pages through ALL Stripe subscriptions (status all) and diffs against
 * entitlements (provider 'stripe'):
 *   - missing_entitlement : sub should have a row, none exists
 *   - unexpected_row      : sub maps to 'ignore' (incomplete) but a row exists
 *   - stale_status        : row status ≠ mapped fresh status
 *   - stale_period_end    : row period end ≠ item-max period end (>60s off)
 *   - stale_cancel_flag   : cancel_at_period_end differs
 *   - orphan_entitlement  : row's provider_ref not among the account's subs
 *
 * Exit 1 on any drift (cron-friendly). --fix applies the SAME upsert path the
 * webhook uses (applySubscriptionSnapshot from apps/web/lib/stripe-apply.ts)
 * for every sub-side drift; orphans are reported only — they mean a foreign
 * provider_ref and need a human.
 *
 * Run:
 *   set -a; . ~/.albunyaan-cc/stripe.env; . worker/.env; set +a
 *   node_modules/.bin/tsx worker/reconcile-stripe.ts [--fix]
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  applySubscriptionSnapshot,
  mapStripeSubStatus,
  subscriptionPeriodEnd,
} from '../apps/web/lib/stripe-apply.ts';

const FIX = process.argv.includes('--fix');

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error(
    'reconcile-stripe: STRIPE_SECRET_KEY is not set.\n' +
      'Source the founder key first:  set -a; . ~/.albunyaan-cc/stripe.env; . worker/.env; set +a',
  );
  process.exit(1);
}
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('reconcile-stripe: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — source worker/.env.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { maxNetworkRetries: 3 });
const db = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

interface EntitlementLite {
  id: string;
  provider_ref: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

interface Drift {
  kind:
    | 'missing_entitlement'
    | 'unexpected_row'
    | 'stale_status'
    | 'stale_period_end'
    | 'stale_cancel_flag'
    | 'orphan_entitlement';
  subscription: string;
  stripe: string;
  ours: string;
  fixable: boolean;
}

/** All stripe-provider entitlements, paged (Supabase REST clamps big ranges). */
async function loadStripeEntitlements(): Promise<Map<string, EntitlementLite>> {
  const byRef = new Map<string, EntitlementLite>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('entitlements')
      .select('id, provider_ref, status, cancel_at_period_end, current_period_end')
      .eq('provider', 'stripe')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`entitlements page @${from}: ${error.message}`);
    for (const row of (data ?? []) as EntitlementLite[]) {
      if (row.provider_ref) byRef.set(row.provider_ref, row);
    }
    if (!data || data.length < PAGE) break;
  }
  return byRef;
}

function isoClose(a: string | null, b: string | null, toleranceMs = 60_000): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= toleranceMs;
}

async function main(): Promise<void> {
  console.log(`── reconcile-stripe (${FIX ? '--fix: drift will be repaired' : 'read-only'}) ──`);

  const byRef = await loadStripeEntitlements();
  console.log(`entitlements (provider stripe): ${byRef.size}`);

  const drifts: Drift[] = [];
  const subsById = new Map<string, Stripe.Subscription>();

  for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    subsById.set(sub.id, sub);
    const expected = mapStripeSubStatus(sub.status);
    const row = byRef.get(sub.id);

    if (expected === 'ignore') {
      if (row) {
        drifts.push({ kind: 'unexpected_row', subscription: sub.id, stripe: sub.status, ours: row.status, fixable: false });
      }
      continue;
    }
    if (!row) {
      drifts.push({ kind: 'missing_entitlement', subscription: sub.id, stripe: expected, ours: '(none)', fixable: true });
      continue;
    }
    if (row.status !== expected) {
      drifts.push({ kind: 'stale_status', subscription: sub.id, stripe: expected, ours: row.status, fixable: true });
    }
    const freshEnd = subscriptionPeriodEnd(sub);
    if (!isoClose(row.current_period_end, freshEnd)) {
      drifts.push({
        kind: 'stale_period_end',
        subscription: sub.id,
        stripe: freshEnd ?? '(null)',
        ours: row.current_period_end ?? '(null)',
        fixable: true,
      });
    }
    if (row.cancel_at_period_end !== (sub.cancel_at_period_end ?? false)) {
      drifts.push({
        kind: 'stale_cancel_flag',
        subscription: sub.id,
        stripe: String(sub.cancel_at_period_end ?? false),
        ours: String(row.cancel_at_period_end),
        fixable: true,
      });
    }
  }
  console.log(`stripe subscriptions (all statuses): ${subsById.size}`);

  for (const [ref, row] of byRef) {
    if (!subsById.has(ref)) {
      drifts.push({ kind: 'orphan_entitlement', subscription: ref, stripe: '(no such subscription)', ours: row.status, fixable: false });
    }
  }

  if (drifts.length === 0) {
    console.log('✓ no drift — entitlements match Stripe.');
    return;
  }

  console.log(`\n✗ ${drifts.length} drift(s):`);
  console.table(drifts);

  if (!FIX) {
    console.log('read-only run — rerun with --fix to repair the fixable rows.');
    process.exit(1);
  }

  // --fix: same upsert path as the webhook, from the FRESH list snapshots.
  const fixTargets = [...new Set(drifts.filter((d) => d.fixable).map((d) => d.subscription))];
  let fixed = 0;
  let failed = 0;
  for (const subId of fixTargets) {
    const sub = subsById.get(subId);
    if (!sub) continue;
    const result = await applySubscriptionSnapshot(sub);
    if (result.ok) {
      fixed += 1;
      console.log(`  fixed: ${result.action}`);
    } else {
      failed += 1;
      console.error(`  FAILED: ${subId}: ${result.error}`);
    }
  }
  const unfixable = drifts.filter((d) => !d.fixable).length;
  console.log(`fix summary: ${fixed} repaired, ${failed} failed, ${unfixable} need a human (orphans/unexpected rows).`);
  if (failed > 0 || unfixable > 0) process.exit(1);
}

main().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error('reconcile-stripe failed:', msg.split(stripeKey!).join('[redacted]'));
  process.exit(1);
});
