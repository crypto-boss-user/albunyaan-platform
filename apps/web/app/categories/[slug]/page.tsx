import { notFound } from 'next/navigation';
import { getCategoryBySlug, getCollectionBySlug } from '@albunyaan/core/data';
import ThumbCard from '../../../components/ThumbCard';

export const dynamic = 'force-dynamic';

/**
 * /categories/:slug — grid of a category (or collection fallback), real URL pattern.
 *
 * ORDER FIDELITY (2026-08-06): when the extras import has run, `category.items`
 * holds the EXACT manually-ordered, MIXED (videos + series) content list from
 * the original platform (category_items.position) and is rendered as-is —
 * never re-sorted. The old alphabetical `category.videos` grid remains only as
 * the fallback for categories the import hasn't reached yet.
 */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const category = await getCategoryBySlug(slug);
  if (category) {
    const useItems = category.items.length > 0;
    const count = useItems ? category.items.length : category.videos.length;
    return (
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
        <p className="section-label">Category</p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">{category.name}</h1>
        <p className="text-[14px] text-ink-secondary mb-10">{count} titles</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {useItems
            ? category.items.map((item) =>
                item.kind === 'video' ? (
                  <ThumbCard
                    key={`v-${item.video.id}`}
                    title={item.video.title}
                    href={`/programs/${item.video.slug}`}
                    hue={item.video.thumbnail_hue ?? 200}
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
                    glyph="🎬"
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
                    glyph={v.status === 'live' ? '📡' : undefined}
                    live={v.status === 'live'}
                    durationSeconds={v.duration_seconds}
                    free={v.access === 'free'}
                  />
                ))}
        </div>
      </div>
    );
  }

  // Fallback: some real-site "See All" targets are collections
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
      <p className="section-label">Series</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">{collection.title}</h1>
      <p className="text-[14px] text-ink-secondary mb-10">{collection.episodes.length} episodes</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {collection.episodes.map((v) => (
          <ThumbCard
            key={v.id}
            title={v.title}
            href={`/programs/${v.slug}`}
            hue={v.thumbnail_hue ?? 120}
            durationSeconds={v.duration_seconds}
            free={v.access === 'free'}
          />
        ))}
      </div>
    </div>
  );
}
