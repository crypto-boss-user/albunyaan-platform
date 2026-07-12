/**
 * stripe-setup.ts — idempotent Stripe product/price bootstrap + `plans` upsert.
 *
 * Ensures on the loaded Stripe account (test OR live — whichever key is in env):
 *   - Product 'Albunyaan Membership'
 *   - price lookup_key web_monthly_650  → EUR 6,50 / month
 *   - price lookup_key web_yearly_6500  → EUR 65,00 / year
 * then upserts the two matching `plans` rows (source 'native', external_id =
 * the lookup_key) so /join renders real, purchasable pricing.
 *
 * Idempotent: reruns find the existing product/prices via lookup_keys and only
 * create what is missing. A price whose amount/currency/interval no longer
 * matches the spec is NEVER silently changed — reported + exit 1 (Stripe
 * prices are immutable; fixing means minting a new price and moving the
 * lookup_key deliberately).
 *
 * Run (founder brings the key; works the moment it lands):
 *   set -a; . ~/.albunyaan-cc/stripe.env; . worker/.env; set +a
 *   node_modules/.bin/tsx worker/stripe-setup.ts [--dry-run]
 *
 * --dry-run: reads Stripe + Supabase, prints intended actions, WRITES NOTHING.
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const PRODUCT_NAME = 'Albunyaan Membership';

interface PriceSpec {
  lookupKey: string;
  unitAmount: number; // cents
  interval: 'month' | 'year';
  billingPeriod: 'monthly' | 'yearly';
  planTitle: string;
}

const PRICE_SPECS: PriceSpec[] = [
  { lookupKey: 'web_monthly_650', unitAmount: 650, interval: 'month', billingPeriod: 'monthly', planTitle: 'Maandelijks lidmaatschap' },
  { lookupKey: 'web_yearly_6500', unitAmount: 6500, interval: 'year', billingPeriod: 'yearly', planTitle: 'Jaarlijks lidmaatschap' },
];

// ── env gates (fail loud + clear; NEVER echo key values) ────────────────────

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error(
    'stripe-setup: STRIPE_SECRET_KEY is not set — nothing can run without it.\n' +
      'The founder brings the key; put it in ~/.albunyaan-cc/stripe.env, then:\n' +
      '  set -a; . ~/.albunyaan-cc/stripe.env; . worker/.env; set +a; tsx worker/stripe-setup.ts --dry-run',
  );
  process.exit(1);
}
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('stripe-setup: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — source worker/.env (local) or cloud.env.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { maxNetworkRetries: 3 });
const db = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function ensureProduct(existingByLookup: Map<string, Stripe.Price>): Promise<string | null> {
  // Prefer the product already carrying one of our prices.
  for (const price of existingByLookup.values()) {
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (productId) return productId;
  }
  // Else find an active product by exact name.
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.name === PRODUCT_NAME) return product.id;
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] would CREATE product '${PRODUCT_NAME}'`);
    return null;
  }
  const created = await stripe.products.create({ name: PRODUCT_NAME });
  console.log(`  created product ${created.id} '${PRODUCT_NAME}'`);
  return created.id;
}

async function main(): Promise<void> {
  console.log(`── stripe-setup (${DRY_RUN ? 'DRY-RUN — no writes' : 'live writes'}) ──`);

  // 1 ▸ existing prices by lookup_key (the idempotency anchor)
  const existingByLookup = new Map<string, Stripe.Price>();
  const found = await stripe.prices.list({ lookup_keys: PRICE_SPECS.map((s) => s.lookupKey), limit: 10 });
  for (const price of found.data) {
    if (price.lookup_key) existingByLookup.set(price.lookup_key, price);
  }
  console.log(`existing prices: ${[...existingByLookup.keys()].join(', ') || '(none)'}`);

  // 2 ▸ product
  const productId = await ensureProduct(existingByLookup);

  // 3 ▸ prices: create missing, verify existing (never mutate)
  let mismatch = false;
  const priceIdByLookup = new Map<string, string>();
  for (const spec of PRICE_SPECS) {
    const existing = existingByLookup.get(spec.lookupKey);
    if (existing) {
      const ok =
        existing.unit_amount === spec.unitAmount &&
        existing.currency === 'eur' &&
        existing.recurring?.interval === spec.interval &&
        existing.active;
      if (!ok) {
        console.error(
          `  ✗ price ${existing.id} (${spec.lookupKey}) does NOT match spec ` +
            `(want ${spec.unitAmount} eur / ${spec.interval}, active; ` +
            `got ${existing.unit_amount} ${existing.currency} / ${existing.recurring?.interval}, active=${existing.active}). ` +
            'Prices are immutable — create a replacement and transfer the lookup_key deliberately.',
        );
        mismatch = true;
        continue;
      }
      console.log(`  ✓ price ${existing.id} (${spec.lookupKey}) matches spec`);
      priceIdByLookup.set(spec.lookupKey, existing.id);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] would CREATE price ${spec.lookupKey}: EUR ${(spec.unitAmount / 100).toFixed(2)} / ${spec.interval}`);
      continue;
    }
    if (!productId) throw new Error('stripe-setup: product id missing outside dry-run (should be unreachable)');
    const created = await stripe.prices.create({
      product: productId,
      currency: 'eur',
      unit_amount: spec.unitAmount,
      recurring: { interval: spec.interval },
      lookup_key: spec.lookupKey,
    });
    console.log(`  created price ${created.id} (${spec.lookupKey}): EUR ${(spec.unitAmount / 100).toFixed(2)} / ${spec.interval}`);
    priceIdByLookup.set(spec.lookupKey, created.id);
  }
  if (mismatch) {
    console.error('stripe-setup: spec mismatch — fix Stripe first, plans NOT touched.');
    process.exit(1);
  }

  // 4 ▸ plans upsert (unique (source, external_id); external_id = lookup_key)
  for (const spec of PRICE_SPECS) {
    const stripePriceId = priceIdByLookup.get(spec.lookupKey);
    const row = {
      external_id: spec.lookupKey,
      source: 'native',
      title: spec.planTitle,
      platform: 'web',
      amount_cents: spec.unitAmount,
      currency: 'EUR',
      billing_period: spec.billingPeriod,
      trial_days: 0,
      visibility: 'public',
      stripe_price_id: stripePriceId ?? null,
      updated_at: new Date().toISOString(),
    };
    if (DRY_RUN) {
      console.log(`  [dry-run] would UPSERT plan (native, ${spec.lookupKey}): '${spec.planTitle}' ${spec.unitAmount}c EUR ${spec.billingPeriod} → price ${stripePriceId ?? '(pending creation)'}`);
      continue;
    }
    const { error } = await db.from('plans').upsert(row, { onConflict: 'source,external_id' });
    if (error) throw new Error(`plans upsert (${spec.lookupKey}): ${error.message}`);
    console.log(`  upserted plan (native, ${spec.lookupKey}) → ${stripePriceId}`);
  }

  console.log('stripe-setup: done.');
}

main().catch((err) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error('stripe-setup failed:', msg.split(stripeKey!).join('[redacted]'));
  process.exit(1);
});
