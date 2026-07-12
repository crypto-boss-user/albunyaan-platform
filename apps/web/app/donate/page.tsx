import Link from 'next/link';

export const metadata = { title: 'Donate — Albunyaan TV' };

/**
 * The foundation's existing Stripe Payment Link — separate from the
 * membership Stripe integration (lib/stripe.ts) and deliberately never
 * touched by it. Source: ~/Funnel-Albunyaan-Upgrade/docs/brand-manhaj.md.
 */
const DONATE_URL = 'https://donate.stripe.com/6oE1442hl5iob72aEM';

export default function DonatePage() {
  return (
    <div className="max-w-xl mx-auto px-5 py-28 text-center">
      <p className="section-label">Support</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">Donate</h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed">
        Support the platform with a donation — a sadaqah jaariyah that keeps safe Islamic content
        available for every family, membership or not.
      </p>
      <a
        href={DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex mt-9 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
      >
        Donate now
      </a>
      <p className="mt-4 text-[12px] text-ink-muted">Opens Stripe&rsquo;s secure donation page in a new tab.</p>
      <p className="mt-10">
        <Link href="/catalog" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">
          ← Back to the catalog
        </Link>
      </p>
    </div>
  );
}
