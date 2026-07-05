import { getCatalogRows } from '@albunyaan/core/data';
import CatalogRows from '../../components/CatalogRows';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Catalog — Albunyaan TV' };

/**
 * Full catalog: every row in real-site order (reference/real-site-ia.json) —
 * "Channels Live 📡" first, then the 15 series rows, each a poster carousel
 * with See All. All rows are server-rendered from the local Supabase.
 */
export default async function CatalogPage() {
  const rows = await getCatalogRows();

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
      {/* Filter/search strip (visual parity — real filtering arrives with the full library) */}
      <div className="flex items-center justify-between gap-4 mb-10">
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M1 3h12M3.5 7h7M5.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Filters
        </button>
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search</span>
          <input
            type="search"
            placeholder="Search…"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2 text-[13px] outline-none focus:border-brand transition"
          />
        </label>
      </div>

      <CatalogRows rows={rows} />
    </div>
  );
}
