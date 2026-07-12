import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthUser, getMember, getMemberHousehold } from '../../lib/session';
import { signOutAction } from '../auth/actions';
import ChangeEmailForm from './ChangeEmailForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your account — Albunyaan TV' };

const NOTICES: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  'email-updated': { tone: 'ok', text: 'Email confirmation received. If you confirmed both addresses, your new email is now active.' },
  'confirm-failed': { tone: 'error', text: 'That confirmation link is invalid or has expired — start the email change again.' },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const [{ notice, error }, member, household] = await Promise.all([
    searchParams,
    getMember(),
    getMemberHousehold(),
  ]);
  const banner = NOTICES[notice ?? error ?? ''] ?? null;

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

        {/* Subscription placeholder */}
        <section className="card-elevated rounded-2xl p-7">
          <h2 className="font-bold text-lg mb-1">Membership</h2>
          <p className="text-[14px] text-ink-secondary">Membership status arrives with billing.</p>
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
