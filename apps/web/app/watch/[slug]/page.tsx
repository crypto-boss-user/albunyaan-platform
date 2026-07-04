'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { canWatch, categories, series, videos } from '@albunyaan/core';
import AgeBadge from '../../../components/AgeBadge';
import VideoCard from '../../../components/VideoCard';
import { useActiveProfile, useOverrides } from '../../../lib/store';

export default function WatchPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile, allProfiles, hydrated: pHydrated } = useActiveProfile();
  const { overrides, setOverride, hydrated: oHydrated } = useOverrides();

  const video = videos.find((v) => v.slug === slug);
  if (!video) {
    return (
      <div className="pt-[72px] max-w-4xl mx-auto px-5 py-24">
        <h1 className="text-2xl font-bold">Video not found</h1>
        <Link href="/catalog" className="text-brand font-semibold">← Back to catalog</Link>
      </div>
    );
  }
  if (!pHydrated || !oHydrated) {
    return <div className="pt-[72px] max-w-4xl mx-auto px-5 py-24 text-ink-muted">Loading…</div>;
  }

  const allowed = canWatch(profile, video, overrides);
  const parentSeries = video.seriesId ? series.find((s) => s.id === video.seriesId) : null;
  const episodes = parentSeries
    ? videos.filter((v) => v.seriesId === parentSeries.id && v.id !== video.id)
    : [];
  const kids = allProfiles.filter((p) => p.kind === 'kid');

  return (
    <div className="pt-[72px] max-w-5xl mx-auto px-5 sm:px-8 py-12">
      {/* Player placeholder */}
      <div
        className="aspect-video rounded-2xl relative overflow-hidden grid place-items-center"
        style={{
          background: `linear-gradient(135deg, hsl(${video.thumbnailHue} 45% 26%), hsl(${video.thumbnailHue + 25} 40% 14%))`,
        }}
      >
        {allowed ? (
          <button
            aria-label={`Play ${video.title}`}
            className="play-pulse w-20 h-20 rounded-full bg-brand grid place-items-center hover:bg-brand-light transition"
          >
            <svg aria-hidden className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <div className="text-center text-white px-6">
            <p className="text-xl font-bold">Blocked for {profile.name}</p>
            <p className="text-white/70 text-[14px] mt-2">
              A parent has restricted this video, or it&rsquo;s outside the {profile.ageBand} age band.
            </p>
            <Link href="/parents" className="inline-block mt-4 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 transition text-[13px] font-semibold">
              Open parent dashboard
            </Link>
          </div>
        )}
        <p className="absolute bottom-3 right-4 text-[11px] text-white/50">
          v0 preview — Bunny Stream playback lands in Phase 2
        </p>
      </div>

      {/* Metadata */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <AgeBadge rating={video.ageRating} />
        {video.categoryIds.map((id) => {
          const c = categories.find((x) => x.id === id);
          return c ? (
            <Link key={id} href={`/catalog?cat=${c.slug}`} className="text-[12px] font-semibold text-brand-dark bg-brand-muted px-3 py-1 rounded-full hover:bg-brand-soft transition">
              {c.name}
            </Link>
          ) : null;
        })}
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mt-4">{video.title}</h1>
      <p className="text-ink-secondary mt-3 max-w-2xl">{video.shortDescription}</p>
      {parentSeries && (
        <p className="text-[14px] text-ink-muted mt-2">
          Episode {video.episodeNumber} of <strong>{parentSeries.title}</strong>
        </p>
      )}

      {/* One-tap parental block (adult profiles only) */}
      {profile.kind === 'adult' && kids.length > 0 && (
        <div className="mt-8 card-elevated rounded-2xl p-6">
          <p className="section-label mb-3">Parental controls</p>
          <div className="flex flex-wrap gap-3">
            {kids.map((k) => {
              const blocked = overrides.some(
                (o) => o.profileId === k.id && o.action === 'block' && o.target.kind === 'video' && o.target.id === video.id,
              );
              return (
                <button
                  key={k.id}
                  onClick={() =>
                    setOverride({
                      profileId: k.id,
                      target: { kind: 'video', id: video.id },
                      action: blocked ? 'allow' : 'block',
                    })
                  }
                  className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${
                    blocked ? 'bg-brand text-white' : 'bg-surface-warm text-ink hover:bg-brand-muted'
                  }`}
                >
                  {blocked ? `Unblock for ${k.name}` : `Block for ${k.name}`}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-ink-muted mt-3">
            One tap blocks this video on {kids.map((k) => k.name).join(' and ')}&rsquo;s profiles — everywhere, including future offline downloads.
          </p>
        </div>
      )}

      {/* More from series */}
      {episodes.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-extrabold tracking-tight mb-6">More from {parentSeries!.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {episodes.slice(0, 3).map((v) => (
              <VideoCard key={v.id} video={v} locked={!canWatch(profile, v, overrides)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
