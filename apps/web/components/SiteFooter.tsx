import Link from 'next/link';

/**
 * Footer per reference/real-site-ia.json: Videos, Q&A, Contact, Donate, Terms
 * of service. Privacy is NOT on the old site's footer (no privacy page existed
 * there — see docs/legal/source-uscreen-privacy.txt) but is required for the
 * new platform's GDPR compliance, so it's added alongside Terms.
 */
const LINKS = [
  { href: '/catalog', label: 'Videos' },
  { href: '/qa', label: 'Q&A' },
  { href: '/contact', label: 'Contact' },
  { href: '/donate', label: 'Donate' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
];

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-black/5 text-ink-secondary mt-24">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-14">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <span aria-hidden className="w-10 h-10 rounded-xl bg-brand grid place-items-center text-white">
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden>
                <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
              </svg>
            </span>
            <div>
              <p className="text-ink font-extrabold tracking-tight">
                Albunyaan<span className="text-brand">TV</span>
              </p>
              <p className="text-[12px] text-ink-muted">An Islamic multimedia platform — non-commercial da&rsquo;wah</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-3" aria-label="Footer">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[13px] hover:text-brand transition">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="line-divider my-8 opacity-40" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-ink-muted">
          <p>© Albunyaan {new Date().getFullYear()} — a non-profit sadaqah jaariyah. All revenue is invested back into da&rsquo;wah.</p>
          <p>Local parity build — content shadow-seeded, streams land with the media migration.</p>
        </div>
      </div>
    </footer>
  );
}
