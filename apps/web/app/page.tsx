import Link from 'next/link';
import { categories, series, videos } from '@albunyaan/core';
import VideoCard from '../components/VideoCard';

export default function Home() {
  const featured = videos.filter((v) => v.seriesId === null).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="gradient-hero text-white pt-[72px]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 text-center">
          <p className="section-label fade-in !text-brand-light mb-6">
            100% non-profit · Est. 2011 · Scholar-filtered
          </p>
          <h1 className="fade-in fade-in-delay-1 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            Safe Islamic streaming for the <span className="gradient-text-green">whole family</span>
          </h1>
          <p className="fade-in fade-in-delay-2 mt-6 text-white/70 text-lg max-w-xl mx-auto">
            Thousands of films, series and lectures — free of music and unsafe content. Every
            subscription is sadaqah invested back into da&rsquo;wah.
          </p>
          <div className="fade-in fade-in-delay-2 mt-10 flex items-center justify-center gap-4">
            <Link
              href="/catalog"
              className="play-pulse inline-flex px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
            >
              Browse the catalog
            </Link>
            <Link
              href="/parents"
              className="inline-flex px-7 py-3.5 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition text-white font-semibold text-[15px]"
            >
              Parental controls
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface-warm">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            ['1000s', 'of films & series'],
            ['100%', 'non-profit waqf'],
            ['3', 'languages (EN·AR·NL)'],
            ['0', 'music or unsafe scenes'],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="text-3xl font-extrabold text-brand">{n}</p>
              <p className="text-[13px] text-ink-secondary mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New in v0: differentiators */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <p className="section-label">New on the Albunyaan platform</p>
        <h2 className="text-3xl font-extrabold tracking-tight mt-2 mb-10">
          Built for parents, not just viewers
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card-elevated rounded-2xl p-8">
            <h3 className="font-bold text-lg mb-2">Real parental controls</h3>
            <p className="text-ink-secondary text-[15px] leading-relaxed">
              Kid profiles with age-appropriate catalogs. Block any video for any child in one tap
              — or allow a specific series beyond their age band. PIN-protected, with per-child
              watch history. <Link href="/parents" className="text-brand font-semibold">Try the demo →</Link>
            </p>
          </div>
          <div className="card-elevated rounded-2xl p-8">
            <h3 className="font-bold text-lg mb-2">Download whole series in one tap</h3>
            <p className="text-ink-secondary text-[15px] leading-relaxed">
              Coming to the mobile apps: download an entire playlist or series at once for
              offline watching — with quality choice and a wifi-only toggle. No more one-by-one.
            </p>
          </div>
        </div>
      </section>

      <div className="line-divider max-w-6xl mx-auto" />

      {/* Featured */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <p className="section-label">Watch now</p>
        <h2 className="text-3xl font-extrabold tracking-tight mt-2 mb-10">Featured</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {featured.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalog?cat=${c.slug}`}
              className="px-4 py-2 rounded-full bg-brand-muted text-brand-dark text-[13px] font-semibold hover:bg-brand-soft transition"
            >
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mt-8 text-[13px] text-ink-muted">
          {series.length} series · {videos.length} videos in this v0 preview — the full ~6,700-item
          library arrives with the content migration.
        </p>
      </section>
    </>
  );
}
