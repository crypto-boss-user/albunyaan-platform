import Link from 'next/link';

export interface ThumbCardProps {
  title: string;
  href: string;
  hue: number;
  /** Big glyph on the placeholder poster (initial letter, or 📡 for live). */
  glyph?: string;
  live?: boolean;
  durationSeconds?: number | null;
  /** Episode count pill (series cards) — mirrors the real site's 🔒 n badge. */
  count?: number;
  free?: boolean;
  locked?: boolean;
}

export function fmtDuration(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

/**
 * 16:9 landscape card matching the real catalog's card grammar:
 * thumb + LIVE badge / count pill / duration pill, title underneath.
 * Placeholder hue gradients until real artwork lands (manhaj-safe by construction).
 */
export default function ThumbCard(props: ThumbCardProps) {
  const { title, href, hue, glyph, live, durationSeconds, count, free, locked } = props;

  const thumb = (
    <div
      aria-hidden
      className="aspect-video rounded-xl relative overflow-hidden thumb-zoom"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 48% 34%), hsl(${(hue + 30) % 360} 45% 18%))`,
      }}
    >
      <span className="absolute inset-0 grid place-items-center text-4xl font-extrabold text-white/25 select-none">
        {glyph ?? title.replace(/[^A-Za-z؀-ۿ]/g, '')[0] ?? '•'}
      </span>
      {live && (
        <span className="absolute bottom-2 start-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white bg-red-600 px-2 py-0.5 rounded live-dot">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-white" />
          Live
        </span>
      )}
      {typeof count === 'number' && (
        <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded">
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
            <path d="M3 5V3.5a3 3 0 016 0V5h.5A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11h-7A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5H3zm1.5 0h3V3.5a1.5 1.5 0 00-3 0V5z" fill="currentColor" />
          </svg>
          {count}
        </span>
      )}
      {!live && typeof count !== 'number' && typeof durationSeconds === 'number' && durationSeconds > 0 && (
        <span className="absolute bottom-2 end-2 text-[11px] font-medium text-white bg-black/60 px-2 py-0.5 rounded">
          {fmtDuration(durationSeconds)}
        </span>
      )}
      {free && !live && (
        <span className="absolute top-2 start-2 text-[10px] font-bold uppercase tracking-wide text-white bg-brand px-2 py-0.5 rounded">
          Free
        </span>
      )}
      {locked && (
        <span className="absolute inset-0 grid place-items-center bg-black/60 text-white text-[13px] font-semibold backdrop-blur-[2px]">
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 5V3.5a3 3 0 016 0V5h.5A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11h-7A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5H3zm1.5 0h3V3.5a1.5 1.5 0 00-3 0V5z" fill="currentColor" />
            </svg>
            Blocked by parent
          </span>
        </span>
      )}
      {!locked && (
        <span className="thumb-play absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200">
          <span className="w-11 h-11 rounded-full bg-white/90 grid place-items-center text-brand shadow-lg">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M5 3v10l8-5z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </div>
  );

  const label = (
    <p className={`mt-2 text-[13px] font-medium leading-snug line-clamp-2 ${locked ? 'text-ink-muted' : 'text-ink'}`}>
      {title}
    </p>
  );

  if (locked) {
    return (
      <div className="group opacity-75">
        {thumb}
        {label}
      </div>
    );
  }
  return (
    <Link href={href} className="group block focus:outline-2 focus:outline-brand rounded-xl">
      {thumb}
      {label}
    </Link>
  );
}
