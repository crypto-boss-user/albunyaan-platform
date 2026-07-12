import Link from 'next/link';
import { confirmAuthAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Confirm login — Albunyaan TV' };

/**
 * Magic-link interstitial — deliberately does NOTHING on GET.
 *
 * Email scanners (Microsoft SafeLinks & co.) prefetch GET URLs and would burn a
 * one-time token before the human ever clicks. So the emailed link lands here,
 * and only the explicit "Continue" BUTTON below POSTs token_hash+type to the
 * verifying server action (supabase.auth.verifyOtp). This also makes the link
 * cross-device safe — no PKCE code verifier bound to the requesting browser.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const isEmailChange = type === 'email_change';

  if (!tokenHash) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <p className="section-label">Members</p>
        <h1 className="text-2xl font-extrabold tracking-tight mt-2 mb-3">This link is incomplete</h1>
        <p className="text-[14px] text-ink-secondary mb-8">
          The confirmation link is missing its token — it may have been cut off by your email app.
        </p>
        <Link
          href="/login"
          className="inline-flex px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px]"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-brand-soft grid place-items-center text-brand mb-6">
        <svg width="28" height="28" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1a4 4 0 014 4v2h.5A1.5 1.5 0 0114 8.5v5A1.5 1.5 0 0112.5 15h-9A1.5 1.5 0 012 13.5v-5A1.5 1.5 0 013.5 7H4V5a4 4 0 014-4zm2.5 6V5a2.5 2.5 0 00-5 0v2h5z" fill="currentColor" />
        </svg>
      </div>
      <p className="section-label">{isEmailChange ? 'Email change' : 'Members'}</p>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 mb-3">
        {isEmailChange ? 'Confirm your email change' : 'Almost there'}
      </h1>
      <p className="text-[14px] text-ink-secondary leading-relaxed mb-8">
        {isEmailChange
          ? 'Press the button to confirm this address for your Albunyaan TV account.'
          : 'Press the button to finish logging in to Albunyaan TV on this device.'}
      </p>
      <form action={confirmAuthAction}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={isEmailChange ? 'email_change' : 'email'} />
        {next && <input type="hidden" name="next" value={next} />}
        <button
          type="submit"
          className="inline-flex px-8 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
        >
          Continue to Albunyaan
        </button>
      </form>
      <p className="mt-6 text-[12px] text-ink-muted">
        Didn&rsquo;t request this? You can safely close this page — nothing happens without the button.
      </p>
    </div>
  );
}
