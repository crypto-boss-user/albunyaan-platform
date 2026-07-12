/**
 * READ-ONLY Stripe forensic audit of the foundation's account — Scenario A
 * verification ("did Uscreen bill on OUR Stripe account, and can we keep
 * charging these people without re-entry of payment details?").
 *
 * Answers, with full pagination:
 *   1. every Customer (email, created, default PM)
 *   2. every Subscription, any status — did Uscreen create REAL Subscription
 *      objects, or only bare charges?
 *   3. payment methods per relevant customer — card / sepa_debit / ideal;
 *      an ATTACHED sepa_debit PM implies a reusable mandate within this account
 *      (kept deliberately simple per plan; SetupAttempts not crawled)
 *   4. the 100 most recent Charges — creator hints (metadata, description,
 *      `application` set ⇒ a Connect platform like Uscreen created it)
 *   5. account settings: default currency, Stripe Tax (best-effort), webhook urls
 *   6. EMAIL MATCH against Supabase `people` (lower/trim) → per-person verdict:
 *        migratable_no_reentry — has a live-ish subscription or a reusable PM
 *        needs_remandate      — Stripe customer exists but no sub / no reusable PM
 *        no_customer          — no Stripe customer for this email
 *
 * WRITES NOTHING to Stripe, ever. The ONLY write anywhere is the opt-in
 * `--backfill` flag, which sets people.stripe_customer_id in Supabase for
 * UNIQUE email matches only (default OFF).
 *
 * Env (source ~/.albunyaan-cc/stripe.env + ~/.albunyaan-cc/cloud.env first):
 *   STRIPE_SECRET_KEY           restricted READ key (rk_live_… preferred)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   set -a; . ~/.albunyaan-cc/stripe.env; . ~/.albunyaan-cc/cloud.env; set +a
 *   node_modules/.bin/tsx worker/stripe-audit.ts [--backfill]
 *
 * Output: human-readable report on stdout + JSON at
 * ~/.albunyaan-cc/stripe-audit-report.json (ids + emails only — no card data,
 * no names, no addresses). Restricted-key permission errors are reported
 * per-section and the audit continues; 429s are retried by the SDK
 * (maxNetworkRetries) with exponential backoff.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { normalizeEmail } from './lib/email.ts';

const BACKFILL = process.argv.includes('--backfill');
const REPORT_PATH = path.join(os.homedir(), '.albunyaan-cc', 'stripe-audit-report.json');

// ── env gates (fail loud + clear; NEVER echo key values) ────────────────────

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error(
    'stripe-audit: STRIPE_SECRET_KEY is not set.\n' +
      'Put a RESTRICTED READ key in ~/.albunyaan-cc/stripe.env (STRIPE_SECRET_KEY=rk_live_…)\n' +
      'then run:  set -a; . ~/.albunyaan-cc/stripe.env; . ~/.albunyaan-cc/cloud.env; set +a; tsx worker/stripe-audit.ts',
  );
  process.exit(1);
}
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'stripe-audit: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — the email-matching step needs them.\n' +
      'Source ~/.albunyaan-cc/cloud.env (set -a; . ~/.albunyaan-cc/cloud.env; set +a) and rerun.',
  );
  process.exit(1);
}

/** Belt-and-braces: strip the secret from any message before it can be printed. */
function scrub(msg: string): string {
  return msg.split(stripeKey!).join('[redacted]');
}

const stripe = new Stripe(stripeKey, { maxNetworkRetries: 5 }); // 429s → SDK exponential backoff

// ── per-section permission tolerance (restricted keys) ──────────────────────

interface PermissionGap {
  section: string;
  message: string;
}
const permissionGaps: PermissionGap[] = [];

function isPermissionError(err: unknown): boolean {
  const e = err as { statusCode?: number; type?: string };
  return e?.statusCode === 401 || e?.statusCode === 403 || e?.type === 'StripePermissionError';
}

/** Run one audit section; a permission error is REPORTED and skipped, never fatal. */
async function section<T>(name: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isPermissionError(err)) {
      const message = scrub((err as Error).message ?? String(err));
      permissionGaps.push({ section: name, message });
      console.error(`  ⚠ key lacks permission for ${name} — skipped (${message})`);
      return fallback;
    }
    throw err;
  }
}

// ── report shapes (ids + emails only — no card numbers, names, addresses) ───

interface CustomerInfo {
  id: string;
  email: string | null; // normalized lower/trim
  created: string; // ISO
  default_payment_method: string | null; // pm id from invoice_settings
  subscription_ids: string[];
  payment_methods: { id: string; type: string }[] | null; // null = not fetched (no subs/charges)
  has_reusable_pm: boolean | null; // null = unknown (PMs not fetched)
  recent_charge_count: number;
}

interface SubscriptionInfo {
  id: string;
  customer: string;
  status: string;
  current_period_end: string | null; // ISO; API "basil"+ keeps it on items — max taken
  price_ids: string[];
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
}

interface ChargeInfo {
  id: string;
  created: string;
  amount: number;
  currency: string;
  status: string;
  customer: string | null;
  pm_type: string | null; // card | sepa_debit | ideal | …
  application: string | null; // set ⇒ created by a Connect platform (Uscreen)
  description: string | null; // truncated
  metadata_keys: string[];
}

type Verdict = 'migratable_no_reentry' | 'needs_remandate' | 'no_customer';
type MatchClass = 'unique_match' | 'multiple_customers_same_email' | 'no_stripe_customer';

interface PersonVerdict {
  person_id: string;
  email: string;
  match: MatchClass;
  stripe_customer_ids: string[];
  verdict: Verdict;
  reasons: string[];
}

// A subscription in one of these states keeps billing (or resumes) without re-entry.
const LIVE_SUB_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);
// PM types that are reusable off-session once attached (sepa_debit ⇒ mandate exists in-account).
const REUSABLE_PM_TYPES = new Set(['card', 'sepa_debit']);

async function main(): Promise<void> {
  console.log('── Stripe forensic audit (READ-ONLY' + (BACKFILL ? ' + Supabase --backfill' : '') + ') ──');

  // 1 ▸ account settings ------------------------------------------------------
  const account = await section('account', null as Stripe.Account | null, () => stripe.accounts.retrieveCurrent());
  const taxSettings = await section('tax settings (best-effort)', null as Stripe.Tax.Settings | null, async () => {
    try {
      return await stripe.tax.settings.retrieve();
    } catch (err) {
      // No Stripe Tax on the account surfaces as 404-ish errors — tolerate, per plan.
      if ((err as { statusCode?: number }).statusCode === 404) return null;
      throw err;
    }
  });
  const webhookUrls = await section('webhook endpoints', [] as string[], async () => {
    const urls: string[] = [];
    for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) urls.push(ep.url);
    return urls;
  });
  console.log(`account: ${account?.id ?? '(no permission)'}  currency=${account?.default_currency ?? '?'}  country=${account?.country ?? '?'}`);
  console.log(`stripe tax: ${taxSettings ? `status=${taxSettings.status}` : 'not enabled / not readable'}`);
  console.log(`webhook endpoints (${webhookUrls.length}): ${webhookUrls.join(', ') || '(none)'}`);

  // 2 ▸ ALL customers, fully paginated ----------------------------------------
  const customers = new Map<string, CustomerInfo>();
  await section('customers', undefined as void, async () => {
    for await (const c of stripe.customers.list({ limit: 100 })) {
      const defaultPm = c.invoice_settings?.default_payment_method;
      customers.set(c.id, {
        id: c.id,
        email: c.email ? normalizeEmail(c.email) : null,
        created: new Date(c.created * 1000).toISOString(),
        default_payment_method: typeof defaultPm === 'string' ? defaultPm : (defaultPm?.id ?? null),
        subscription_ids: [],
        payment_methods: null,
        has_reusable_pm: null,
        recent_charge_count: 0,
      });
    }
  });
  console.log(`customers: ${customers.size}`);

  // 3 ▸ ALL subscriptions, any status -----------------------------------------
  const subscriptions: SubscriptionInfo[] = [];
  await section('subscriptions', undefined as void, async () => {
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      // API "basil" (SDK v18+) moved current_period_end onto items — take the max.
      const itemEnds = s.items.data.map((i) => (i as { current_period_end?: number }).current_period_end ?? 0);
      const legacyEnd = (s as unknown as { current_period_end?: number }).current_period_end ?? 0;
      const end = Math.max(legacyEnd, ...itemEnds);
      const custId = typeof s.customer === 'string' ? s.customer : s.customer.id;
      subscriptions.push({
        id: s.id,
        customer: custId,
        status: s.status,
        current_period_end: end ? new Date(end * 1000).toISOString() : null,
        price_ids: s.items.data.map((i) => i.price?.id).filter((x): x is string => Boolean(x)),
        cancel_at_period_end: s.cancel_at_period_end,
        metadata: (s.metadata ?? {}) as Record<string, string>,
      });
      customers.get(custId)?.subscription_ids.push(s.id);
    }
  });
  const subsByStatus = new Map<string, number>();
  for (const s of subscriptions) subsByStatus.set(s.status, (subsByStatus.get(s.status) ?? 0) + 1);
  console.log(
    `subscriptions: ${subscriptions.length} total — ` +
      ([...subsByStatus].map(([k, v]) => `${k}=${v}`).join(' ') || 'NONE (Uscreen created no real Subscription objects)'),
  );

  // 4 ▸ 100 most recent charges — who created them? ----------------------------
  const charges: ChargeInfo[] = [];
  await section('charges (recent 100)', undefined as void, async () => {
    const page = await stripe.charges.list({ limit: 100 });
    for (const ch of page.data) {
      const custId = typeof ch.customer === 'string' ? ch.customer : (ch.customer?.id ?? null);
      charges.push({
        id: ch.id,
        created: new Date(ch.created * 1000).toISOString(),
        amount: ch.amount,
        currency: ch.currency,
        status: ch.status,
        customer: custId,
        pm_type: ch.payment_method_details?.type ?? null,
        application: typeof ch.application === 'string' ? ch.application : (ch.application?.id ?? null),
        description: ch.description ? ch.description.slice(0, 80) : null,
        metadata_keys: Object.keys(ch.metadata ?? {}),
      });
      if (custId) {
        const c = customers.get(custId);
        if (c) c.recent_charge_count += 1;
      }
    }
  });
  const viaPlatform = charges.filter((c) => c.application).length;
  console.log(
    `charges sampled: ${charges.length} — via Connect platform (application set): ${viaPlatform}` +
      (viaPlatform ? ` [${[...new Set(charges.map((c) => c.application).filter(Boolean))].join(', ')}]` : ''),
  );

  // 5 ▸ payment methods for customers with subs or recent charges --------------
  const pmTargets = [...customers.values()].filter((c) => c.subscription_ids.length > 0 || c.recent_charge_count > 0);
  await section('payment methods', undefined as void, async () => {
    for (const cust of pmTargets) {
      const pms: { id: string; type: string }[] = [];
      for await (const pm of stripe.customers.listPaymentMethods(cust.id, { limit: 100 })) {
        pms.push({ id: pm.id, type: pm.type }); // type only — never card numbers/fingerprints
      }
      cust.payment_methods = pms;
      // Attached card ⇒ reusable; attached sepa_debit ⇒ mandate reusable in-account (kept simple).
      cust.has_reusable_pm = pms.some((pm) => REUSABLE_PM_TYPES.has(pm.type));
    }
  });
  const pmTypeCounts = new Map<string, number>();
  for (const c of pmTargets) for (const pm of c.payment_methods ?? []) pmTypeCounts.set(pm.type, (pmTypeCounts.get(pm.type) ?? 0) + 1);
  console.log(
    `payment methods fetched for ${pmTargets.length} customers (with subs/recent charges): ` +
      ([...pmTypeCounts].map(([k, v]) => `${k}=${v}`).join(' ') || '(none found)'),
  );

  // 6 ▸ Supabase people + email matching ---------------------------------------
  const people = await loadPeople();
  console.log(`supabase people: ${people.length}`);

  const customersByEmail = new Map<string, CustomerInfo[]>();
  for (const c of customers.values()) {
    if (!c.email) continue;
    customersByEmail.set(c.email, [...(customersByEmail.get(c.email) ?? []), c]);
  }

  const liveSubCustomers = new Set(
    subscriptions.filter((s) => LIVE_SUB_STATUSES.has(s.status)).map((s) => s.customer),
  );

  const verdicts: PersonVerdict[] = [];
  for (const person of people) {
    const email = normalizeEmail(person.email);
    const matched = customersByEmail.get(email) ?? [];
    const match: MatchClass =
      matched.length === 0 ? 'no_stripe_customer' : matched.length === 1 ? 'unique_match' : 'multiple_customers_same_email';

    const reasons: string[] = [];
    let verdict: Verdict;
    if (matched.length === 0) {
      verdict = 'no_customer';
      reasons.push('no Stripe customer with this email');
    } else {
      const withLiveSub = matched.filter((c) => liveSubCustomers.has(c.id));
      const withAnySub = matched.filter((c) => c.subscription_ids.length > 0);
      const withReusablePm = matched.filter((c) => c.has_reusable_pm === true);
      if (withLiveSub.length > 0) {
        verdict = 'migratable_no_reentry';
        reasons.push(`live subscription on ${withLiveSub.map((c) => c.id).join(', ')}`);
      } else if (withReusablePm.length > 0) {
        verdict = 'migratable_no_reentry';
        reasons.push(`reusable payment method (card/sepa mandate) on ${withReusablePm.map((c) => c.id).join(', ')}`);
      } else {
        verdict = 'needs_remandate';
        reasons.push(
          withAnySub.length > 0
            ? 'only ended subscriptions and no reusable PM found'
            : matched.every((c) => c.payment_methods === null)
              ? 'customer exists but had no subs/recent charges — PMs not crawled, assume re-entry needed'
              : 'no reusable payment method attached',
        );
      }
      if (match === 'multiple_customers_same_email') reasons.push(`${matched.length} Stripe customers share this email — pick one before backfill`);
    }
    verdicts.push({ person_id: person.id, email, match, stripe_customer_ids: matched.map((c) => c.id), verdict, reasons });
  }

  const peopleEmails = new Set(people.map((p) => normalizeEmail(p.email)));
  const strayCustomers = [...customers.values()].filter((c) => !c.email || !peopleEmails.has(c.email));

  const matchCounts = { unique_match: 0, multiple_customers_same_email: 0, no_stripe_customer: 0 };
  const verdictCounts = { migratable_no_reentry: 0, needs_remandate: 0, no_customer: 0 };
  for (const v of verdicts) {
    matchCounts[v.match] += 1;
    verdictCounts[v.verdict] += 1;
  }

  console.log('── email matching (people ↔ stripe customers) ──');
  console.log(`  unique_match:                  ${matchCounts.unique_match}`);
  console.log(`  multiple_customers_same_email: ${matchCounts.multiple_customers_same_email}`);
  console.log(`  no_stripe_customer:            ${matchCounts.no_stripe_customer}`);
  console.log(`  stripe_customer_no_person:     ${strayCustomers.length}`);
  console.log('── per-person verdicts ──');
  console.log(`  migratable_no_reentry: ${verdictCounts.migratable_no_reentry}`);
  console.log(`  needs_remandate:       ${verdictCounts.needs_remandate}`);
  console.log(`  no_customer:           ${verdictCounts.no_customer}`);

  // 7 ▸ optional backfill (unique matches ONLY; the sole write in this script) --
  let backfilled = 0;
  let backfillConflicts = 0;
  if (BACKFILL) {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl!, supabaseServiceKey!, { auth: { persistSession: false } });
    for (const v of verdicts) {
      if (v.match !== 'unique_match') continue;
      const customerId = v.stripe_customer_ids[0];
      const person = people.find((p) => p.id === v.person_id)!;
      if (person.stripe_customer_id && person.stripe_customer_id !== customerId) {
        backfillConflicts += 1;
        console.error(`  ⚠ backfill conflict: person ${person.id} already has ${person.stripe_customer_id}, matched ${customerId} — left untouched`);
        continue;
      }
      if (person.stripe_customer_id === customerId) continue; // already set — idempotent
      const { error } = await sb.from('people').update({ stripe_customer_id: customerId }).eq('id', person.id);
      if (error) throw new Error(`backfill people.stripe_customer_id for ${person.id}: ${error.message}`);
      backfilled += 1;
    }
    console.log(`backfill: wrote stripe_customer_id for ${backfilled} people (${backfillConflicts} conflicts skipped)`);
  } else {
    console.log('backfill: OFF (rerun with --backfill to write people.stripe_customer_id for unique matches)');
  }

  // 8 ▸ JSON report -------------------------------------------------------------
  const report = {
    generated_at: new Date().toISOString(),
    read_only: true,
    backfill: BACKFILL ? { backfilled, conflicts: backfillConflicts } : false,
    account: {
      id: account?.id ?? null,
      default_currency: account?.default_currency ?? null,
      country: account?.country ?? null,
      stripe_tax: taxSettings ? { status: taxSettings.status } : null,
      webhook_urls: webhookUrls,
    },
    totals: {
      customers: customers.size,
      subscriptions: subscriptions.length,
      subscriptions_by_status: Object.fromEntries(subsByStatus),
      charges_sampled: charges.length,
      charges_via_connect_application: viaPlatform,
      pm_types: Object.fromEntries(pmTypeCounts),
      match: { ...matchCounts, stripe_customer_no_person: strayCustomers.length },
      verdicts: verdictCounts,
    },
    customers: [...customers.values()],
    subscriptions,
    charges_sample: charges,
    stripe_customer_no_person: strayCustomers.map((c) => ({ id: c.id, email: c.email, created: c.created })),
    person_verdicts: verdicts,
    permission_gaps: permissionGaps,
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`report written: ${REPORT_PATH}`);
  if (permissionGaps.length > 0) {
    console.log(`⚠ ${permissionGaps.length} section(s) skipped for key permissions: ${permissionGaps.map((p) => p.section).join(', ')}`);
  }
}

interface PersonRow {
  id: string;
  email: string;
  stripe_customer_id: string | null;
}

/** Load ALL people (id, email, stripe_customer_id) — 1000/page; Supabase REST silently clamps larger ranges. */
async function loadPeople(): Promise<PersonRow[]> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl!, supabaseServiceKey!, { auth: { persistSession: false } });
  const out: PersonRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('people')
      .select('id, email, stripe_customer_id')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`supabase people page @${from}: ${error.message}`);
    out.push(...((data ?? []) as PersonRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

main().catch((err) => {
  console.error('stripe-audit failed:', scrub(err instanceof Error ? (err.stack ?? err.message) : String(err)));
  process.exit(1);
});
