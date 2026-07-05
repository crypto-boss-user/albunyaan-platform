/**
 * Real video player — renders Bunny Stream's iframe embed once a video has been
 * migrated (bunny_video_id set). Falls back to the poster placeholder for
 * anything still on Uscreen (the media migration runs incrementally).
 */
const LIBRARY_ID = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID;

export default function VideoPlayer({ bunnyVideoId, title }: { bunnyVideoId: string | null; title: string }) {
  if (!bunnyVideoId || !LIBRARY_ID) return null;
  return (
    <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
      <iframe
        src={`https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${bunnyVideoId}?autoplay=false&preload=true`}
        title={title}
        loading="lazy"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
