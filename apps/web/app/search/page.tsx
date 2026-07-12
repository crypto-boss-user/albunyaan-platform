import { searchCatalog } from '@albunyaan/core/data';
import ThumbCard from '../../components/ThumbCard';
import { getLang, type Lang } from '../../lib/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Search — Albunyaan TV' };

/** Minimal per-language strings (dir/RTL comes from the root layout). */
const T: Record<
  Lang,
  {
    heading: string;
    placeholder: string;
    button: string;
    series: string;
    episodes: string;
    prompt: string;
    tooShort: string;
    none: (q: string) => string;
  }
> = {
  en: {
    heading: 'Search',
    placeholder: 'Search series and videos…',
    button: 'Search',
    series: 'Series',
    episodes: 'Videos',
    prompt: 'Search the full catalog — series and videos.',
    tooShort: 'Type at least 2 characters to search.',
    none: (q) => `Nothing found for “${q}”.`,
  },
  nl: {
    heading: 'Zoeken',
    placeholder: 'Zoek series en video’s…',
    button: 'Zoeken',
    series: 'Series',
    episodes: 'Video’s',
    prompt: 'Doorzoek de volledige catalogus — series en video’s.',
    tooShort: 'Typ minstens 2 tekens om te zoeken.',
    none: (q) => `Niets gevonden voor “${q}”.`,
  },
  ar: {
    heading: 'البحث',
    placeholder: 'ابحث في المسلسلات والفيديوهات…',
    button: 'بحث',
    series: 'المسلسلات',
    episodes: 'الفيديوهات',
    prompt: 'ابحث في الكتالوج الكامل — مسلسلات وفيديوهات.',
    tooShort: 'اكتب حرفين على الأقل للبحث.',
    none: (q) => `لم يتم العثور على نتائج لـ «${q}».`,
  },
};

/** /search?q=… — SSR full-catalog search (series + episodes), day-one Uscreen parity. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const qRaw = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '';
  const lang = await getLang();
  const t = T[lang];

  const { q, series, episodes } = await searchCatalog(qRaw);
  const tooShort = q.length > 0 && q.length < 2;
  const searched = q.length >= 2;
  const empty = searched && series.length === 0 && episodes.length === 0;

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
      <p className="section-label">{t.heading}</p>

      {/* Plain GET form — no client JS; prefilled from ?q= */}
      <form action="/search" method="get" role="search" className="mt-3 mb-10 flex gap-3 max-w-xl">
        <label className="relative grow">
          <span className="sr-only">{t.heading}</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.placeholder}
            autoFocus
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-brand transition"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-white text-[13px] font-semibold transition"
        >
          {t.button}
        </button>
      </form>

      {!searched && !tooShort && <p className="text-[14px] text-ink-secondary">{t.prompt}</p>}
      {tooShort && <p className="text-[14px] text-ink-secondary">{t.tooShort}</p>}
      {empty && <p className="text-[15px] text-ink-secondary">{t.none(q)}</p>}

      {series.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight text-ink mb-4">
            {t.series} <span className="text-ink-muted font-medium">({series.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {series.map((s) => (
              <ThumbCard
                key={s.slug}
                title={s.title}
                href={`/programs/${s.slug}`}
                hue={s.thumbnail_hue ?? 160}
                thumb={s.thumbnail_url}
                count={s.episodeCount}
              />
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
                glyph={v.status === 'live' ? '📡' : undefined}
                live={v.status === 'live'}
                durationSeconds={v.duration_seconds}
                free={v.access === 'free'}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
