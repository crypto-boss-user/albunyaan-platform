/**
 * test-stripe-apply.ts — WS4 verification against the LOCAL Supabase stack.
 * No Stripe account needed: the Stripe client is injected as a fake.
 *
 * Proves the locked architecture:
 *   (a) checkout.session.completed → entitlement active (granted at checkout,
 *       never waiting for invoice.paid);
 *   (b) API-refetch design: a stale retried 'active' event arriving AFTER
 *       cancellation does NOT resurrect access — the fake API returns
 *       'canceled' on refetch and the entitlement stays canceled;
 *   (b2) past_due snapshot keeps the last PAID period end — grace can't be
 *       extended by the already-advanced unpaid period;
 *   (c) SEPA grace: past_due within GRACE_DAYS_PAST_DUE keeps access, past
 *       the window loses it;
 *   (d) store-first dedupe: a duplicate of a PROCESSED event is a no-op (no
 *       second API refetch, row untouched);
 *   (e) replay: a stored-but-FAILED event is re-applied on redelivery, never
 *       silently dropped.
 *
 * Run:  node_modules/.bin/tsx worker/test-stripe-apply.ts
 * (loads worker/.env itself when SUPABASE_URL is not already exported)
 */
import fs from 'node:fs';
import path from 'node:path';
import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
// Static imports are safe: neither module touches env at import time
// (createServiceClient is lazy, first called inside the tests below).
import { ingestStripeEvent, type StripeSubscriptionFetcher } from '../apps/web/lib/stripe-apply.ts';
import { GRACE_DAYS_PAST_DUE, hasActiveEntitlement, isEntitlementActive } from '@albunyaan/core/data';

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

// ── fixtures ─────────────────────────────────────────────────────────────────
const SUB_ID = 'sub_ws4_test';
const CUS_ID = 'cus_ws4_test';
const PRICE_ID = 'price_ws4_test';
const EVENT_PREFIX = 'evt_ws4_';
const TEST_EMAIL = 'ws4-test+stripe@albunyaan.test';

const DAY = 24 * 60 * 60 * 1000;
const future = Math.floor((Date.now() + 30 * DAY) / 1000); // epoch seconds

function fakeSub(status: Stripe.Subscription.Status, personId: string, periodEnd: number = future): Stripe.Subscription {
  return {
    id: SUB_ID,
    object: 'subscription',
    status,
    customer: CUS_ID,
    cancel_at_period_end: false,
    metadata: { person_id: personId },
    items: {
      object: 'list',
      data: [
        {
          id: 'si_ws4_test',
          object: 'subscription_item',
          current_period_end: periodEnd, // v22: period end lives on ITEMS
          price: { id: PRICE_ID, object: 'price' },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

function fakeEvent(id: string, type: string, object: unknown): Stripe.Event {
  return {
    id,
    object: 'event',
    type,
    data: { object },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: '2026-06-24.dahlia',
  } as unknown as Stripe.Event;
}

/** Fake Stripe API: retrieve() answers from a mutable snapshot + counts calls. */
const apiState: { snapshot: Stripe.Subscription | null; retrieves: number } = { snapshot: null, retrieves: 0 };
const fakeStripe: StripeSubscriptionFetcher = {
  subscriptions: {
    async retrieve(id: string): Promise<Stripe.Subscription> {
      apiState.retrieves += 1;
      if (!apiState.snapshot || apiState.snapshot.id !== id) throw new Error(`fake stripe: no such subscription ${id}`);
      return apiState.snapshot;
    },
  },
};

// ── seed / cleanup ───────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  await db.from('stripe_events').delete().like('event_id', `${EVENT_PREFIX}%`);
  await db.from('entitlements').delete().eq('provider', 'stripe').eq('provider_ref', SUB_ID);
  await db.from('plans').delete().eq('source', 'test').eq('external_id', 'web_test_ws4');
  await db.from('people').delete().eq('source', 'test').eq('external_id', 'ws4-test-person');
}

async function seed(): Promise<{ personId: string; planId: string }> {
  const person = await db
    .from('people')
    .insert({ external_id: 'ws4-test-person', source: 'test', email: TEST_EMAIL, stripe_customer_id: CUS_ID })
    .select('id')
    .single();
  if (person.error) throw new Error(`seed person: ${person.error.message}`);
  const plan = await db
    .from('plans')
    .insert({
      external_id: 'web_test_ws4',
      source: 'test',
      title: 'WS4 Test Plan',
      platform: 'web',
      amount_cents: 650,
      currency: 'EUR',
      billing_period: 'monthly',
      visibility: 'private',
      stripe_price_id: PRICE_ID,
    })
    .select('id')
    .single();
  if (plan.error) throw new Error(`seed plan: ${plan.error.message}`);
  return { personId: (person.data as { id: string }).id, planId: (plan.data as { id: string }).id };
}

async function getEntitlement(): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from('entitlements')
    .select('id, person_id, plan_id, status, provider, provider_ref, cancel_at_period_end, current_period_end')
    .eq('provider', 'stripe')
    .eq('provider_ref', SUB_ID)
    .maybeSingle();
  if (error) throw new Error(`entitlement read: ${error.message}`);
  return data as Record<string, unknown> | null;
}

// ── the tests ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('── WS4 stripe-apply verification (local Supabase, fake Stripe) ──');
  await cleanup(); // idempotent reruns
  const { personId, planId } = await seed();

  try {
    // (a) checkout completed → entitlement active immediately
    console.log('(a) checkout.session.completed → active entitlement');
    apiState.snapshot = fakeSub('active', personId);
    const session = {
      id: 'cs_ws4_test',
      object: 'checkout.session',
      mode: 'subscription',
      subscription: SUB_ID,
      customer: CUS_ID,
      client_reference_id: personId,
    };
    const resA = await ingestStripeEvent(fakeEvent(`${EVENT_PREFIX}a`, 'checkout.session.completed', session), fakeStripe);
    check(resA.outcome === 'processed', `ingest outcome processed (got ${resA.outcome})`);
    const rowA = await getEntitlement();
    check(rowA !== null, 'entitlement row created');
    check(rowA?.status === 'active', `status active (got ${rowA?.status})`);
    check(rowA?.person_id === personId, 'person_id matches seeded person');
    check(rowA?.plan_id === planId, 'plan_id resolved via plans.stripe_price_id');
    check(typeof rowA?.current_period_end === 'string', 'current_period_end set from item (v22 shape)');
    check(await hasActiveEntitlement(personId), 'hasActiveEntitlement → true');
    const evtA = await db.from('stripe_events').select('status').eq('event_id', `${EVENT_PREFIX}a`).single();
    check(evtA.data?.status === 'processed', 'stripe_events row marked processed');

    // (b) refetch design: stale retried "active" event cannot resurrect a canceled sub
    console.log('(b) out-of-order retry — refetch truth wins');
    apiState.snapshot = fakeSub('canceled', personId);
    const resB1 = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}b1`, 'customer.subscription.updated', fakeSub('canceled', personId)),
      fakeStripe,
    );
    check(resB1.outcome === 'processed', 'cancel event processed');
    check((await getEntitlement())?.status === 'canceled', 'entitlement canceled after cancel event');

    // Stale retry: PAYLOAD claims active, but the API (refetch) says canceled.
    const resB2 = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}b2`, 'customer.subscription.updated', fakeSub('active', personId)),
      fakeStripe,
    );
    check(resB2.outcome === 'processed', 'stale event processed (stored + applied from refetch)');
    check(
      (await getEntitlement())?.status === 'canceled',
      'entitlement STAYS canceled — stale payload did not resurrect access',
    );
    check(!(await hasActiveEntitlement(personId)), 'hasActiveEntitlement → false when canceled');

    // (b2) past_due snapshot must NOT advance current_period_end into the unpaid
    // window — grace is anchored to the last PAID period end, not the fresh one.
    console.log('(b2) past_due snapshot keeps the last PAID period end');
    const paidEnd = Math.floor((Date.now() + 10 * DAY) / 1000); // last paid period ends in 10 days
    const advancedEnd = Math.floor((Date.now() + 40 * DAY) / 1000); // Stripe rolls it to +40 on the failed renewal
    apiState.snapshot = fakeSub('active', personId, paidEnd);
    await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}c0`, 'customer.subscription.updated', fakeSub('active', personId, paidEnd)),
      fakeStripe,
    );
    check(
      new Date((await getEntitlement())?.current_period_end as string).getTime() === paidEnd * 1000,
      'active snapshot writes the fresh period end',
    );
    apiState.snapshot = fakeSub('past_due', personId, advancedEnd);
    const resAnchor = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}c1`, 'customer.subscription.updated', fakeSub('past_due', personId, advancedEnd)),
      fakeStripe,
    );
    check(resAnchor.outcome === 'processed', 'past_due event processed');
    const rowAnchor = await getEntitlement();
    check(rowAnchor?.status === 'past_due', 'status past_due');
    check(
      new Date(rowAnchor?.current_period_end as string).getTime() === paidEnd * 1000,
      'past_due KEPT last-paid end (did not advance to the unpaid period)',
    );

    // (c) SEPA grace window for past_due
    console.log(`(c) past_due grace window (${GRACE_DAYS_PAST_DUE} days)`);
    const inGrace = new Date(Date.now() - 5 * DAY).toISOString();
    const pastGrace = new Date(Date.now() - (GRACE_DAYS_PAST_DUE + 6) * DAY).toISOString();
    await db.from('entitlements').update({ status: 'past_due', current_period_end: inGrace }).eq('provider', 'stripe').eq('provider_ref', SUB_ID);
    check(await hasActiveEntitlement(personId), 'past_due, period ended 5 days ago → access kept (grace)');
    await db.from('entitlements').update({ current_period_end: pastGrace }).eq('provider', 'stripe').eq('provider_ref', SUB_ID);
    check(!(await hasActiveEntitlement(personId)), `past_due, ended ${GRACE_DAYS_PAST_DUE + 6} days ago → access lost`);
    check(
      isEntitlementActive({ status: 'past_due', provider: 'stripe', current_period_end: new Date().toISOString() }),
      'isEntitlementActive pure fn: past_due ending now → true',
    );
    check(
      !isEntitlementActive({ status: 'canceled', provider: 'stripe', current_period_end: new Date(Date.now() + DAY).toISOString() }),
      'isEntitlementActive pure fn: canceled with future end → false',
    );

    // (d) duplicate event_id → no-op (store-first dedupe)
    console.log('(d) duplicate event_id → no-op');
    const before = await getEntitlement();
    const retrievesBefore = apiState.retrieves;
    const resD = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}b2`, 'customer.subscription.updated', fakeSub('active', personId)),
      fakeStripe,
    );
    check(resD.outcome === 'duplicate', `second ingest of same event_id → duplicate (got ${resD.outcome})`);
    check(apiState.retrieves === retrievesBefore, 'no API refetch on duplicate');
    const after = await getEntitlement();
    check(JSON.stringify(after) === JSON.stringify(before), 'entitlement row untouched by duplicate');

    // (e) replay: an event that STORED but FAILED transiently on first delivery
    // must be re-applied on redelivery — never silently dropped.
    console.log('(e) failed event is re-applied on redelivery');
    apiState.snapshot = null; // force the API refetch to throw → transient failure
    const resE1 = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}e`, 'customer.subscription.updated', fakeSub('active', personId)),
      fakeStripe,
    );
    check(resE1.outcome === 'failed', `first delivery fails transiently (got ${resE1.outcome})`);
    check(resE1.outcome === 'failed' && resE1.transient === true, 'failure flagged transient (route → 5xx, Stripe retries)');
    const evtE1 = await db.from('stripe_events').select('status').eq('event_id', `${EVENT_PREFIX}e`).single();
    check(evtE1.data?.status === 'failed', 'event row marked failed after first delivery');
    apiState.snapshot = fakeSub('active', personId); // API healthy on redelivery
    const resE2 = await ingestStripeEvent(
      fakeEvent(`${EVENT_PREFIX}e`, 'customer.subscription.updated', fakeSub('active', personId)),
      fakeStripe,
    );
    check(resE2.outcome === 'processed', `redelivery re-applies the failed event (got ${resE2.outcome})`);
    check((await getEntitlement())?.status === 'active', 'entitlement active after replay');
    const evtE2 = await db.from('stripe_events').select('status').eq('event_id', `${EVENT_PREFIX}e`).single();
    check(evtE2.data?.status === 'processed', 'event row now processed after replay');
  } finally {
    await cleanup();
    console.log('cleanup: seeded rows removed.');
  }

  console.log(`\n${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'}: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('test-stripe-apply crashed:', err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
