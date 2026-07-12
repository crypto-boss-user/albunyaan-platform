/**
 * adopt-subscriptions.ts — WS8 (redesigned): ADOPT existing Stripe subscriptions
 * into platform entitlements WITHOUT recreating them.
 *
 * The web cohort already pays through the foundation's OWN Stripe account (5
 * Zapier zaps bridge payment→Uscreen access today). Those subscriptions live in
 * our account and renew on their own mandates — so migration is NOT the old
 * cancel-and-recreate dance. It's adoption: for each member whose email matched
 * a Stripe customer (audit --backfill sets people.stripe_customer_id), read
 * their LIVE subscriptions and upsert an entitlement from each fresh snapshot,
 * through the SAME applySubscriptionSnapshot() the webhook uses (30/30 tests).
 *
 * INVARIANT: never writes to Stripe. Only subscriptions.list (a GET) is called;
 * every write lands in Supabase. Existing billing keeps running untouched.
 *
 * Dry-run by DEFAULT (prints per-person/per-sub verdicts, writes nothing).
 * --execute actually upserts entitlements. --limit N / --cohort <legacy_cohort>
 * scope a batch. Report → ~/.albunyaan-cc/adopt-subscriptions-report.json.
 *
 * Env (source ~/.albunyaan-cc/stripe.env + cloud.env first):
 *   STRIPE_SECRET_KEY  restricted key — READ scope is enough (we only read Stripe)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   set -a; . ~/.albunyaan-cc/stripe.env; . ~/.albunyaan-cc/cloud.env; set +a
 *   node_modules/.bin/tsx worker/adopt-subscriptions.ts [--execute] [--limit N] [--cohort uscreen_paying]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  applySubscriptionSnapshot,
  mapStripeSubStatus,
  subscriptionPeriodEnd,
} from '../apps/web/lib/stripe-apply.ts';

// ── injectable deps (the test drives these with a fake Stripe + local DB) ────

/** The slice of the Stripe client adoption needs — list only, never a write. */
export interface StripeSubscriptionLister {
  subscriptions: {
    list(params: { customer: string; status: 'all'; limit?: number }): Promise<{ data: Stripe.Subscription[] }>;
  };
}

/** access-granting entitlement statuses — the ones worth adopting. */
const ADOPTABLE = new Set(['active', 'trialing', 'past_due']);

export interface AdoptRecord {
  personId: string;
  email: string;
  customerId: string;
  subscriptionId: string | null;
  stripeStatus: string | null;
  mappedStatus: string | null;
  periodEnd: string | null;
  verdict:
    | 'would-adopt'      // dry-run: a create/update we WOULD make
    | 'adopted'          // execute: applied
    | 'skipped-canceled' // sub exists but grants no access
    | 'skipped-ignore'   // incomplete/not-yet-real subscription
    | 'no-subscription'  // customer has no subscriptions at all
    | 'error';
  action?: string;       // applySubscriptionSnapshot's action string, or a dry-run preview
  error?: string;
}

export interface AdoptOptions {
  execute: boolean;
  limit?: number;
  cohort?: string;
  /** Injected for tests; defaults to the real webhook applier. */
  applySnapshot?: typeof applySubscriptionSnapshot;
}

export interface AdoptSummary {
  people: number;
  wouldAdopt: number;
  adopted: number;
  skipped: number;
  errors: number;
  records: AdoptRecord[];
}

/** Read-only preview: does an entitlement already exist for this sub? */
async function entitlementExists(db: SupabaseClient, subId: string): Promise<boolean> {
  const { data, error } = await db
    .from('entitlements')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_ref', subId)
    .maybeSingle();
  if (error) throw new Error(`entitlement preview lookup failed for ${subId}: ${error.message}`);
  return Boolean(data);
}

/**
 * Core adoption pass — pure of CLI/env so the test can inject a fake Stripe and
 * assert (a) correct verdicts, (b) ZERO Stripe writes, (c) idempotent re-runs.
 */
export async function adoptSubscriptions(
  deps: { db: SupabaseClient; stripe: StripeSubscriptionLister },
  opts: AdoptOptions,
): Promise<AdoptSummary> {
  const { db, stripe } = deps;
  const apply = opts.applySnapshot ?? applySubscriptionSnapshot;

  let query = db
    .from('people')
    .select('id, email, stripe_customer_id, legacy_cohort')
    .not('stripe_customer_id', 'is', null)
    .order('created_at');
  if (opts.cohort) query = query.eq('legacy_cohort', opts.cohort);
  if (opts.limit) query = query.limit(opts.limit);

  const { data: people, error } = await query;
  if (error) throw new Error(`people query failed: ${error.message}`);

  const records: AdoptRecord[] = [];

  for (const person of (people ?? []) as Array<{ id: string; email: string; stripe_customer_id: string }>) {
    const base = { personId: person.id, email: person.email, customerId: person.stripe_customer_id };
    let subs: Stripe.Subscription[];
    try {
      const res = await stripe.subscriptions.list({ customer: person.stripe_customer_id, status: 'all', limit: 100 });
      subs = res.data;
    } catch (err) {
      records.push({ ...base, subscriptionId: null, stripeStatus: null, mappedStatus: null, periodEnd: null,
        verdict: 'error', error: err instanceof Error ? err.message : String(err) });
      continue;
    }

    if (subs.length === 0) {
      records.push({ ...base, subscriptionId: null, stripeStatus: null, mappedStatus: null, periodEnd: null,
        verdict: 'no-subscription' });
      continue;
    }

    for (const sub of subs) {
      const mapped = mapStripeSubStatus(sub.status);
      const periodEnd = subscriptionPeriodEnd(sub);
      const rec: AdoptRecord = { ...base, subscriptionId: sub.id, stripeStatus: sub.status,
        mappedStatus: mapped === 'ignore' ? null : mapped, periodEnd, verdict: 'error' };

      if (mapped === 'ignore') { rec.verdict = 'skipped-ignore'; records.push(rec); continue; }
      if (!ADOPTABLE.has(mapped)) { rec.verdict = 'skipped-canceled'; records.push(rec); continue; }

      if (!opts.execute) {
        const exists = await entitlementExists(db, sub.id);
        rec.verdict = 'would-adopt';
        rec.action = `${exists ? 'update' : 'create'} entitlement → ${mapped} (period end ${periodEnd ?? 'n/a'})`;
        records.push(rec);
        continue;
      }

      // clientReferenceId = the email-matched person id; applySubscriptionSnapshot
      // validates it exists before using it to create a new entitlement row.
      const result = await apply(sub, { clientReferenceId: person.id });
      if (result.ok) { rec.verdict = 'adopted'; rec.action = result.action; }
      else { rec.verdict = 'error'; rec.error = result.error; }
      records.push(rec);
    }
  }

  return {
    people: (people ?? []).length,
    wouldAdopt: records.filter((r) => r.verdict === 'would-adopt').length,
    adopted: records.filter((r) => r.verdict === 'adopted').length,
    skipped: records.filter((r) => r.verdict.startsWith('skipped') || r.verdict === 'no-subscription').length,
    errors: records.filter((r) => r.verdict === 'error').length,
    records,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const limitArg = process.argv.indexOf('--limit');
  const cohortArg = process.argv.indexOf('--cohort');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;
  const cohort = cohortArg >= 0 ? process.argv[cohortArg + 1] : undefined;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey) {
    console.error('adopt-subscriptions: STRIPE_SECRET_KEY missing. Put a restricted READ key in ~/.albunyaan-cc/stripe.env.');
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('adopt-subscriptions: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (source ~/.albunyaan-cc/cloud.env).');
    process.exit(1);
  }

  const StripeCtor = (await import('stripe')).default;
  const stripe = new StripeCtor(stripeKey);
  const db = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  console.log(`adopt-subscriptions · ${execute ? '⚠️  EXECUTE (writing entitlements)' : 'DRY-RUN (no writes)'}` +
    `${cohort ? ` · cohort=${cohort}` : ''}${limit ? ` · limit=${limit}` : ''}\n`);

  const summary = await adoptSubscriptions({ db, stripe }, { execute, limit, cohort });

  for (const r of summary.records) {
    const tag = r.verdict.toUpperCase().padEnd(16);
    console.log(`  ${tag} ${r.email} · ${r.subscriptionId ?? '(no sub)'} ${r.action ? `· ${r.action}` : ''}${r.error ? `· ERROR ${r.error}` : ''}`);
  }
  console.log(`\npeople=${summary.people} wouldAdopt=${summary.wouldAdopt} adopted=${summary.adopted} ` +
    `skipped=${summary.skipped} errors=${summary.errors}`);

  const reportPath = path.join(os.homedir(), '.albunyaan-cc', 'adopt-subscriptions-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ execute, cohort, limit, summary }, null, 2));
  console.log(`report → ${reportPath}`);

  if (!execute) console.log('\nDRY-RUN only — re-run with --execute to apply. Existing Stripe subscriptions are never modified.');
  process.exit(summary.errors > 0 ? 1 : 0);
}

// Run as CLI only when invoked directly (the test imports adoptSubscriptions).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
