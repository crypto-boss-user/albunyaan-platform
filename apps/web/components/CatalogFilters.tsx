import { FEATURED_CATEGORY_SLUG, type CategoryRow } from '@albunyaan/core/data';

/**
 * Filterbalk van de storefront-catalogus (SR 4 stap 9; SR 2a catalog/search/category: `.catalog-filters` met knop "Filters"
 * links, zoekveld rechts, en een paneel met de selects Category · Type · Subject). Zonder client-JS: <details>/<summary>
 * klapt het paneel open; de storefront past een filter toe bij wijzigen (JS) — hier via de knop "Apply" (aanname, aanpasbaar).
 * Category werkt (→ /search?category=<slug>); Type en Subject staan er met de gemeten opties maar zijn UITGESCHAKELD:
 * de data kent geen type-/onderwerp-taxonomie (VRAAG teamreview: filters vullen bij de kijkplatformkeuze/extras-import).
 * Opties letterlijk uit de SR 2a-HTML (category-age-5-9__1440__en `.secondary-filters`); de Category-select telt zoals gemeten
 * All + 24 (search__1440__en `#category_id`: mét Channels Live, zónder de featured categorie New releases). Op /search staat het
 * paneel open zoals gemeten (`.secondary-filters` zonder `hidden`), op /catalog en de categoriepagina dicht.
 */
const TYPE_OPTIES = ['All', 'Series - مسلسلات', 'Movies - أفلام', 'Apps - تطبيقات', 'Live - بث مباشر'];
const SUBJECT_OPTIES = [
  'All',
  'Creed - العقيدة',
  "Qor'aan - القرآن",
  'Fiqh - الفقه',
  'Biography - السيرة',
  'Doaa & Adkhaar - الأدعية والأذكار',
  'Arabic Language - اللغة العربية',
  'Entertainment - الترفيه',
  'Anasheed - أناشيد',
  'Other - متفرقات',
  'History - التاريخ',
];

const SELECT = 'block w-full rounded border border-black/15 bg-white px-3 py-2 text-[14px] text-ink disabled:text-ink-muted disabled:bg-surface-warm';
const LABEL = 'block text-sm mb-2 truncate text-ink';

export default function CatalogFilters({
  categories,
  q = '',
  category = '',
  open = false,
}: {
  categories: CategoryRow[];
  /** Paneel open (storefront: op /catalog/search open, elders dicht). */
  open?: boolean;
  /** Huidige zoekterm (op /search), blijft behouden bij filteren. */
  q?: string;
  /** Huidige categorie-slug (op /search?category=…). */
  category?: string;
}) {
  return (
    <div data-filters className="relative bg-surface-warm border-y border-black/5">
      <details className="px-[3%]" open={open}>
        <summary className="list-none cursor-pointer inline-flex items-center gap-2 py-3 text-base text-ink select-none marker:hidden [&::-webkit-details-marker]:hidden">
          <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
            <path d="M1 3h12M3.5 7h7M5.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Filters
        </summary>
        <form action="/search" method="get" className="py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 border-t border-black/5">
          {q && <input type="hidden" name="q" value={q} />}
          <div>
            <label htmlFor="filter-category" className={LABEL}>
              Category
            </label>
            <select id="filter-category" name="category" defaultValue={category} className={SELECT}>
              <option value="">All</option>
              {categories
                .filter((c) => c.slug !== FEATURED_CATEGORY_SLUG)
                .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-type" className={LABEL}>
              Type
            </label>
            <select id="filter-type" name="type" disabled title="Filter volgt — geen type-taxonomie in de data" className={SELECT}>
              {TYPE_OPTIES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-subject" className={LABEL}>
              Subject
            </label>
            <select id="filter-subject" name="subject" disabled title="Filter volgt — geen onderwerp-taxonomie in de data" className={SELECT}>
              {SUBJECT_OPTIES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="inline-flex items-center px-5 py-2 rounded bg-brand hover:bg-brand-dark transition text-white text-[14px] font-semibold">
              Apply
            </button>
          </div>
        </form>
      </details>
      {/* Zoekveld rechts in de balk (storefront `#catalog_filter_search`); GET → /search?q= */}
      <form action="/search" method="get" role="search" className="absolute top-2.5 end-[3%] w-36 md:w-48">
        {category && <input type="hidden" name="category" value={category} />}
        <label className="block">
          <span className="sr-only">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search…"
            className="w-full rounded border border-black/15 bg-white px-4 py-1.5 text-[14px] outline-none focus:border-brand transition"
          />
        </label>
      </form>
    </div>
  );
}
