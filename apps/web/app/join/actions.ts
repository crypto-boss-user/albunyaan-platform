'use server';

/**
 * /join — checkout server action.
 *
 * Payment methods are deliberately ['card','ideal']: iDEAL auto-establishes a
 * reusable SEPA mandate for renewals, while sepa_debit as a FIRST payment is
 * excluded (3–5 day settlement = no instant access). EU consumer law: the
 * withdrawal-waiver consent checkbox is REQUIRED server-side, not just in HTML.
 */
import { redirect } from 'next/navigation';
import { getPlanById, hasActiveEntitlement, setPersonStripeCustomerId } from '@albunyaan/core/data';
import { getMember } from '../../lib/session';
import { getStripe } from '../../lib/stripe';
import { siteOrigin } from '../../lib/origin';

export async function checkoutAction(formData: FormData): Promise<void> {
  const member = await getMember();
  if (!member) redirect('/login?next=/join');

  if (formData.get('consent') !== 'on') redirect('/join?error=consent');

  const planId = String(formData.get('plan_id') ?? '');
  const plan = planId ? await getPlanById(planId).catch(() => null) : null;
  if (!plan || plan.visibility !== 'public' || plan.platform !== 'web' || !plan.stripe_price_id) {
    redirect('/join?error=plan');
  }

  // No path may double-bill (plan invariant):
  //  - a still-billing Uscreen member (legacy_cohort 'uscreen_paying') would pay
  //    Uscreen AND Stripe; self-serve /join must not run for them — the WS8
  //    cancel-Uscreen-first machinery migrates that cohort, not this action;
  //  - a member who already holds a live entitlement must not create a SECOND
  //    subscription (bookmark / second tab / back-button re-checkout).
  if (member.legacy_cohort === 'uscreen_paying') redirect('/account?error=migration-pending');
  if (await hasActiveEntitlement(member.id)) redirect('/account?error=already-member');

  const origin = await siteOrigin();

  let checkoutUrl: string;
  try {
    const stripe = getStripe();

    // Create-or-reuse the Stripe customer; the id is persisted BEFORE checkout
    // so a retry never mints a duplicate cus_….
    let customerId = member.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email,
        name: member.full_name ?? undefined,
        metadata: { person_id: member.id },
      });
      await setPersonStripeCustomerId(member.id, customer.id);
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      payment_method_types: ['card', 'ideal'],
      client_reference_id: member.id,
      subscription_data: { metadata: { person_id: member.id } },
      success_url: `${origin}/account?welcome=1`,
      cancel_url: `${origin}/join`,
      locale: 'auto',
      allow_promotion_codes: false,
    });
    if (!session.url) throw new Error(`checkout session ${session.id} returned no url`);
    checkoutUrl = session.url;
  } catch (err) {
    // Covers "STRIPE_SECRET_KEY is not set" until the founder's keys land.
    console.error('checkoutAction failed:', err instanceof Error ? err.message : err);
    redirect('/join?error=checkout');
  }
  redirect(checkoutUrl);
}
