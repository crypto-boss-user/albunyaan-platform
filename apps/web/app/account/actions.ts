'use server';

/**
 * /account — billing server actions (Stripe customer portal).
 * Portal handles: payment method updates, cancellation, invoices. We never
 * rebuild those flows ourselves.
 */
import { redirect } from 'next/navigation';
import { getMember } from '../../lib/session';
import { getStripe } from '../../lib/stripe';
import { siteOrigin } from '../../lib/origin';

export async function billingPortalAction(): Promise<void> {
  const member = await getMember();
  if (!member) redirect('/login?next=/account');
  if (!member.stripe_customer_id) redirect('/account?error=no-billing');

  const origin = await siteOrigin();

  let portalUrl: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: member.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    portalUrl = session.url;
  } catch (err) {
    // Covers "STRIPE_SECRET_KEY is not set" until the founder's keys land.
    console.error('billingPortalAction failed:', err instanceof Error ? err.message : err);
    redirect('/account?error=portal');
  }
  redirect(portalUrl);
}
