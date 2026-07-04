import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Nav from '../components/Nav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: 'Albunyaan TV — Safe Islamic Streaming for the Whole Family',
  description:
    'Thousands of safe Islamic films, series and lectures. A non-profit sadaqah jaariyah for the Ummah.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} scroll-smooth`}>
      <body className="antialiased font-sans">
        <Nav />
        <main>{children}</main>
        <footer className="bg-surface-deep text-white/60 mt-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 text-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>Albunyaan TV — a non-profit da&rsquo;wah foundation. All revenue is sadaqah invested back into da&rsquo;wah.</p>
            <p className="text-white/40">Platform v0 preview — mock data</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
