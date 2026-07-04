import Link from 'next/link';
import type { Video } from '@albunyaan/core';
import AgeBadge from './AgeBadge';

function fmtDuration(s: number) {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

export default function VideoCard({ video, locked }: { video: Video; locked?: boolean }) {
  const inner = (
    <>
      <div
        aria-hidden
        className="aspect-video rounded-t-xl relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(${video.thumbnailHue} 45% 30%), hsl(${video.thumbnailHue + 25} 40% 18%))`,
        }}
      >
        <span className="absolute bottom-2 right-2 text-[11px] font-medium text-white/90 bg-black/40 px-2 py-0.5 rounded-full">
          {fmtDuration(video.durationSeconds)}
        </span>
        {locked && (
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-white text-[13px] font-semibold">
            Blocked by parent
          </span>
        )}
      </div>
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <AgeBadge rating={video.ageRating} />
          {video.access === 'free' && (
            <span className="text-[11px] font-semibold text-brand">FREE</span>
          )}
        </div>
        <h3 className="font-semibold text-[15px] leading-snug">{video.title}</h3>
        <p className="text-[13px] text-ink-secondary line-clamp-2">{video.shortDescription}</p>
      </div>
    </>
  );

  if (locked) {
    return <div className="card-elevated rounded-xl opacity-70">{inner}</div>;
  }
  return (
    <Link href={`/watch/${video.slug}`} className="card-elevated rounded-xl block focus:outline-2 focus:outline-brand">
      {inner}
    </Link>
  );
}
