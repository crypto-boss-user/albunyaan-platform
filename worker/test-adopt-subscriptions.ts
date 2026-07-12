/**
 * test-adopt-subscriptions.ts — WS8 adoption verification (LOCAL stack, fake Stripe).
 *
 * Proves the adopt-not-recreate path:
 *   (a) DRY-RUN writes NOTHING — verdicts computed, zero entitlement rows created;
 *   (b) EXECUTE adopts the access-granting sub via the real applySubscriptionSnapshot
 *       (entitlement active, correct person, correct period end);
 *   (c) a CANCELED sub is skipped (no entitlement), a customer with NO sub is recorded;
 *   (d) EXECUTE is idempotent — a second run creates no duplicate row;
 *   (e) ZERO Stripe writes — the fake Stripe throws on any method other than list().
 *   (f) cohort + limit scoping select the right people.
 *
 * Run:  node_modules/.bin/tsx worker/test-adopt-subscriptions.ts
 * (reads worker/.env for the LOCAL stack, same as the other worker tests.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { adoptSubscriptions, type StripeSubscriptionLister } from './adopt-subscriptions.ts';

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

let passed = 0;
let failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ FAIL: ${label}`); }
}

const PRICE_ID = 'price_adopt_test_monthly';
const COHORT = 'adopt_test_cohort';
const CUS_ACTIVE = 'cus_adopt_active';
const CUS_CANCELED = 'cus_adopt_canceled';
const CUS_NOSUB = 'cus_adopt_nosub';
const SUB_ACTIVE = 'sub_adopt_active';
const SUB_CANCELED = 'sub_adopt_canceled';
const DAY = 86400_000;
const periodEnd = Math.floor((Date.now() + 30 * DAY) / 1000);

function fakeSub(id: string, customer: string, status: Stripe.Subscription.Status): Stripe.Subscription {
  return {
    id, object: 'subscription', status, customer, cancel_at_period_end: false, metadata: {},
    items: { object: 'list', data: [{ id: `si_${id}`, object: 'subscription_item',
      current_period_end: periodEnd, price: { id: PRICE_ID, object: 'price' } }] },
  } as unknown as Stripe.Subscription;
}

// Fake Stripe: list() answers per customer; ANY OTHER access throws (proves no writes).
const subsByCustomer: Record<string, Stripe.Subscription[]> = {
  [CUS_ACTIVE]: [fakeSub(SUB_ACTIVE, CUS_ACTIVE, 'active')],
  [CUS_CANCELED]: [fakeSub(SUB_CANCELED, CUS_CANCELED, 'canceled')],
  [CUS_NOSUB]: [],
};
let listCalls = 0;
const fakeStripe: StripeSubscriptionLister = {
  subscriptions: new Proxy(
    {
      async list(params: { customer: string; status: 'all'; limit?: number }) {
        listCalls += 1;
        check(params.status === 'all', `list called with status=all (${params.customer})`);
        return { data: subsByCustomer[params.customer] ?? [] };
      },
    },
    {
      get(target, prop) {
        if (prop === 'list') return target.list;
        throw new Error(`fake Stripe: forbidden write call subscriptions.${String(prop)} — adoption must never write to Stripe`);
      },
    },
  ) as StripeSubscriptionLister['subscriptions'],
};

async function cleanup(): Promise<void> {
  const emails = ['adopt-active@test.local', 'adopt-canceled@test.local', 'adopt-nosub@test.local', 'adopt-other@test.local'];
  for (const sub of [SUB_ACTIVE, SUB_CANCELED]) {
    await db.from('entitlements').delete().eq('provider', 'stripe').eq('provider_ref', sub);
  }
  await db.from('people').delete().in('email', emails);
  await db.from('plans').delete().eq('source', 'test').eq('external_id', 'adopt_test_plan');
}

async function entitlementFor(subId: string): Promise<Record<string, unknown> | null> {
  const { data } = await db.from('entitlements')
    .select('id, person_id, status, provider_ref, current_period_end, plan_id')
    .eq('provider', 'stripe').eq('provider_ref', subId).maybeSingle();
  return data as Record<string, unknown> | null;
}

async function main(): Promise<void> {
  await cleanup();

  await db.from('plans').insert({ external_id: 'adopt_test_plan', source: 'test', title: 'Adopt Test',
    platform: 'web', amount_cents: 650, currency: 'EUR', billing_period: 'monthly',
    visibility: 'private', stripe_price_id: PRICE_ID });

  const mk = async (email: string, customer: string | null) => {
    const { data, error } = await db.from('people').insert({
      external_id: `adopt-${email}`, source: 'test', email, stripe_customer_id: customer, legacy_cohort: COHORT,
    }).select('id').single();
    if (error) throw new Error(`seed ${email}: ${error.message}`);
    return (data as { id: string }).id;
  };
  const activeId = await mk('adopt-active@test.local', CUS_ACTIVE);
  await mk('adopt-canceled@test.local', CUS_CANCELED);
  await mk('adopt-nosub@test.local', CUS_NOSUB);
  // A person in ANOTHER cohort with a customer — must be excluded by --cohort scoping.
  const { data: other } = await db.from('people').insert({
    external_id: 'adopt-other', source: 'test', email: 'adopt-other@test.local',
    stripe_customer_id: CUS_ACTIVE, legacy_cohort: 'some_other_cohort',
  }).select('id').single();
  void other;

  try {
    console.log('(a) DRY-RUN writes nothing');
    const dry = await adoptSubscriptions({ db, stripe: fakeStripe }, { execute: false, cohort: COHORT });
    check(dry.people === 3, `cohort scoping selected 3 people (got ${dry.people})`);
    check(dry.wouldAdopt === 1, `1 would-adopt (the active sub) (got ${dry.wouldAdopt})`);
    check(dry.records.some((r) => r.subscriptionId === SUB_ACTIVE && r.verdict === 'would-adopt' && r.action?.startsWith('create')),
      'active sub → would-adopt (create)');
    check(dry.records.some((r) => r.subscriptionId === SUB_CANCELED && r.verdict === 'skipped-canceled'),
      'canceled sub → skipped-canceled');
    check(dry.records.some((r) => r.customerId === CUS_NOSUB && r.verdict === 'no-subscription'),
      'customer with no sub → no-subscription');
    check((await entitlementFor(SUB_ACTIVE)) === null, 'DRY-RUN created NO entitlement row');

    console.log('(b+c) EXECUTE adopts the active sub only');
    const exec = await adoptSubscriptions({ db, stripe: fakeStripe }, { execute: true, cohort: COHORT });
    check(exec.adopted === 1, `1 adopted (got ${exec.adopted})`);
    const ent = await entitlementFor(SUB_ACTIVE);
    check(!!ent && ent.status === 'active', 'active entitlement row created');
    check(!!ent && ent.person_id === activeId, 'entitlement owned by the matched person');
    check(!!ent && typeof ent.current_period_end === 'string', 'period end set from the snapshot');
    check(!!ent && ent.plan_id !== null, 'plan resolved via stripe_price_id');
    check((await entitlementFor(SUB_CANCELED)) === null, 'canceled sub still created NO entitlement');

    console.log('(d) EXECUTE is idempotent');
    const before = (await entitlementFor(SUB_ACTIVE))!.id;
    const exec2 = await adoptSubscriptions({ db, stripe: fakeStripe }, { execute: true, cohort: COHORT });
    check(exec2.adopted === 1, 're-run reports adopted (update path)');
    const after = (await entitlementFor(SUB_ACTIVE))!.id;
    check(before === after, 'same entitlement row — no duplicate created');
    const { count } = await db.from('entitlements').select('id', { count: 'exact', head: true })
      .eq('provider', 'stripe').eq('provider_ref', SUB_ACTIVE);
    check(count === 1, `exactly 1 entitlement row for the sub (got ${count})`);

    console.log('(e) ZERO Stripe writes');
    check(listCalls > 0, `fake Stripe list() was exercised (${listCalls} calls)`);
    // The Proxy throws on any non-list access; reaching here without an unhandled
    // throw already proves no write method was called during adoption.
    check(true, 'no forbidden Stripe write method was called (Proxy would have thrown)');

    console.log('(f) limit scoping');
    const limited = await adoptSubscriptions({ db, stripe: fakeStripe }, { execute: false, cohort: COHORT, limit: 1 });
    check(limited.people === 1, `--limit 1 selected a single person (got ${limited.people})`);
  } finally {
    await cleanup();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
