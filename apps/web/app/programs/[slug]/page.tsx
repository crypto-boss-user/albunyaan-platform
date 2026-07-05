import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  canProfileWatch,
  getOverrides,
  getProgramBySlug,
  isCollectionBlocked,
  type ContentOverrideRow,
  type ProfileRow,
  type VideoRow,
} from '@albunyaan/core/data';
import { getActiveProfile } from '../../../lib/session';
import AgeBadge from '../../../components/AgeBadge';
import ThumbCard, { fmtDuration } from '../../../components/ThumbCard';

export const dynamic = 'force-dynamic';

/** Friendly locked screen — shown instead of any program content. */
function LockedScreen({ profileName, title }: { profileName: string; title: string }) {
  return (
    <div className="max-w-xl mx-auto px-5 py-28 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-brand-soft grid place-items-center text-brand mb-6">
        <svg width="34" height="34" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 5V3.5a3 3 0 016 0V5h.5A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11h-7A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5H3zm1.5 0h3V3.5a1.5 1.5 0 00-3 0V5z" fill="currentColor" />
        </svg>
      </div>
      <p className="section-label">Parental controls</p>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 mb-3">
        This one isn&rsquo;t for you right now, {profileName}
      </h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed">
        <strong>{title}</strong>
        {' has been set aside by your parent. There’s plenty more to explore — pick something else in sha’ Allah!'}
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/catalog" className="px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px]">
          Back to the catalog
        </Link>
        <Link href="/profiles" className="px-6 py-3 rounded-full bg-brand-muted text-brand-dark hover:bg-brand-soft transition font-semibold text-[14px]">
          Switch profile
        </Link>
      </div>
    </div>
  );
}

function PosterHero({ video, live }: { video: { title: string; thumbnail_hue: number | null }; live?: boolean }) {
  const hue = video.thumbnail_hue ?? 140;
  return (
    <div
      aria-hidden
      className="aspect-video rounded-2xl relative overflow-hidden shadow-xl"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 48% 32%), hsl(${(hue + 30) % 360} 45% 15%))` }}
    >
      <span className="absolute inset-0 grid place-items-center">
        <span className="w-16 h-16 rounded-full bg-white/90 grid place-items-center text-brand shadow-lg play-pulse">
          <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden>
            <path d="M5 3v10l8-5z" fill="currentColor" />
          </svg>
        </span>
      </span>
      {live && (
        <span className="absolute top-4 start-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white bg-red-600 px-2.5 py-1 rounded live-dot">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white" />
          Live now
        </span>
      )}
      <span className="absolute bottom-4 inset-x-4 text-center text-[12px] text-white/60 bg-black/35 rounded-full px-4 py-1.5 backdrop-blur-sm">
        Player placeholder — real streams land with the media migration (Phase 2/6)
      </span>
    </div>
  );
}

function episodeGrid(
  episodes: (VideoRow & { position: number })[],
  collectionId: string,
  profile: ProfileRow,
  overrides: ContentOverrideRow[],
) {
  return (
    <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 list-none">
      {episodes.map((ep) => {
        const allowed = canProfileWatch(profile, ep, collectionId, overrides);
        return (
          <li key={ep.id}>
            <ThumbCard
              title={ep.title}
              href={`/programs/${ep.slug}`}
              hue={ep.thumbnail_hue ?? 120}
              durationSeconds={ep.duration_seconds}
              free={ep.access === 'free'}
              locked={!allowed}
            />
          </li>
        );
      })}
    </ol>
  );
}

/** /programs/:slug — series OR single video, matching the real site's URL pattern. */
export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [program, profile] = await Promise.all([getProgramBySlug(slug), getActiveProfile()]);
  if (!program) notFound();
  if (!profile) throw new Error('No profiles seeded — run worker/seed-catalog.ts');
  const overrides = await getOverrides(profile.kind === 'kid' ? profile.id : undefined);

  // ── series detail ──────────────────────────────────────────────────────────
  if (program.kind === 'series') {
    const { collection } = program;
    if (profile.kind === 'kid' && isCollectionBlocked(profile, collection.id, overrides)) {
      return <LockedScreen profileName={profile.name} title={collection.title} />;
    }
    const visible = collection.episodes;
    const first = visible.find((ep) => canProfileWatch(profile, ep, collection.id, overrides));

    return (
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start mb-14">
          <PosterHero video={{ title: collection.title, thumbnail_hue: visible[0]?.thumbnail_hue ?? 120 }} />
          <div>
            <p className="section-label">Series</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">{collection.title}</h1>
            <div className="flex items-center gap-3 mb-5 text-[13px] text-ink-secondary">
              <AgeBadge rating={visible[0]?.age_rating ?? 'all'} />
              <span>{visible.length} episodes</span>
              <span aria-hidden>·</span>
              <span>Arabic</span>
            </div>
            <p className="text-[15px] text-ink-secondary leading-relaxed mb-8">{collection.description}</p>
            {first ? (
              <Link
                href={`/programs/${first.slug}`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                  <path d="M5 3v10l8-5z" fill="currentColor" />
                </svg>
                Watch Episode {first.position}
              </Link>
            ) : (
              <p className="text-[14px] font-semibold text-ink-muted">
                All episodes are outside {profile.name}&rsquo;s allowed catalog.
              </p>
            )}
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-5">Episodes</h2>
        {episodeGrid(visible, collection.id, profile, overrides)}
      </div>
    );
  }

  // ── single video / episode / live channel ─────────────────────────────────
  const { video } = program;
  const collectionId = video.collection?.id ?? null;
  if (!canProfileWatch(profile, video, collectionId, overrides)) {
    return <LockedScreen profileName={profile.name} title={video.title} />;
  }
  const live = video.status === 'live';

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
        <PosterHero video={video} live={live} />
        <div>
          {video.collection ? (
            <Link href={`/programs/${video.collection.slug}`} className="section-label hover:underline">
              {video.collection.title}
            </Link>
          ) : (
            <p className="section-label">{live ? 'Live channel' : 'Video'}</p>
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">{video.title}</h1>
          <div className="flex items-center gap-3 mb-5 text-[13px] text-ink-secondary">
            <AgeBadge rating={video.age_rating} />
            {live ? (
              <span className="font-semibold text-red-600">Streaming live 24/7</span>
            ) : (
              video.duration_seconds != null && <span>{fmtDuration(video.duration_seconds)}</span>
            )}
            {video.access === 'free' && <span className="font-bold text-brand uppercase text-[11px]">Free</span>}
          </div>
          <div
            className="text-[15px] text-ink-secondary leading-relaxed [&_p]:mb-3"
            // Seeded/imported rich-text HTML (same shape Uscreen stores) — trusted pipeline.
            dangerouslySetInnerHTML={{ __html: video.description || `<p>${video.short_description}</p>` }}
          />
          <button className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <path d="M5 3v10l8-5z" fill="currentColor" />
            </svg>
            {live ? 'Watch live' : 'Watch now'}
          </button>
        </div>
      </div>

      {video.collection && (
        <div className="mt-16">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xl font-bold tracking-tight">More from {video.collection.title}</h2>
            <Link
              href={`/programs/${video.collection.slug}`}
              className="text-[13px] font-semibold text-ink-muted hover:text-brand transition"
            >
              See All
            </Link>
          </div>
          <MoreFromSeries collectionSlug={video.collection.slug} currentId={video.id} profile={profile} overrides={overrides} />
        </div>
      )}
    </div>
  );
}

async function MoreFromSeries({
  collectionSlug,
  currentId,
  profile,
  overrides,
}: {
  collectionSlug: string;
  currentId: string;
  profile: ProfileRow;
  overrides: ContentOverrideRow[];
}) {
  const { getCollectionBySlug } = await import('@albunyaan/core/data');
  const collection = await getCollectionBySlug(collectionSlug);
  if (!collection) return null;
  const rest = collection.episodes.filter((e) => e.id !== currentId).slice(0, 4);
  return episodeGrid(rest, collection.id, profile, overrides);
}
