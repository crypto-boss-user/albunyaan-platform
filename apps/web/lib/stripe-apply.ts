/**
 * Stripe event → entitlement application. SEPARATED from the webhook route so
 * it is unit-testable without signatures (worker/test-stripe-apply.ts injects
 * a fake Stripe client).
 *
 * Architecture (locked):
 *  - store-first: every verified event lands in stripe_events (unique event_id;
 *    conflict = already seen → caller answers 200 immediately);
 *  - then RE-FETCH truth: for subscription-affecting events we retrieve the
 *    Subscription FRESH from the Stripe API and upsert the entitlement FROM
 *    THAT SNAPSHOT. Event payload order is untrusted — a stale retried event
 *    must never resurrect canceled access.
 *  - entitlements are the single access truth; the Stripe subscription id
 *    lives ONLY in entitlements.provider_ref. The legacy `subscriptions`
 *    table stays a pure Uscreen mirror — never written from Stripe code.
 *
 * This module must stay free of Next.js imports (no next/headers etc.) — the
 * worker (reconcile/tests) imports it directly via tsx.
 */
import type Stripe from 'stripe';
import {
  createServiceClient,
  getPersonByStripeCustomerId,
  getPlanIdByStripePriceId,
  type EntitlementRow,
} from '@albunyaan/core/data';

/** The slice of the Stripe client this module needs — injectable for tests. */
export interface StripeSubscriptionFetcher {
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
  };
}

/** Event types that affect entitlements. Everything else stays 'stored'. */
export const HANDLED_STRIPE_EVENTS: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

export type ApplyResult = { ok: true; action: string } | { ok: false; error: string };

export type IngestOutcome =
  | { outcome: 'duplicate' }
  | { outcome: 'ignored' }
  | { outcome: 'processed'; action: string }
  | { outcome: 'failed'; error: string };

// ── store-first inbox ────────────────────────────────────────────────────────

/** Insert the event into stripe_events. 'duplicate' = event_id already seen. */
export async function recordStripeEvent(event: Stripe.Event): Promise<'new' | 'duplicate'> {
  const db = createServiceClient();
  const { error } = await db.from('stripe_events').insert({
    event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
    status: 'stored',
  });
  if (error) {
    if (error.code === '23505') return 'duplicate'; // unique(event_id) — already stored
    throw new Error(`stripe_events insert failed for ${event.id}: ${error.message}`);
  }
  return 'new';
}

async function markStripeEvent(eventId: string, status: 'processed' | 'failed', errorMsg?: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from('stripe_events')
    .update({ status, error: errorMsg ?? null, processed_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) console.error(`stripe_events: could not mark ${eventId} ${status}: ${error.message}`);
}

/**
 * Full webhook pipeline minus signature verification: store → (if relevant)
 * apply → mark processed/failed. NEVER throws on a poison event — the caller
 * answers 200 so Stripe stops retrying; reconcile-stripe catches the drift.
 */
export async function ingestStripeEvent(event: Stripe.Event, stripe: StripeSubscriptionFetcher): Promise<IngestOutcome> {
  const stored = await recordStripeEvent(event);
  if (stored === 'duplicate') return { outcome: 'duplicate' };
  if (!HANDLED_STRIPE_EVENTS.has(event.type)) return { outcome: 'ignored' };

  let result: ApplyResult;
  try {
    result = await applyStripeEvent(event, stripe);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (result.ok) {
    await markStripeEvent(event.id, 'processed');
    return { outcome: 'processed', action: result.action };
  }
  await markStripeEvent(event.id, 'failed', result.error);
  return { outcome: 'failed', error: result.error };
}

// ── event → subscription id → fresh snapshot → entitlement ─────────────────

/** Map a FRESH Stripe subscription status onto our entitlement status. */
export function mapStripeSubStatus(status: Stripe.Subscription.Status): EntitlementRow['status'] | 'ignore' {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'canceled'; // paused = no access; a resume event re-activates
    case 'incomplete':
    default:
      return 'ignore'; // never create/flip a row from a not-yet-real subscription
  }
}

/**
 * current_period_end for SDK v22 / API "basil"+: it lives on subscription
 * ITEMS — take the max across items, with the legacy top-level field as
 * fallback for old snapshots.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const itemEnds = (sub.items?.data ?? []).map(
    (i) => (i as { current_period_end?: number }).current_period_end ?? 0,
  );
  const legacyEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? 0;
  const end = Math.max(legacyEnd, 0, ...itemEnds);
  return end ? new Date(end * 1000).toISOString() : null;
}

interface PersonHints {
  /** Checkout's client_reference_id — we set it to people.id at session creation. */
  clientReferenceId?: string | null;
  /** Customer id from the triggering object, when the subscription lacks one. */
  customerId?: string | null;
}

async function personIdExists(personId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db.from('people').select('id').eq('id', personId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** person_id = validated hint (client_reference_id / sub metadata) ?? people.stripe_customer_id lookup. */
async function resolvePersonId(sub: Stripe.Subscription, hints?: PersonHints): Promise<string | null> {
  const candidates = [hints?.clientReferenceId, sub.metadata?.person_id].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  for (const candidate of candidates) {
    if (await personIdExists(candidate)) return candidate;
  }
  const customerId =
    (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ?? hints?.customerId ?? null;
  if (customerId) {
    const person = await getPersonByStripeCustomerId(customerId);
    if (person) return person.id;
  }
  return null;
}

/** First plan whose stripe_price_id matches one of the subscription's item prices. */
async function resolvePlanId(sub: Stripe.Subscription): Promise<string | null> {
  for (const item of sub.items?.data ?? []) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    const planId = await getPlanIdByStripePriceId(priceId);
    if (planId) return planId;
  }
  return null;
}

/**
 * Idempotent upsert keyed on (provider 'stripe', provider_ref sub.id).
 * Manual select→update/insert because the 0004 unique index is PARTIAL
 * (where provider_ref is not null) — PostgREST upsert cannot infer it.
 * An insert race loses to unique(provider, provider_ref) → retried as update.
 *
 * Existing rows update WITHOUT person resolution (a subscription never changes
 * owner); person_id is only required when creating the row.
 */
export async function applySubscriptionSnapshot(sub: Stripe.Subscription, hints?: PersonHints): Promise<ApplyResult> {
  const status = mapStripeSubStatus(sub.status);
  if (status === 'ignore') {
    return { ok: true, action: `subscription ${sub.id} status '${sub.status}' → ignored (no entitlement row)` };
  }

  const db = createServiceClient();
  const patch = {
    status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_end: subscriptionPeriodEnd(sub),
    plan_id: await resolvePlanId(sub),
    updated_at: new Date().toISOString(),
  };

  const existing = await db
    .from('entitlements')
    .select('id')
    .eq('provider', 'stripe')
    .eq('provider_ref', sub.id)
    .maybeSingle();
  if (existing.error) return { ok: false, error: `entitlement lookup failed: ${existing.error.message}` };

  if (existing.data) {
    const { error } = await db.from('entitlements').update(patch).eq('id', (existing.data as { id: string }).id);
    if (error) return { ok: false, error: `entitlement update failed for ${sub.id}: ${error.message}` };
    return { ok: true, action: `entitlement updated: ${sub.id} → ${status}` };
  }

  const personId = await resolvePersonId(sub, hints);
  if (!personId) {
    return {
      ok: false,
      error:
        `could not resolve person for subscription ${sub.id} ` +
        '(no valid client_reference_id / metadata.person_id / people.stripe_customer_id match)',
    };
  }

  const { error: insertError } = await db
    .from('entitlements')
    .insert({ person_id: personId, provider: 'stripe', provider_ref: sub.id, ...patch });
  if (insertError) {
    if (insertError.code === '23505') {
      // Insert race: another delivery created the row between our select and insert.
      const { error } = await db
        .from('entitlements')
        .update(patch)
        .eq('provider', 'stripe')
        .eq('provider_ref', sub.id);
      if (error) return { ok: false, error: `entitlement race-update failed for ${sub.id}: ${error.message}` };
      return { ok: true, action: `entitlement updated (race): ${sub.id} → ${status}` };
    }
    return { ok: false, error: `entitlement insert failed for ${sub.id}: ${insertError.message}` };
  }
  return { ok: true, action: `entitlement created: ${sub.id} → ${status} (person ${personId})` };
}

/** RE-FETCH the subscription from the API, then upsert from that fresh snapshot. */
async function applySubscriptionUpdate(
  stripe: StripeSubscriptionFetcher,
  subscriptionId: string,
  hints?: PersonHints,
): Promise<ApplyResult> {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    return {
      ok: false,
      error: `could not re-fetch subscription ${subscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return applySubscriptionSnapshot(sub, hints);
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // API "basil"+ (SDK v22): invoice.parent.subscription_details.subscription.
  const parented = invoice.parent?.subscription_details?.subscription;
  if (parented) return typeof parented === 'string' ? parented : parented.id;
  // Legacy shape fallback (older stored payloads).
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id;
  return null;
}

/** Apply ONE verified Stripe event. Exported for tests; the route goes through ingestStripeEvent. */
export async function applyStripeEvent(event: Stripe.Event, stripe: StripeSubscriptionFetcher): Promise<ApplyResult> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') {
        return { ok: true, action: `checkout ${session.id} mode '${session.mode}' → ignored` };
      }
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!subId) return { ok: false, error: `checkout ${session.id} completed without a subscription id` };
      return applySubscriptionUpdate(stripe, subId, {
        clientReferenceId: session.client_reference_id,
        customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      });
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // Even for 'deleted' we re-fetch: canceled subscriptions stay retrievable,
      // and the fresh snapshot is the only order-safe truth.
      const sub = event.data.object as Stripe.Subscription;
      return applySubscriptionUpdate(stripe, sub.id);
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);
      if (!subId) return { ok: true, action: `invoice ${invoice.id} has no subscription → ignored` };
      return applySubscriptionUpdate(stripe, subId, {
        customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
      });
    }

    default:
      return { ok: true, action: `event type ${event.type} → no-op` };
  }
}
