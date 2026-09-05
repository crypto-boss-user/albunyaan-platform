import type { CatalogRowData } from '@albunyaan/core/data';
import CatalogRow, { RowItem } from './CatalogRow';
import ThumbCard from './ThumbCard';

/**
 * Server-rendered list of catalog rows (real DB rows → row grammar).
 * SR 4 stap 9: categorie-rijen tonen de gemengde items (video's + collecties) in de exacte Uscreen-volgorde
 * (category_items); een lege live-rij toont de B67-tekst i.p.v. te verdwijnen.
 */
export default function CatalogRows({ rows, maxPerRow = 12 }: { rows: CatalogRowData[]; maxPerRow?: number }) {
  return (
    <div className="space-y-10">
      {rows.map((row) => (
        <CatalogRow key={row.key} title={row.title} seeAllHref={row.seeAllHref}>
          {row.kind === 'live' ? (
            row.videos.length === 0 ? (
              // B67 (team, standaard = advies): tot de kijkplatformkeuze "live kanalen volgen".
              <p data-live-placeholder className="text-[14px] text-ink-secondary py-6">Live kanalen volgen.</p>
            ) : (
              row.videos.slice(0, maxPerRow).map((v) => (
                <RowItem key={v.id}>
                  <ThumbCard
                    title={v.title}
                    href={`/programs/${v.slug}`}
                    hue={v.thumbnail_hue ?? 200}
                    thumb={v.thumbnail_url}
                    glyph="📡"
                    live
                  />
                </RowItem>
              ))
            )
          ) : row.kind === 'category' ? (
            row.items.slice(0, maxPerRow).map((it) =>
              it.kind === 'video' ? (
                <RowItem key={`v-${it.video.id}`}>
                  <ThumbCard
                    title={it.video.title}
                    href={`/programs/${it.video.slug}`}
                    hue={it.video.thumbnail_hue ?? 200}
                    thumb={it.video.thumbnail_url}
                    glyph={it.video.status === 'live' ? '📡' : undefined}
                    live={it.video.status === 'live'}
                    durationSeconds={it.video.duration_seconds}
                    free={it.video.access === 'free'}
                  />
                </RowItem>
              ) : (
                <RowItem key={`c-${it.collection.id}`}>
                  <ThumbCard
                    title={it.collection.title}
                    href={`/programs/${it.collection.slug}`}
                    hue={200}
                    thumb={it.collection.cover}
                    count={it.collection.episodeCount}
                  />
                </RowItem>
              ),
            )
          ) : (
            [
              <RowItem key={`${row.key}-series`}>
                <ThumbCard
                  title={row.title}
                  href={`/programs/${row.collection.slug}`}
                  hue={row.videos[0]?.thumbnail_hue ?? 120}
                  thumb={row.videos[0]?.thumbnail_url}
                  count={row.videos.length}
                />
              </RowItem>,
              ...row.videos.slice(0, maxPerRow - 1).map((v) => (
                <RowItem key={v.id}>
                  <ThumbCard
                    title={v.title}
                    href={`/programs/${v.slug}`}
                    hue={v.thumbnail_hue ?? 120}
                    thumb={v.thumbnail_url}
                    durationSeconds={v.duration_seconds}
                    free={v.access === 'free'}
                  />
                </RowItem>
              )),
            ]
          )}
        </CatalogRow>
      ))}
    </div>
  );
}
