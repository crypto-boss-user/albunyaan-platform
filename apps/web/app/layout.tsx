import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { getActiveProfile, getAuthUser, getLang } from '../lib/session';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Albunyaan TV — Safe Islamic Streaming for the Whole Family',
  description:
    'Thousands of safe Islamic films, series and lectures. A non-profit sadaqah jaariyah for the Ummah.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, profile, user] = await Promise.all([getLang(), getActiveProfile(), getAuthUser()]);

  return (
    <html
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${playfair.variable} scroll-smooth`}
    >
      <body className="antialiased font-sans">
        <SiteHeader lang={lang} profile={profile} memberEmail={user?.email ?? null} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
