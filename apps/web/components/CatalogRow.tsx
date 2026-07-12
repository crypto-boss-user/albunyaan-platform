'use client';

import Link from 'next/link';
import { useRef } from 'react';

/**
 * One catalog row: title + "See All" + horizontal snap carousel with arrows,
 * matching the real catalog's row grammar (reference/real-catalog.png).
 */
export default function CatalogRow({
  title,
  seeAllHref,
  children,
}: {
  title: string;
  /** null hides See All — the live rail shows every channel already. */
  seeAllHref: string | null;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function nudge(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  return (
    <section className="group/row">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight text-ink">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-[13px] font-semibold text-ink-muted hover:text-brand transition whitespace-nowrap"
          >
            See All
          </Link>
        )}
      </div>
      <div className="relative">
        <div
          ref={scroller}
          className="row-scroll flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory"
        >
          {children}
        </div>
        <button
          aria-label="Scroll backward"
          onClick={() => nudge(-1)}
          className="row-arrow start-0 -translate-x-1/2 rtl:translate-x-1/2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="rtl:rotate-180">
            <path d="M9 2L4 7l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          aria-label="Scroll forward"
          onClick={() => nudge(1)}
          className="row-arrow end-0 translate-x-1/2 rtl:-translate-x-1/2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="rtl:rotate-180">
            <path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

/** Fixed-width carousel cell: ~4 cards per viewport at desktop, like the real site. */
export function RowItem({ children }: { children: React.ReactNode }) {
  return <div className="snap-start shrink-0 w-[220px] sm:w-[250px] lg:w-[280px]">{children}</div>;
}
