import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { LIVE_CATEGORY_SLUGS, getAllCategories, getCategoryBySlug, getCollectionBySlug, uscreenCategoryTitle } from '@albunyaan/core/data';

/** Eén keer per request (generateMetadata + page delen dezelfde zware embed-query — review I-4). */
const getCategory = cache(getCategoryBySlug);
const getCollection = cache(getCollectionBySlug);
import CatalogFilters from '../../../components/CatalogFilters';
import ThumbCard from '../../../components/ThumbCard';

export const dynamic = 'force-dynamic';

/** Paginatitel zoals gemeten op de storefront (categorie-titels-2026-09-05.json: "Age 5-9", "Channels", …; §5.16). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (category) return { title: uscreenCategoryTitle(category.external_id, category.name) };
  const collection = await getCollection(slug);
  return { title: collection?.title ?? 'Albunyaan' };
}

/**
 * /categories/:slug zoals de storefront (SR 4 stap 10; SR 2a category-age-5-9__1440/390__en): kopblok met h1 (weergavenaam),
 * filterbalk (Filters + zoekveld, categorie voorgeselecteerd), daarna het VOLLEDIGE raster (de storefront pagineert lazy:
 * 80 op 1440 / 120 op 390 van de 2009; hier alles wat de zichtbaarheidsregel toelaat — zie toCategoryItems).
 * ORDER FIDELITY (2026-08-06): `category.items` = exacte handmatige Uscreen-volgorde (category_items.position), nooit
 * her-gesorteerd; de alfabetische `category.videos`-lijst blijft alleen als fallback voor categorieën zonder extras-import.
 * Eigen extra's (eyebrow "Category", "N titles") zijn weg (B68: de storefront toont ze niet).
 */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([getCategory(slug), getAllCategories()]);

  if (category) {
    const useItems = category.items.length > 0;
    return (
      <>
        <div className="py-8 px-[3%] border-b border-black/5">
          <div className="max-w-[1400px] mx-auto">
            <h1 className="text-2xl font-bold text-ink">{category.name}</h1>
          </div>
        </div>
        <CatalogFilters categories={categories} category={category.slug} />
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
          <div data-raster className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {useItems
              ? category.items.map((item) =>
                  item.kind === 'video' ? (
                    <ThumbCard
                      key={`v-${item.video.id}`}
                      title={item.video.title}
                      href={`/programs/${item.video.slug}`}
                      hue={item.video.thumbnail_hue ?? 200}
                      thumb={item.video.thumbnail_url}
                      glyph={item.video.status === 'live' ? '📡' : undefined}
                      live={item.video.status === 'live'}
                      durationSeconds={item.video.duration_seconds}
                      free={item.video.access === 'free'}
                    />
                  ) : (
                    <ThumbCard
                      key={`c-${item.collection.id}`}
                      title={item.collection.title}
                      href={`/programs/${item.collection.slug}`}
                      hue={200}
                      thumb={item.collection.cover}
                      count={item.collection.episodeCount}
                    />
                  ),
                )
              : category.videos
                  .slice()
                  .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live'))
                  .map((v) => (
                    <ThumbCard
                      key={v.id}
                      title={v.title}
                      href={`/programs/${v.slug}`}
                      hue={v.thumbnail_hue ?? 200}
                      thumb={v.thumbnail_url}
                      glyph={v.status === 'live' ? '📡' : undefined}
                      live={v.status === 'live'}
                      durationSeconds={v.duration_seconds}
                      free={v.access === 'free'}
                    />
                  ))}
          </div>
          {!useItems && category.videos.length === 0 && LIVE_CATEGORY_SLUGS.includes(category.slug) && (
            // B67: alleen de live-categorie krijgt de placeholder (review I-2); andere lege categorieën tonen een leeg raster.
            <p data-live-placeholder className="text-[14px] text-ink-secondary">Live kanalen volgen.</p>
          )}
        </div>
      </>
    );
  }

  // Fallback: some real-site "See All" targets are collections
  const collection = await getCollection(slug);
  if (!collection) notFound();
  return (
    <>
      <div className="py-8 px-[3%] border-b border-black/5">
        <div className="max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold text-ink">{collection.title}</h1>
        </div>
      </div>
      <CatalogFilters categories={categories} />
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
        <div data-raster className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {collection.episodes.map((v) => (
            <ThumbCard key={v.id} title={v.title} href={`/programs/${v.slug}`} hue={v.thumbnail_hue ?? 120} thumb={v.thumbnail_url} durationSeconds={v.duration_seconds} free={v.access === 'free'} />
          ))}
        </div>
      </div>
    </>
  );
}
