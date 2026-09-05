import Image from 'next/image';
import Link from 'next/link';

/**
 * Footer exact als de gemeten storefront (SR 2a home__1440__en footer; SR 2b Footer-blokpaneel; B13; SR 4 stap 5):
 * logo · 6 tekstlinks (Videos, Q&A, Contact, Donate, Terms of service, Privacy policy) · "© Albunyaan <jaar>" ·
 * 2 app-badges (App Store, Google Play) · 3 social-iconen (Instagram, Facebook, YouTube) met de storefront-doelen.
 * Privacy policy staat sinds SR 0 (2026-09-03) wél in de live footer (§7 T15 = convergentie).
 * AANNAMES (aanpasbaar): Donate → eigen /donate (storefront: externe Stripe-link, B68); badges als tekstknoppen (geen
 * officiële badge-beelden in de assets); indeling logo links/links rechts, daaronder © links, badges midden, iconen rechts
 * (zoals het 1440-beeld); op < 768 px alles gecentreerd zoals het 390-beeld. De Uscreen-tagline bestond niet → weggelaten.
 * AANNAME B63 (founderkeuze, aanpasbaar): de app-badges linken tot de cutover naar de bestaande Uscreen-apps (de
 * storefront-doelen); bij de cutover vervangen door de nieuwe apps of uitzetten — zie docs/cutover-runbook.md.
 * AANNAME: © met het lopende jaar (storefront-veld is de statische tekst "© Albunyaan 2026").
 */
const LINKS = [
  { href: '/catalog', label: 'Videos' },
  { href: '/qa', label: 'Q&A' },
  { href: '/contact', label: 'Contact' },
  { href: '/donate', label: 'Donate' },
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
];

/** Storefront-doelen (SR 2b `thema/pages/index.json` Footer-paneel). */
const APPS = [
  { href: 'https://apps.apple.com/nl/app/albunyaan-tv/id1666119687', label: 'Download on the App Store', kicker: 'Download on the', name: 'App Store' },
  { href: 'https://play.google.com/store/apps/details?id=tv.uscreen.albunyaan2', label: 'Get it on Google Play', kicker: 'GET IT ON', name: 'Google Play' },
];
const SOCIAL = [
  { href: 'https://www.instagram.com/albunyaantv/', label: 'Instagram', d: 'M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z' },
  { href: 'https://www.facebook.com/albunyaan', label: 'Facebook', d: 'M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z' },
  { href: 'https://m.youtube.com/@albunyaan?', label: 'YouTube', d: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z' },
];

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-black/5 text-ink-secondary mt-24">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-start">
          <Link href="/" aria-label="Albunyaan TV home" className="flex">
            <Image src="/brand/logo-albunyaan.png" alt="Albunyaan TV" width={385} height={313} className="h-[100px] w-auto" />
          </Link>
          <nav className="flex flex-wrap justify-center md:justify-end gap-x-7 gap-y-3" aria-label="Footer">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[14px] text-ink hover:text-brand transition">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-black/5 my-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-[13px] text-ink-secondary">
          <p>© Albunyaan {new Date().getFullYear()}</p>
          <div className="flex items-center gap-3" role="group" aria-label="Apps">
            {APPS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                aria-label={a.label}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex flex-col leading-tight rounded-lg bg-black text-white px-3.5 py-1.5 hover:bg-ink transition"
              >
                <span className="text-[9px] uppercase tracking-wide opacity-80">{a.kicker}</span>
                <span className="text-[14px] font-semibold">{a.name}</span>
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4" role="group" aria-label="Social">
            {SOCIAL.map((s) => (
              <a
                key={s.href}
                href={s.href}
                aria-label={s.label}
                rel="noopener noreferrer"
                target="_blank"
                className="text-ink hover:text-brand transition"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                  <path d={s.d} fill="currentColor" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
