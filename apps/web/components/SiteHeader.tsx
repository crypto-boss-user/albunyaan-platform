import Image from 'next/image';
import Link from 'next/link';
import type { ProfileRow } from '@albunyaan/core/data';
import { signOutAction } from '../app/auth/actions';
import LanguageSwitcher from './LanguageSwitcher';
import NavDropdown from './NavDropdown';

/**
 * Top nav — exact de gemeten storefront (SR 2a home__1440__en, SR 3-werklijst §3; B13): Home · Videos · Contact▾
 * (Contact, About us, Dawah) · Q&A · Coupon · Download apps, plus Log in en Sign up. Dropdown = NavDropdown.tsx:
 * CSS-hover/focus (opent op hover zoals de storefront op ≥ 1024 px én via Tab), sluit bij klik buiten, Escape en na
 * navigatie (minimale client-JS: alleen blur). AANNAME (aanpasbaar): tekstgrootte 14 px/ink en gap-6 zijn geschat
 * (nav-font van de storefront nog niet gemeten — SR 2c/SR 4 stap 7).
 */
type NavItem = { href: string; label: string } | { label: string; children: { href: string; label: string }[] };
const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/catalog', label: 'Videos' },
  {
    label: 'Contact',
    children: [
      { href: '/contact', label: 'Contact' },
      { href: '/about-us', label: 'About us' },
      { href: '/dawah', label: 'Dawah' },
    ],
  },
  { href: '/qa', label: 'Q&A' },
  { href: '/coupon', label: 'Coupon' },
  { href: '/download-app', label: 'Download apps' },
];

const LINK_CLS = 'text-[14px] font-medium text-ink hover:text-brand transition';

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

          {/* Nav (≥ 1024 px) */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Main">
            {NAV.map((item) =>
              'children' in item ? (
                <NavDropdown
                  key={item.label}
                  id={item.label.toLowerCase()}
                  label={item.label}
                  buttonClassName={LINK_CLS}
                  items={item.children}
                  chevron={
                    <svg width="12" height="8" viewBox="0 0 14 8" aria-hidden>
                      <path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  }
                />
              ) : (
                <Link key={item.href} href={item.href} className={LINK_CLS}>
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Zoekveld verwijderd uit de kop (founder, stap 3): de storefront zoekt op zijn cataloguspagina (Uscreen-URL's /catalog en /catalog/search); eigen /search en het catalog-formulier blijven bestaan; terug op /catalog in stap 9. */}
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
