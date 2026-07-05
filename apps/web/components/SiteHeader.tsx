import Link from 'next/link';
import type { ProfileRow } from '@albunyaan/core/data';
import LanguageSwitcher from './LanguageSwitcher';

/** Top nav — structure per reference/real-site-ia.json, design-bible skin. */
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/catalog', label: 'Videos' },
  { href: '/about-us', label: 'About us' },
  { href: '/dawah', label: 'Dawah' },
  { href: '/qa', label: 'Q&A' },
  { href: '/coupon', label: 'Coupon' },
  { href: '/download-app', label: 'Download app' },
];

export default function SiteHeader({
  lang,
  profile,
}: {
  lang: 'en' | 'ar' | 'nl';
  profile: ProfileRow | null;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-black/5">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 h-[68px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Albunyaan TV home">
            <span
              aria-hidden
              className="w-9 h-9 rounded-xl bg-brand grid place-items-center text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
              </svg>
            </span>
            <span className="leading-none">
              <span className="block text-[15px] font-extrabold tracking-tight text-ink">
                Albunyaan<span className="text-brand">TV</span>
              </span>
              <span className="block text-[9px] tracking-[0.25em] uppercase text-ink-muted mt-0.5">
                Albunyaan TV
              </span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-5" aria-label="Main">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-ink-secondary hover:text-brand transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2.5 shrink-0">
            {profile && (
              <Link
                href="/profiles"
                aria-label={`Active profile: ${profile.name}`}
                className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[12px] font-semibold text-white hover:opacity-90 transition"
                style={{ backgroundColor: `hsl(${profile.avatar_hue} 45% 35%)` }}
              >
                <span aria-hidden className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-white/25">
                  {profile.name[0]}
                </span>
                {profile.name}
                {profile.kind === 'kid' && <span className="opacity-75">· kids</span>}
              </Link>
            )}
            <LanguageSwitcher current={lang} />
            {/* Visual only — real auth arrives in Phase 3 */}
            <button className="hidden md:inline-flex px-4 py-1.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition">
              Log in
            </button>
            <button className="inline-flex px-4 py-1.5 rounded-full bg-brand hover:bg-brand-light text-white text-[13px] font-semibold transition">
              Sign up
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
