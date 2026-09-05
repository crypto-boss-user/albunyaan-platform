import Image from 'next/image';
import Link from 'next/link';
import type { ProfileRow } from '@albunyaan/core/data';
import { signOutAction } from '../app/auth/actions';
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
  memberEmail,
}: {
  lang: 'en' | 'ar' | 'nl';
  profile: ProfileRow | null;
  /** Auth user's email when logged in, null for anonymous visitors. */
  memberEmail: string | null;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-black/5">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 py-2">
          {/* Logo — het Arabische woordmerk van de storefront (SR 2b Theme Customization, 385×313; B13). Gemeten: de storefront rendert het logo in kop én voet op height: 100px (1440 + 390) → hier 100 px; de kopbalk groeit mee (was h-[68px]). */}
          <Link href="/" className="flex items-center shrink-0" aria-label="Albunyaan TV home">
            <Image src="/brand/logo-albunyaan.png" alt="Albunyaan TV" width={385} height={313} priority className="h-[100px] w-auto" />
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
            {/* Compact catalog search — plain GET form, no client JS */}
            <form action="/search" method="get" role="search" className="hidden md:block">
              <label className="relative block">
                <span className="sr-only">Search</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Search"
                  className="w-32 lg:w-44 rounded-full border border-black/10 bg-white ps-4 pe-8 py-1.5 text-[13px] outline-none focus:border-brand transition"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute end-1 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full text-ink-muted hover:text-brand transition"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                    <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </label>
            </form>
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
            {memberEmail ? (
              <>
                <Link
                  href="/account"
                  className="inline-flex px-4 py-1.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition"
                >
                  Account
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="hidden md:inline-flex px-4 py-1.5 rounded-full text-[13px] font-semibold text-ink-muted hover:text-red-700 transition"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden md:inline-flex px-4 py-1.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition"
                >
                  Log in
                </Link>
                {/* Signup is closed until the membership relaunch — /login explains. */}
                <Link
                  href="/login"
                  className="inline-flex px-4 py-1.5 rounded-full bg-brand hover:bg-brand-light text-white text-[13px] font-semibold transition"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
