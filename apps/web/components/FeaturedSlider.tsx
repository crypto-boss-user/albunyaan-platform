import Link from 'next/link';
import type { CategoryItemRow } from '@albunyaan/core/data';

/**
 * Featured band boven de catalogus (SR 4 stap 9; SR 2a catalog__1440__en `catalog_featured`: één slide per item van de
 * featured categorie "New releases" — beeld als achtergrond met gradient, h1 titel, korte beschrijving, knop "Watch Here").
 * Zonder client-JS: CSS scroll-snap i.p.v. de Swiper-slider; de puntjes zijn ankers naar de slides (aanname, aanpasbaar).
 * Speler/afspelen niet geraakt: "Watch Here" → programmapagina.
 */
export default function FeaturedSlider({ items }: { items: CategoryItemRow[] }) {
  if (items.length === 0) {
    return (
      <section data-featured aria-label="Featured" className="bg-surface-warm">
        <p className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10 text-[14px] text-ink-secondary">New releases volgen.</p>
      </section>
    );
  }
  return (
    <section data-featured aria-label="Featured" className="relative bg-[#6b7280]">
      <ul className="flex overflow-x-auto snap-x snap-mandatory row-scroll scroll-smooth list-none m-0 p-0">
        {items.map((it, i) => {
          const title = it.kind === 'video' ? it.video.title : it.collection.title;
          const slug = it.kind === 'video' ? it.video.slug : it.collection.slug;
          const img = it.kind === 'video' ? it.video.thumbnail_url : it.collection.cover;
          const desc = it.kind === 'video' ? it.video.short_description : it.collection.description;
          return (
            <li key={slug} id={`featured-${i + 1}`} className="relative snap-start shrink-0 w-full min-h-[320px] md:min-h-[420px] overflow-hidden">
              {img && (
                <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
              <div className="relative max-w-[1400px] mx-auto px-5 sm:px-8 py-14 md:py-24 text-white">
                <div className="max-w-[640px]">
                <h1 className="text-2xl md:text-4xl font-bold leading-tight">{title}</h1>
                {desc && <p className="mt-3 text-[15px] leading-relaxed line-clamp-3">{desc}</p>}
                <Link
                  href={`/programs/${slug}`}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-brand hover:bg-brand-dark transition text-white font-semibold text-[14px]"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                    <path d="M5 3v10l8-5z" fill="currentColor" />
                  </svg>
                  Watch Here
                </Link>
                {items.length > 1 && (
                  <div className="mt-6 flex" aria-label="Slides">
                    {items.map((_, j) => (
                      <a
                        key={j}
                        href={`#featured-${j + 1}`}
                        aria-label={`Slide ${j + 1}`}
                        aria-current={j === i ? 'true' : undefined}
                        className={`w-2 h-2 m-1 inline-block rounded-full bg-white ${j === i ? '' : 'opacity-20'}`}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
