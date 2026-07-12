/**
 * Catalog search — server-side only (service role, see ./client).
 *
 * Plain ILIKE is enough at this scale (~686 series / ~16k videos): no tsvector,
 * no trigram index. ILIKE is byte-pattern matching so it works unchanged on
 * Arabic titles (no lower()/case assumptions — Arabic has no case to fold).
 * Relevance: exact title first, then prefix matches, then shorter titles.
 */
import { createServiceClient } from './client';
import { VIDEO_COLS, isVisibleVideo } from './catalog';
import type { SeriesCard, VideoRow } from './rows';

export interface SearchResults {
  /** The trimmed query the results were computed for. */
  q: string;
  series: SeriesCard[];
  episodes: VideoRow[];
}

const RESULT_LIMIT = 30;

/**
 * Escape ILIKE pattern metacharacters in user input. PostgREST rewrites a literal
 * `*` to `%` in like/ilike filters BEFORE the query runs, so neutralize `*` first
 * (escaping it as `\*` would not help — PostgREST substitutes it regardless), then
 * escape the SQL LIKE metacharacters (backslash first).
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\*/g, ' ').replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** 0 = exact title, 1 = prefix match, 2 = substring match. Case-fold is a no-op for Arabic. */
function rank(title: string, q: string): number {
  const t = title.toLocaleLowerCase();
  const needle = q.toLocaleLowerCase();
  if (t === needle) return 0;
  if (t.startsWith(needle)) return 1;
  return 2;
}

function byRelevance(q: string) {
  return (a: { title: string }, b: { title: string }) =>
    rank(a.title, q) - rank(b.title, q) || a.title.length - b.title.length || a.title.localeCompare(b.title);
}

/**
 * Search series (collections.title) and episodes (videos.title, published/live only).
 * Queries shorter than 2 chars (after trim) return empty results.
 */
export async function searchCatalog(qRaw: string): Promise<SearchResults> {
  const q = qRaw.trim();
  if (q.length < 2) return { q, series: [], episodes: [] };

  const db = createServiceClient();
  const pattern = `%${escapeLikePattern(q)}%`;

  const [coll, vids] = await Promise.all([
    db
      .from('collections')
      .select('external_id, title, slug, raw, collection_items ( position, videos ( status, thumbnail_url, thumbnail_hue ) )')
      .ilike('title', pattern)
      .limit(RESULT_LIMIT),
    db
      .from('videos')
      .select(VIDEO_COLS)
      .ilike('title', pattern)
      .in('status', ['published', 'live'])
      .limit(RESULT_LIMIT),
  ]);
  if (coll.error) throw coll.error;
  if (vids.error) throw vids.error;

  // Build SeriesCards exactly like catalog.ts getCategoryRows(): prefer the
  // series' own branded cover, fall back to the first episode still.
  const series: SeriesCard[] = ((coll.data ?? []) as any[])
    .map((col) => {
      // Visible episodes only: a title-matched but fully-draft series must not
      // appear, and a draft still must not become the series cover/count.
      const items = (col.collection_items ?? [])
        .filter((i: any) => isVisibleVideo(i.videos))
        .sort((a: any, b: any) => a.position - b.position);
      const withPoster = items.find((i: any) => i.videos?.thumbnail_url) ?? items[0];
      const cover = col.raw?.cover_url ?? withPoster?.videos?.thumbnail_url ?? null;
      return {
        title: col.title as string,
        slug: col.slug as string,
        thumbnail_url: cover as string | null,
        thumbnail_hue: (withPoster?.videos?.thumbnail_hue ?? null) as number | null,
        episodeCount: items.length as number,
      };
    })
    .filter((s) => s.episodeCount > 0)
    .sort(byRelevance(q));

  const episodes = ((vids.data ?? []) as VideoRow[]).slice().sort(byRelevance(q));

  return { q, series, episodes };
}
