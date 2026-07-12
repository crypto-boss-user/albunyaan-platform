/**
 * Server-only, lazily-constructed Stripe client.
 *
 * STRIPE KEYS DO NOT EXIST on every machine yet (founder brings them): nothing
 * may construct a client at module load. Import getStripe() and call it inside
 * the action/route — a missing key then fails THAT request with a clear
 * message instead of breaking the build or unrelated pages.
 *
 * NEVER import this from a 'use client' module.
 */
import Stripe from 'stripe';

/** Pinned to the API version this SDK (stripe v22.x) ships with. */
export const STRIPE_API_VERSION = '2026-06-24.dahlia' as const;

let cached: Stripe | null = null;

/** True when a Stripe secret key is configured (UI can render honest fallbacks). */
export function hasStripeKey(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set — billing is disabled on this machine. ' +
        'Add it to apps/web/.env.local (local) or the Vercel project env (see apps/web/README.env.md).',
    );
  }
  cached = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 3, // 429/5xx → SDK exponential backoff
  });
  return cached;
}

/** The webhook signing secret; the webhook route fails loudly without it. */
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not set — the Stripe webhook cannot verify signatures. ' +
        'Create the endpoint in the Stripe dashboard and copy its signing secret (see apps/web/README.env.md).',
    );
  }
  return secret;
}
