/**
 * Member identity — server-side only (service role).
 * A "member" is a `people` row linked to a Supabase auth user (people.auth_user_id,
 * written by the 0003 handle_new_user() trigger).
 */
import { createServiceClient } from './client';
import type { PersonRow } from './rows';

const PERSON_COLS = 'id, email, full_name, auth_user_id, legacy_cohort, stripe_customer_id';

/** The people row for an auth user, or null when the trigger never linked one. */
export async function getPersonByAuthUserId(authUserId: string): Promise<PersonRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('people')
    .select(PERSON_COLS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as PersonRow | null;
}

/**
 * Persist the Stripe Customer id created for a member at first checkout.
 * Throws on failure — checkout must not proceed with an unrecorded customer
 * (we would mint a duplicate cus_… on the next attempt).
 */
export async function setPersonStripeCustomerId(personId: string, stripeCustomerId: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from('people')
    .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
    .eq('id', personId);
  if (error) {
    throw new Error(`setPersonStripeCustomerId: could not save ${stripeCustomerId} for person ${personId}: ${error.message}`);
  }
}

/** The people row that owns a Stripe Customer id, or null (webhook person resolution). */
export async function getPersonByStripeCustomerId(stripeCustomerId: string): Promise<PersonRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('people')
    .select(PERSON_COLS)
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (error) throw error;
  return data as PersonRow | null;
}

/**
 * Keep people.email in sync after a CONFIRMED auth email change.
 * Never throws: people.email is UNIQUE, so a conflicting row (rare, reconciled
 * out-of-band) must not break the confirm flow — we log and move on.
 */
export async function syncPersonEmail(authUserId: string, email: string): Promise<boolean> {
  const db = createServiceClient();
  const { error } = await db
    .from('people')
    .update({ email: email.trim().toLowerCase(), updated_at: new Date().toISOString() })
    .eq('auth_user_id', authUserId);
  if (error) {
    console.warn(`syncPersonEmail: could not sync people.email for auth user ${authUserId}: ${error.message}`);
    return false;
  }
  return true;
}
