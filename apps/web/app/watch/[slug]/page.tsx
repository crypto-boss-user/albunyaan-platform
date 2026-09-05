import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  canProfileWatch,
  getCollectionBySlug,
  getOverridesForProfile,
  getVideoBySlug,
  isCollectionBlocked,
} from '@albunyaan/core/data';
import { getActiveProfile } from '../../../lib/session';
import { sanitizeDescription } from '../../../lib/sanitize';
import LockedScreen from '../../../components/LockedScreen';
import { fmtDuration } from '../../../components/ThumbCard';

/** Eén keer per request (generateMetadata + page — review M-1). */
const getVideo = cache(getVideoBySlug);

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const video = await getVideo(slug);
  return { title: video?.title ?? 'Albunyaan' };
}

/**
 * /watch/:slug — de afleveringspagina (SR 4 stap 11, §5.14): was een redirect naar /programs/:slug die voor afleveringen in
 * 404 eindigde. Nu: spelerplek = POSTER (kijkplatformkeuze open, ⛔ Bunny — er wordt niets afgespeeld, geen embed, geen
 * bunny_video_id in de bron), COLLECTION-label, titel, beschrijving en de playlist van de collectie met de huidige aflevering
 * gemarkeerd (storefront: `?cid=…&permalink=…` op de collectie-URL; hier het eigen /watch-pad).
 * Ouderlijk toezicht (kind-profiel, T1 — zelfde regels als de single-video-tak van /programs; review I-1): geblokkeerde
 * aflevering → LockedScreen, geblokkeerde afleveringen in de playlist zonder link.
 * T2-GRENS (niet gebouwd, gemeld): afspelen, entitlement/paywall en favorieten. Zichtbaarheid = de bestaande data-laagregel
 * (getVideoBySlug: alleen published/live) — een draft-aflevering blijft 404 tot de zichtbaarheidsbeslissing (T2 na policies).
 */
export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [video, profile] = await Promise.all([getVideo(slug), getActiveProfile()]);
  if (!video) notFound();
  const collectionId = video.collection?.id ?? null;
  const overrides = profile && profile.kind === 'kid' ? await getOverridesForProfile(profile.id) : [];
  if (profile && collectionId && profile.kind === 'kid' && isCollectionBlocked(profile, collectionId, overrides)) {
    return <LockedScreen profileName={profile.name} title={video.collection!.title} />;
  }
  if (profile && !canProfileWatch(profile, video, collectionId, overrides)) {
    return <LockedScreen profileName={profile.name} title={video.title} />;
  }
  const collection = video.collection ? await getCollectionBySlug(video.collection.slug) : null;
  const episodes = collection?.episodes ?? [];

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="flex flex-col lg:flex-row gap-x-12 gap-y-8">
        {/* Spelerplek = poster */}
        <figure data-player-slot className="w-full lg:w-[55%] aspect-video rounded overflow-hidden bg-black relative">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="absolute inset-0" style={{ background: `hsl(${video.thumbnail_hue ?? 140} 48% 32%)` }} />
          )}
        </figure>
        <div className="w-full lg:w-[45%]">
          {video.collection ? (
            <Link href={`/programs/${video.collection.slug}`} className="text-brand text-[11px] font-bold uppercase tracking-wide hover:underline">
              Collection · {video.collection.title}
            </Link>
          ) : (
            <p className="text-brand text-[11px] font-bold uppercase tracking-wide">{video.status === 'live' ? 'Live channel' : 'Video'}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink mt-2">{video.title}</h1>
          {video.duration_seconds != null && video.status !== 'live' && (
            <p className="mt-2 text-[13px] text-ink-secondary">{fmtDuration(video.duration_seconds)}</p>
          )}
          <div
            className="mt-4 text-[15px] text-ink-secondary leading-relaxed [&_p]:mb-3"
            // Imported rich-text HTML (scraped from Uscreen) — NOT trusted: sanitized server-side to a strict allowlist.
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(video.description || `<p>${video.short_description ?? ''}</p>`) }}
          />
        </div>
      </div>

      {collection && episodes.length > 0 && (
        <section data-playlist className="mt-10 border-t border-black/5 pt-8">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink mb-5">{episodes.length} videos</p>
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 list-none">
            {episodes.map((ep) => {
              const current = ep.id === video.id;
              const allowed = canProfileWatch(profile, ep, collection.id, overrides);
              const Kaart = allowed ? Link : 'div';
              return (
                <li key={ep.id} aria-current={current ? 'true' : undefined} data-locked={allowed ? undefined : 'true'}>
                  <Kaart href={`/watch/${ep.slug}`} className={`block group rounded ${current ? 'outline-2 outline-brand' : ''} ${allowed ? '' : 'opacity-60'}`}>
                    <div className="relative aspect-video rounded overflow-hidden bg-black">
                      {ep.thumbnail_url && <img src={ep.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                      {ep.duration_seconds != null && (
                        <span className="absolute bottom-2 end-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {fmtDuration(ep.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[15px] text-ink truncate">{ep.title}</p>
                    {ep.short_description && <p className="text-[13px] text-ink-secondary line-clamp-2">{ep.short_description}</p>}
                    {!allowed && <p className="text-[12px] font-semibold text-ink-muted">Blocked by parent</p>}
                  </Kaart>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
