import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { getActiveProfile, getAuthUser, getLang } from '../lib/session';
import './globals.css';

/** Cairo = heading AND body font of the live storefront (SR 2b Theme Customization, Google Fonts 400–700; B13). */
const cairo = Cairo({ subsets: ['latin', 'arabic'], weight: ['400', '500', '600', '700'], variable: '--font-cairo' });

export const metadata: Metadata = {
  title: 'Albunyaan TV — Safe Islamic Streaming for the Whole Family',
  description:
    'Thousands of safe Islamic films, series and lectures. A non-profit sadaqah jaariyah for the Ummah.',
  /** Favicon van de storefront (SR 2b: favicontypes/…/favicon---albunyaan.png, 48×48) → public/favicon.png. */
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, profile, user] = await Promise.all([getLang(), getActiveProfile(), getAuthUser()]);
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-scroll-behavior="smooth"
      className={`${cairo.variable} scroll-smooth`}
    >
      <body className="antialiased font-sans">
        {/* Cookieless, no PII — inert until NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set (founder creates the site in Plausible first, see docs/founder-runbook.md item J). */}
        {plausibleDomain && (
          <script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        )}
        <SiteHeader lang={lang} profile={profile} memberEmail={user?.email ?? null} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
