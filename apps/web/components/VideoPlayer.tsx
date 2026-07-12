import { signedEmbedUrl } from '../lib/bunny-embed';

/**
 * Real video player — renders Bunny Stream's iframe embed once a video has been
 * migrated (bunny_video_id set). Falls back to the poster placeholder for
 * anything still on Uscreen (the media migration runs incrementally).
 *
 * WS5: the embed URL is SIGNED server-side (lib/bunny-embed.ts). Callers gate
 * entitlement BEFORE rendering this — by the time we're here, this viewer may
 * watch; the token only stops the URL working outside this page/window.
 */
export default function VideoPlayer({ bunnyVideoId, title }: { bunnyVideoId: string | null; title: string }) {
  const src = bunnyVideoId ? signedEmbedUrl(bunnyVideoId) : null;
  if (!src) return null;
  return (
    <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
