import Link from 'next/link';

/**
 * Members-only wall shown IN PLACE of the player (WS5). Rendered server-side
 * for anyone without watch access, so the page source carries no embed URL,
 * no bunny_video_id, no playable anything — the entitlement check happens
 * before this component is chosen, and the player branch never renders.
 *
 * kind 'join'  → anonymous visitor (join CTA + login link for members)
 * kind 'renew' → logged-in member whose membership is not active
 */
export default function Paywall({ kind, title }: { kind: 'join' | 'renew'; title: string }) {
  return (
    <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-brand-dark relative">
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/10 grid place-items-center text-white mb-5">
            <svg width="26" height="26" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 5V3.5a3 3 0 016 0V5h.5A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11h-7A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5H3zm1.5 0h3V3.5a1.5 1.5 0 00-3 0V5z" fill="currentColor" />
            </svg>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/60 mb-2">Members only</p>
          <h2 className="text-white text-lg sm:text-xl font-extrabold tracking-tight mb-3">
            {kind === 'renew' ? 'Your membership isn’t active' : `Watch ${title} with an Albunyaan TV membership`}
          </h2>
          <p className="text-[13px] text-white/70 leading-relaxed mb-6">
            {kind === 'renew'
              ? 'Renew to keep watching everything on Albunyaan TV — your account and profiles are all still here.'
              : 'Halal screen time for the whole family — every series, film and live channel, for €6.50/month or €65/year.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={kind === 'renew' ? '/account' : '/join'}
              className="px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px]"
            >
              {kind === 'renew' ? 'Manage membership' : 'Become a member'}
            </Link>
            {kind === 'join' && (
              <Link
                href="/login"
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition text-white font-semibold text-[14px]"
              >
                Already a member? Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
