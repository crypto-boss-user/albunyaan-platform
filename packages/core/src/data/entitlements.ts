/**
 * Entitlements — the SINGLE access truth (0004_billing.sql), server-side only.
 *
 * The legacy `subscriptions` table is a pure Uscreen mirror and is NEVER
 * consulted (or written) for access decisions. Stripe subscription ids live
 * exclusively in entitlements.provider_ref (provider 'stripe').
 */
import { createServiceClient } from './client';
import type { EntitlementRow, EntitlementWithPlan } from './rows';

/**
 * SEPA reality: a renewal charge can sit in limbo for days and a first retry
 * can fail without the member doing anything wrong. `past_due` therefore keeps
 * access for this many days past current_period_end before we cut off.
 *
 * This actually BOUNDS access only because applySubscriptionSnapshot anchors a
 * past_due row's current_period_end to the last PAID period end: Stripe advances
 * the subscription period on the failed renewal, so writing that fresh end would
 * grant an entire unpaid period of free access. Do not remove that anchor.
 */
export const GRACE_DAYS_PAST_DUE = 14;

const ENTITLEMENT_COLS =
  'id, person_id, plan_id, status, provider, provider_ref, cancel_at_period_end, current_period_end, created_at, updated_at';

/**
 * All entitlements for a person, newest first, each with its plan (title etc.)
 * joined for display. Empty array when the person has none.
 */
export async function getEntitlementsForPerson(personId: string): Promise<EntitlementWithPlan[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('entitlements')
    .select(`${ENTITLEMENT_COLS}, plan:plans (id, title, billing_period, amount_cents, currency)`)
    .eq('person_id', personId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EntitlementWithPlan[];
}

/**
 * Pure access rule for ONE entitlement (exported for unit tests). True when:
 *  - status active|trialing (any provider) and (current_period_end null OR in the future); OR
 *  - status past_due and current_period_end is within the GRACE_DAYS_PAST_DUE window; OR
 *  - provider legacy_free with status active (period end ignored — founder-granted).
 */
export function isEntitlementActive(
  e: Pick<EntitlementRow, 'status' | 'provider' | 'current_period_end'>,
  now: Date = new Date(),
): boolean {
  if (e.provider === 'legacy_free' && e.status === 'active') return true;

  const end = e.current_period_end ? new Date(e.current_period_end) : null;

  if (e.status === 'active' || e.status === 'trialing') {
    return end === null || end.getTime() > now.getTime();
  }
  if (e.status === 'past_due') {
    if (!end) return false;
    const graceCutoff = now.getTime() - GRACE_DAYS_PAST_DUE * 24 * 60 * 60 * 1000;
    return end.getTime() > graceCutoff;
  }
  return false;
}

/** Does this person currently have watch access? (any entitlement passing isEntitlementActive) */
export async function hasActiveEntitlement(personId: string): Promise<boolean> {
  const entitlements = await getEntitlementsForPerson(personId);
  const now = new Date();
  return entitlements.some((e) => isEntitlementActive(e, now));
}
