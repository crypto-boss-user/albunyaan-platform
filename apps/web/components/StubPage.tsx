import Link from 'next/link';

/**
 * Placeholder for real-site IA destinations whose content migrates in a later
 * phase (About us, Dawah, Q&A, Coupon, Download app, Contact, Donate, Terms).
 * Keeps every nav/footer link alive — structural parity without fake content.
 */
export default function StubPage({ label, title, blurb }: { label: string; title: string; blurb: string }) {
  return (
    <div className="max-w-2xl mx-auto px-5 py-28 text-center">
      <p className="section-label">{label}</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">{title}</h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed">{blurb}</p>
      <p className="mt-4 text-[13px] text-ink-muted">
        This page&rsquo;s real content migrates from albunyaan.tv in a later phase.
      </p>
      <Link
        href="/catalog"
        className="inline-flex mt-9 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
      >
        Browse the catalog
      </Link>
    </div>
  );
}
