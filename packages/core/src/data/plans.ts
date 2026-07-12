/**
 * Plans — pricing reads for the /join page and Stripe price → plan resolution
 * for the webhook. Server-side only (service role, see ./client).
 */
import { createServiceClient } from './client';
import type { PlanRow } from './rows';

const PLAN_COLS =
  'id, external_id, source, title, platform, amount_cents, currency, billing_period, visibility, stripe_price_id';

/**
 * Public web plans for the pricing page, yearly first (annual is the primary
 * offer). Only plans that are actually purchasable (stripe_price_id set).
 */
export async function getPublicWebPlans(): Promise<PlanRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('plans')
    .select(PLAN_COLS)
    .eq('visibility', 'public')
    .eq('platform', 'web')
    .not('stripe_price_id', 'is', null)
    .order('amount_cents', { ascending: false }); // yearly (6500) before monthly (650)
  if (error) throw error;
  return (data ?? []) as PlanRow[];
}

/** One plan by id, or null. */
export async function getPlanById(planId: string): Promise<PlanRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from('plans').select(PLAN_COLS).eq('id', planId).maybeSingle();
  if (error) throw error;
  return data as PlanRow | null;
}

/** Resolve a Stripe price id to our plan id (null when no plan carries it). */
export async function getPlanIdByStripePriceId(stripePriceId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('plans')
    .select('id')
    .eq('stripe_price_id', stripePriceId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}
