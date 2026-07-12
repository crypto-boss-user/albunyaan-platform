/**
 * POST /api/stripe/webhook — Stripe event receiver.
 *
 * Contract:
 *  - 400 ONLY on signature verification failure;
 *  - 500 on missing configuration (keys not on this deployment yet);
 *  - 200 for everything else — including poison events, which are stored and
 *    marked 'failed' in stripe_events so worker/reconcile-stripe.ts catches
 *    them; retrying poison forever helps nobody.
 *
 * Vercel note: this path must be excluded from Deployment Protection
 * (Protection Bypass) or Stripe's deliveries bounce off the auth wall —
 * see apps/web/README.env.md.
 */
import type Stripe from 'stripe';
import { getStripe, getStripeWebhookSecret, hasStripeKey } from '../../../../lib/stripe';
import { ingestStripeEvent } from '../../../../lib/stripe-apply';

export const runtime = 'nodejs'; // raw-body + crypto: never edge
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (!hasStripeKey() || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe webhook: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured on this deployment');
    return Response.json({ error: 'stripe not configured' }, { status: 500 });
  }

  const body = await req.text(); // RAW body — signature is computed over exact bytes
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature ?? '', getStripeWebhookSecret());
  } catch (err) {
    console.warn(`stripe webhook: signature verification failed: ${err instanceof Error ? err.message : err}`);
    return Response.json({ error: 'invalid signature' }, { status: 400 });
  }

  const result = await ingestStripeEvent(event, getStripe());
  if (result.outcome === 'failed') {
    console.error(`stripe webhook: event ${event.id} (${event.type}) marked failed: ${result.error}`);
  }
  return Response.json({ received: true, outcome: result.outcome });
}
