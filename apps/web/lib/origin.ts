import { headers } from 'next/headers';

/**
 * Canonical site origin for building Stripe redirect URLs (success/cancel/return).
 * Prefer the pinned SITE_URL env (set on Vercel) so a spoofed Host /
 * X-Forwarded-* header cannot turn a post-payment redirect into an
 * attacker-controlled URL; fall back to request headers for local dev where
 * SITE_URL is unset.
 */
export async function siteOrigin(): Promise<string> {
  const pinned = process.env.SITE_URL?.replace(/\/+$/, '');
  if (pinned) return pinned;
  const h = await headers();
  return h.get('origin') ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'localhost:3000'}`;
}
