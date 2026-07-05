import type { CatalogRowData } from '@albunyaan/core/data';
import CatalogRow, { RowItem } from './CatalogRow';
import ThumbCard from './ThumbCard';

/** Server-rendered list of catalog rows (real DB rows → row grammar). */
export default function CatalogRows({ rows, maxPerRow = 12 }: { rows: CatalogRowData[]; maxPerRow?: number }) {
  return (
    <div className="space-y-10">
      {rows.map((row) => (
        <CatalogRow key={row.key} title={row.title} seeAllHref={row.seeAllHref}>
          {row.kind === 'live'
            ? row.videos.slice(0, maxPerRow).map((v) => (
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
            : row.kind === 'category'
            ? row.videos.slice(0, maxPerRow).map((v) => (
                <RowItem key={v.id}>
                  <ThumbCard
                    title={v.title}
                    href={`/programs/${v.slug}`}
                    hue={v.thumbnail_hue ?? 160}
                    thumb={v.thumbnail_url}
                    durationSeconds={v.duration_seconds}
                    free={v.access === 'free'}
                  />
                </RowItem>
              ))
            : [
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
              ]}
        </CatalogRow>
      ))}
    </div>
  );
}
