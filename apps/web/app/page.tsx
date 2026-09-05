import Link from 'next/link';
import { getCatalogCounts, getCatalogRows } from '@albunyaan/core/data';
import CatalogRows from '../components/CatalogRows';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [rows, counts] = await Promise.all([getCatalogRows(), getCatalogCounts()]);

  return (
    <>
      {/* Hero — Light scheme (B13, SR 4 stap 1). AANNAME (aanpasbaar): light brand-muted background until stap 7
          replaces this block with the measured photo banner (hero-banner-albunyaan 2880×1280). */}
      <section className="bg-brand-muted text-ink border-b border-black/5">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-20 sm:py-28 text-center">
          <p className="fade-in text-2xl sm:text-4xl font-extrabold leading-relaxed" dir="rtl" lang="ar">
            منصة إعلامية إسلامية وقفية دعوية غير تجارية
          </p>
          <h1 className="fade-in fade-in-delay-1 mt-5 text-xl sm:text-3xl font-extrabold tracking-tight uppercase text-ink">
            An Islamic multimedia platform —{' '}
            <span className="text-brand">a non-commercial da&rsquo;wah initiative</span>
          </h1>
          <p className="fade-in fade-in-delay-2 mt-4 text-ink-secondary text-[15px] max-w-xl mx-auto">
            Thousands of films, series, live channels and lectures — free of music and unsafe
            content. Every subscription is sadaqah invested back into da&rsquo;wah.
          </p>
          <div className="fade-in fade-in-delay-2 mt-9 flex items-center justify-center gap-4">
            <Link
              href="/catalog"
              className="play-pulse inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <path d="M5 3v10l8-5z" fill="currentColor" />
              </svg>
              Watch Here
            </Link>
            <Link
              href="/parents"
              className="inline-flex px-7 py-3.5 rounded-full bg-white border border-black/10 hover:border-brand hover:text-brand transition text-ink font-semibold text-[15px]"
            >
              Parental controls
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-surface-warm border-b border-black/5">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            [String(counts.videos), 'videos & live channels'],
            [String(counts.collections), 'kids’ series'],
            ['3', 'languages (EN·AR·NL)'],
            ['100%', 'non-profit waqf'],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="text-3xl font-extrabold text-brand">{n}</p>
              <p className="text-[13px] text-ink-secondary mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* First catalog rows — straight from the DB */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 py-14">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="section-label">Watch now</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Fresh from the library
            </h2>
          </div>
          <Link href="/catalog" className="text-[13px] font-semibold text-brand hover:text-brand-dark transition">
            Browse the full catalog →
          </Link>
        </div>
        <CatalogRows rows={rows.slice(0, 5)} maxPerRow={10} />
      </section>
    </>
  );
}
