import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getEntitlementsForPerson,
  isEntitlementActive,
  type EntitlementWithPlan,
} from '@albunyaan/core/data';
import { getAuthUser, getMember, getMemberHousehold } from '../../lib/session';
import { signOutAction } from '../auth/actions';
import { billingPortalAction } from './actions';
import ChangeEmailForm from './ChangeEmailForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your account — Albunyaan TV' };

const NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  'email-updated': { tone: 'ok', text: 'Email confirmation received. If you confirmed both addresses, your new email is now active.' },
  'confirm-failed': { tone: 'error', text: 'That confirmation link is invalid or has expired — start the email change again.' },
  'no-billing': { tone: 'error', text: 'There is no billing account linked yet — billing management opens after your first payment.' },
  portal: { tone: 'error', text: 'Could not open the billing portal right now. Please try again in a moment.' },
};

/** NL-friendly labels for entitlement status (billing panel). */
const STATUS_LABELS: Record<EntitlementWithPlan['status'], string> = {
  active: 'Actief',
  trialing: 'Proefperiode',
  past_due: 'Betaling nog niet gelukt — toegang blijft tijdelijk actief',
  canceled: 'Opgezegd',
  expired: 'Verlopen',
};

function formatDateNl(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The entitlement worth showing: an active one first, else the most recent. */
function pickDisplayEntitlement(entitlements: EntitlementWithPlan[]): EntitlementWithPlan | null {
  return entitlements.find((e) => isEntitlementActive(e)) ?? entitlements[0] ?? null;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; welcome?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const [{ notice, error, welcome }, member, household] = await Promise.all([
    searchParams,
    getMember(),
    getMemberHousehold(),
  ]);
  const banner =
    welcome === '1'
      ? { tone: 'ok' as const, text: 'Payment received — welcome to Albunyaan TV! Your membership is being activated.' }
      : (NOTICES[notice ?? error ?? ''] ?? null);

  const entitlements = member ? await getEntitlementsForPerson(member.id).catch(() => []) : [];
  const entitlement = pickDisplayEntitlement(entitlements);
  const hasAccess = entitlement !== null && isEntitlementActive(entitlement);

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-16">
      <p className="section-label">Members</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-8">Your account</h1>

      {banner && (
        <p
          className={`mb-8 rounded-xl px-4 py-3 text-[13px] font-medium ${
            banner.tone === 'ok' ? 'bg-brand-soft text-brand-dark' : 'bg-red-50 text-red-800'
          }`}
          role={banner.tone === 'ok' ? 'status' : 'alert'}
        >
          {banner.text}
        </p>
      )}

      <div className="space-y-6">
        {/* Login & email */}
        <section className="card-elevated rounded-2xl p-7">
          <h2 className="font-bold text-lg mb-1">Login email</h2>
          <p className="text-[15px] text-ink-secondary">{user.email}</p>
          {user.new_email && (
            <p className="text-[13px] text-amber-700 mt-2">
              Change to <strong>{user.new_email}</strong> pending — confirm the links sent to both
              addresses.
            </p>
          )}
          <ChangeEmailForm currentEmail={user.email ?? ''} />
        </section>

        {/* Member record */}
        <section className="card-elevated rounded-2xl p-7">
          <h2 className="font-bold text-lg mb-1">Member record</h2>
          {member ? (
            <p className="text-[14px] text-ink-secondary">
              Linked to your membership{member.full_name ? ` as ${member.full_name}` : ''}
              {member.legacy_cohort ? ' (imported from the previous platform)' : ''}.
            </p>
          ) : (
            <p className="text-[14px] text-ink-secondary">
              Your login isn&rsquo;t linked to a member record yet — this resolves automatically
              after the membership import, in sha&rsquo; Allah.
            </p>
          )}
        </section>

        {/* Membership & billing */}
        <section className="card-elevated rounded-2xl p-7">
          <h2 className="font-bold text-lg mb-1">Membership</h2>
          {entitlement ? (
            <div className="text-[14px] text-ink-secondary space-y-1">
              <p>
                <span className="font-semibold text-ink">{entitlement.plan?.title ?? 'Albunyaan membership'}</span>
                {' — '}
                <span className={hasAccess ? 'text-brand-dark font-medium' : 'text-red-700 font-medium'}>
                  {STATUS_LABELS[entitlement.status]}
                </span>
              </p>
              {entitlement.current_period_end && (
                <p>
                  {entitlement.status === 'canceled' || entitlement.status === 'expired'
                    ? `Toegang liep af op ${formatDateNl(entitlement.current_period_end)}.`
                    : entitlement.cancel_at_period_end
                      ? `Opgezegd — toegang tot ${formatDateNl(entitlement.current_period_end)}.`
                      : `Verlengt op ${formatDateNl(entitlement.current_period_end)}.`}
                </p>
              )}
            </div>
          ) : member ? (
            <p className="text-[14px] text-ink-secondary">
              No active membership on this account yet.{' '}
              <Link href="/join" className="underline hover:text-brand">
                Word lid
              </Link>
              .
            </p>
          ) : (
            <p className="text-[14px] text-ink-secondary">
              Membership status appears once your login is linked to a member record.
            </p>
          )}

          {member?.stripe_customer_id ? (
            <form action={billingPortalAction} className="mt-4">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition"
              >
                Beheer facturering
              </button>
            </form>
          ) : (
            member && (
              <p className="text-[12px] text-ink-muted mt-4">
                Facturering beheren (betaalmethode, opzeggen, facturen) komt hier beschikbaar zodra je
                eerste betaling via het nieuwe systeem is verwerkt.
              </p>
            )
          )}
        </section>

        {/* Household / profiles */}
        <section className="card-elevated rounded-2xl p-7">
          <h2 className="font-bold text-lg mb-1">Family profiles</h2>
          <p className="text-[14px] text-ink-secondary mb-4">
            {household
              ? 'Pick who is watching, or manage kid rules from the parent dashboard.'
              : 'Your household is created the first time you open the profiles page.'}
          </p>
          <div className="flex gap-2.5">
            <Link
              href="/profiles"
              className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-light transition text-white text-[13px] font-semibold"
            >
              Profiles
            </Link>
            <Link
              href="/parents"
              className="px-5 py-2.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition"
            >
              Parent dashboard
            </Link>
          </div>
        </section>
      </div>

      <form action={signOutAction} className="mt-10">
        <button
          type="submit"
          className="px-6 py-3 rounded-full border border-black/10 text-[14px] font-semibold text-ink-secondary hover:border-red-700 hover:text-red-700 transition"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
