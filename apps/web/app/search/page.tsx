import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getAllCategories,
  getCategoryBySlug,
  getCategoryRows,
  searchCatalog,
  type CategoryItemRow,
} from '@albunyaan/core/data';
import CatalogFilters from '../../components/CatalogFilters';
import ThumbCard from '../../components/ThumbCard';
import { getLang, type Lang } from '../../lib/session';

export const dynamic = 'force-dynamic';

/** Titel zoals gemeten (SR 2a search__1440__en). */
export const metadata: Metadata = { title: 'Albunyaan' };
/** Minimal per-language strings (dir/RTL comes from the root layout). */
const T: Record<Lang, { series: string; episodes: string; tooShort: string; none: (q: string) => string }> = {
  en: { series: 'Series', episodes: 'Videos', tooShort: 'Type at least 2 characters to search.', none: (q) => `Nothing found for “${q}”.` },
  nl: { series: 'Series', episodes: 'Video’s', tooShort: 'Typ minstens 2 tekens om te zoeken.', none: (q) => `Niets gevonden voor “${q}”.` },
  ar: { series: 'المسلسلات', episodes: 'الفيديوهات', tooShort: 'اكتب حرفين على الأقل للبحث.', none: (q) => `لم يتم العثور على نتائج لـ «${q}».` },
};

/** Storefront-startweergave: 80 programma's (SR 2a search__1440__en: programma-links uniek 80). */
const RASTER_MAX = 80;

function ItemCard({ it }: { it: CategoryItemRow }) {
  return it.kind === 'video' ? (
    <ThumbCard
      title={it.video.title}
      href={`/programs/${it.video.slug}`}
      hue={it.video.thumbnail_hue ?? 200}
      thumb={it.video.thumbnail_url}
      live={it.video.status === 'live'}
      durationSeconds={it.video.duration_seconds}
      free={it.video.access === 'free'}
    />
  ) : (
    <ThumbCard title={it.collection.title} href={`/programs/${it.collection.slug}`} hue={200} thumb={it.collection.cover} count={it.collection.episodeCount} />
  );
}

/**
 * /search zoals de storefront (SR 4 stap 9; SR 2a search__1440__en = `/catalog/search`): filterbalk bovenaan en DIRECT een
 * raster met programma's (geen lege startpagina); met ?q= de zoekresultaten (series + video's), met ?category= de inhoud
 * van die categorie (gemengd, in Uscreen-volgorde); q én category = resultaten beperkt tot die categorie.
 * AANNAME (aanpasbaar): het startraster = de unieke zichtbare items van alle catalogusrijen (max 80), zoals de storefront
 * haar eerste pagina programma's toont; lazy paginering (storefront) is hier niet gebouwd. q + category zoekt in de titels van
 * de categorie-inhoud zelf (niet: de globale top-30 nafilteren — review I-3); een onbekende categorie-slug → notFound() (M-1); omdat de pagina streamt (loading.tsx) is dat de 404-pagina met HTTP 200 (soft-404) — VRAAG teamreview: loading.tsx weg of laten.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; category?: string | string[] }> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const qRaw = one(sp.q);
  const categorySlug = one(sp.category);
  const [lang, categories] = await Promise.all([getLang(), getAllCategories()]);
  const t = T[lang];

  const category = categorySlug ? await getCategoryBySlug(categorySlug) : null;
  if (categorySlug && !category) notFound();
  const categoryItems = category?.items ?? null;

  const { q, series, episodes } = categoryItems ? { q: qRaw.trim(), series: [], episodes: [] } : await searchCatalog(qRaw);
  const tooShort = q.length > 0 && q.length < 2;
  const searched = q.length >= 2;
  const titleOf = (it: CategoryItemRow) => (it.kind === 'video' ? it.video.title : it.collection.title);
  const slugOf = (it: CategoryItemRow) => (it.kind === 'video' ? it.video.slug : it.collection.slug);

  // Raster: zonder q de categorie-inhoud óf de unieke items van alle rijen; met q binnen een categorie de titeltreffers.
  let raster: CategoryItemRow[] = [];
  if (categoryItems) {
    const needle = q.toLocaleLowerCase();
    raster = (searched ? categoryItems.filter((it) => titleOf(it).toLocaleLowerCase().includes(needle)) : categoryItems).slice(0, RASTER_MAX);
  } else if (!searched) {
    const seen = new Set<string>();
    for (const row of await getCategoryRows(RASTER_MAX)) {
      if (row.kind !== 'category') continue;
      for (const it of row.items) {
        if (!seen.has(slugOf(it))) {
          seen.add(slugOf(it));
          raster.push(it);
        }
      }
    }
    raster = raster.slice(0, RASTER_MAX);
  }
  const empty = searched && series.length === 0 && episodes.length === 0 && raster.length === 0;
  const toonRaster = !searched || !!categoryItems;

  return (
    <>
      <CatalogFilters categories={categories} q={q} category={category?.slug ?? ''} open />
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
        {tooShort && <p className="text-[14px] text-ink-secondary">{t.tooShort}</p>}
        {empty && <p className="text-[15px] text-ink-secondary">{t.none(q)}</p>}

        {toonRaster && raster.length > 0 && (
          <div data-raster className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {raster.map((it) => (
              <ItemCard key={it.kind === 'video' ? `v-${it.video.id}` : `c-${it.collection.id}`} it={it} />
            ))}
          </div>
        )}

        {series.length > 0 && (
          <section className="mb-12">
            <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight text-ink mb-4">
              {t.series} <span className="text-ink-muted font-medium">({series.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {series.map((s) => (
                <ThumbCard key={s.slug} title={s.title} href={`/programs/${s.slug}`} hue={s.thumbnail_hue ?? 160} thumb={s.thumbnail_url} count={s.episodeCount} />
              ))}
            </div>
          </section>
        )}

        {episodes.length > 0 && (
          <section>
            <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight text-ink mb-4">
              {t.episodes} <span className="text-ink-muted font-medium">({episodes.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {episodes.map((v) => (
                <ThumbCard
                  key={v.id}
                  title={v.title}
                  href={`/programs/${v.slug}`}
                  hue={v.thumbnail_hue ?? 200}
                  thumb={v.thumbnail_url}
                  live={v.status === 'live'}
                  durationSeconds={v.duration_seconds}
                  free={v.access === 'free'}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
