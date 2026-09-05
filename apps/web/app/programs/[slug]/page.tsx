import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  canProfileWatch,
  getOverridesForProfile,
  getCategoriesForCollection,
  getProgramBySlug,
  hasActiveEntitlement,
  isCollectionBlocked,
  type ContentOverrideRow,
  type ProfileRow,
  type VideoRow,
} from '@albunyaan/core/data';
import { siteOrigin } from '../../../lib/origin';
import { getActiveProfile, getMember } from '../../../lib/session';
import { sanitizeDescription } from '../../../lib/sanitize';
import AgeBadge from '../../../components/AgeBadge';
import LockedScreen from '../../../components/LockedScreen';
import Paywall from '../../../components/Paywall';
import ThumbCard, { fmtDuration } from '../../../components/ThumbCard';
import VideoPlayer from '../../../components/VideoPlayer';

export const dynamic = 'force-dynamic';

/** Eén keer per request (generateMetadata + page delen de query — review M-1). */
const getProgram = cache(getProgramBySlug);

/** Paginatitel zoals de storefront (SR 2a program-my-words: title == programmatitel; §5.16). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  return { title: program ? (program.kind === 'series' ? program.collection.title : program.video.title) : 'Albunyaan' };
}

/** Deel-links zoals de storefront (SR 2b programmapagina hrefs: Facebook, LinkedIn, Pinterest, X) op de eigen URL. */
function shareLinks(url: string, title: string, image: string | null) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/shareArticle?url=${u}&text=${t}&summary=&mini=true` },
    { label: 'Pinterest', href: `https://pinterest.com/pin/create/button/?canonicalUrl=${u}&description=&media=${encodeURIComponent(image ?? '')}` },
    { label: 'X', href: `https://x.com/intent/tweet?url=${u}&text=${t}` },
  ];
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
  profile: ProfileRow | null,
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
              href={`/watch/${ep.slug}`}
              thumb={ep.thumbnail_url}
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

/**
 * /programs/:slug — series OR single video, matching the real site's URL pattern.
 * `profile` may be null (anonymous visitor / member without a selected profile):
 * that renders the unrestricted default view — parental filtering only exists
 * for an actual (kid) profile.
 */
export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [program, profile] = await Promise.all([getProgram(slug), getActiveProfile()]);
  if (!program) notFound();
  const overrides =
    profile && profile.kind === 'kid' ? await getOverridesForProfile(profile.id) : [];

  // ── series detail ──────────────────────────────────────────────────────────
  if (program.kind === 'series') {
    const { collection } = program;
    if (profile?.kind === 'kid' && isCollectionBlocked(profile, collection.id, overrides)) {
      return <LockedScreen profileName={profile.name} title={collection.title} />;
    }
    const visible = collection.episodes;
    const first = visible.find((ep) => canProfileWatch(profile, ep, collection.id, overrides));
    const cover = collection.raw?.cover_url ?? visible.find((ep) => ep.thumbnail_url)?.thumbnail_url ?? null;
    // Eigen URL via de gepinde SITE_URL (lib/origin.ts) — geen ruwe Host/X-Forwarded-Host in de deel-links (review I-2).
    const pageUrl = `${await siteOrigin()}/programs/${collection.slug}`;
    const tags = await getCategoriesForCollection(collection.id);
    const share = shareLinks(pageUrl, collection.title, cover);

    /* Programmapagina zoals de storefront (SR 4 stap 11; SR 2a program-my-words__1440__en anoniem; SR 2b programmapagina-
       ingelogd): cover-poster links (55 %) · rechts label "Collection", h1, beschrijving, knop "Start watching" (→ /watch van
       de eerste toegestane aflevering), Share, categorie-tags · daaronder "N videos" + de playlist als raster (het anonieme
       1440-beeld toont de playlist onder de kop; de admin-voorkeur "Sidebar" hoort bij de spelerweergave — aanname, aanpasbaar).
       Speler = poster (⛔ Bunny, kijkplatformkeuze open). T2, niet gebouwd: "Add to Favorites", afspelen, entitlement. */
    return (
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-x-12 gap-y-8">
          <figure data-poster className="w-full lg:w-[55%] aspect-video rounded overflow-hidden bg-black relative">
            {cover ? (
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div aria-hidden className="absolute inset-0" style={{ background: `hsl(${visible[0]?.thumbnail_hue ?? 120} 48% 32%)` }} />
            )}
          </figure>
          <div className="w-full lg:w-[45%]">
            <p className="text-brand text-[11px] font-bold uppercase tracking-wide">Collection</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-ink mt-2">{collection.title}</h1>
            {collection.description && <p className="mt-4 text-[14px] text-ink-secondary leading-relaxed">{collection.description}</p>}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              {first ? (
                <Link
                  href={`/watch/${first.slug}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-brand hover:bg-brand-dark transition text-white font-semibold text-[14px]"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                    <path d="M5 3v10l8-5z" fill="currentColor" />
                  </svg>
                  Start watching
                </Link>
              ) : (
                <p className="text-[14px] font-semibold text-ink-muted">
                  {profile ? `All episodes are outside ${profile.name}’s allowed catalog.` : 'No episodes available yet.'}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-secondary" role="group" aria-label="Share">
                <span>Share</span>
                {share.map((sh) => (
                  <a
                    key={sh.label}
                    href={sh.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-share={sh.label}
                    className="px-2 py-1 rounded border border-black/10 hover:border-brand hover:text-brand transition"
                  >
                    {sh.label}
                  </a>
                ))}
              </div>
            </div>
            {tags.length > 0 && (
              <ul data-tags className="mt-4 flex flex-wrap gap-2 list-none p-0">
                {tags.map((c) => (
                  <li key={c.id}>
                    <Link href={`/categories/${c.slug}`} className="inline-block rounded-full bg-brand-muted px-3 py-1 text-[12px] font-semibold text-brand-dark hover:bg-brand-soft transition">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <section data-playlist className="mt-10 border-t border-black/5 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink mb-5">{visible.length} videos</p>
          {episodeGrid(visible, collection.id, profile, overrides)}
        </section>
      </div>
    );
  }

  // ── single video / episode / live channel ─────────────────────────────────
  const { video } = program;
  const collectionId = video.collection?.id ?? null;
  if (profile && !canProfileWatch(profile, video, collectionId, overrides)) {
    return <LockedScreen profileName={profile.name} title={video.title} />;
  }
  const live = video.status === 'live';

  // WS5 entitlement gate — decided server-side BEFORE anything playable is
  // rendered: when locked, the Paywall branch renders instead of the player,
  // so the page source never carries the embed URL or bunny_video_id. Only
  // access='free' videos play without an active membership.
  let paywall: 'join' | 'renew' | null = null;
  if (video.access !== 'free') {
    const member = await getMember();
    if (!member) paywall = 'join';
    else if (!(await hasActiveEntitlement(member.id))) paywall = 'renew';
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
        {paywall ? (
          <Paywall kind={paywall} title={video.title} />
        ) : video.bunny_video_id ? (
          <VideoPlayer bunnyVideoId={video.bunny_video_id} title={video.title} />
        ) : (
          <PosterHero video={video} live={live} />
        )}
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
            // Imported rich-text HTML (scraped from Uscreen) — NOT trusted: sanitized
            // server-side to a strict allowlist before hitting dangerouslySetInnerHTML.
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(video.description || `<p>${video.short_description}</p>`) }}
          />
          {!paywall && (video.resources ?? []).length > 0 && (
            <div className="mt-6">
              <p className="section-label mb-2">Downloads</p>
              <ul className="space-y-2">
                {(video.resources ?? []).map((r) => (
                  <li key={r.id}>
                    {r.url ? (
                      <a
                        href={`${r.url}?download=${encodeURIComponent(r.title + (r.extension ? `.${r.extension}` : ''))}`}
                        className="inline-flex items-center gap-2 text-[14px] font-semibold text-brand hover:underline"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                          <path d="M8 2v8m0 0l3-3m-3 3L5 7M3 13h10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {r.title}
                        {r.extension && <span className="text-ink-muted font-normal uppercase text-[11px]">{r.extension}</span>}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-[14px] text-ink-muted" title="Bestand is veiliggesteld; downloadlink volgt">
                        {r.title}
                        {r.extension && <span className="uppercase text-[11px]">{r.extension}</span>}
                        <span className="text-[11px]">(binnenkort)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {paywall ? (
            <Link
              href={paywall === 'renew' ? '/account' : '/join'}
              className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
            >
              {paywall === 'renew' ? 'Renew membership' : 'Become a member'}
            </Link>
          ) : (
            <button className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <path d="M5 3v10l8-5z" fill="currentColor" />
              </svg>
              {live ? 'Watch live' : 'Watch now'}
            </button>
          )}
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
  profile: ProfileRow | null;
  overrides: ContentOverrideRow[];
}) {
  const { getCollectionBySlug } = await import('@albunyaan/core/data');
  const collection = await getCollectionBySlug(collectionSlug);
  if (!collection) return null;
  const rest = collection.episodes.filter((e) => e.id !== currentId).slice(0, 4);
  return episodeGrid(rest, collection.id, profile, overrides);
}
