import { requireAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Sales › Invoices in de Uscreen-vorm (AD 2.4; norm AD0-inventaris §2.6, sales-invoices-lijst.json 2026-09-07): kop + Export CSV; filters
 * All Statuses · Created (newest first) · More Filters · zoekveld; kolommen Invoice · User · Created · Status · Paid at · Coupon · Total; paginering;
 * totaalregel. Founder 2026-09-07 (vraag 8): lege lijst met de gemeten kolommen en filters, reden "tot de betaalbeslissing", geen voorbeeldrijen.
 */
const REDEN = 'tot de betaalbeslissing';
const KOLOMMEN = ['Invoice', 'User', 'Created', 'Status', 'Paid at', 'Coupon', 'Total'];
// alleen de gemeten comboboxlabels (koude review M-4): de overige opties zijn bij Uscreen niet geopend (B83: geen klikken)
const STATUSSEN = ['All Statuses'];
const SORTERING = ['Created (newest first)'];

export default async function InvoicesPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[1120px]" data-invoices-page>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">Invoices</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">{REDEN}</span>
          <button type="button" className="ad-btn ad-btn-primary" disabled title={`Export CSV — ${REDEN}`} data-knop-uit="Export CSV">Export CSV</button>
        </div>
      </div>
      <div className="ad-card">
        <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }} data-invoice-filters>
          <select aria-label="All Statuses" className="ad-select !w-44" disabled title={REDEN} defaultValue={STATUSSEN[0]}>
            {STATUSSEN.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Created (newest first)" className="ad-select !w-56" disabled title={REDEN} defaultValue={SORTERING[0]}>
            {SORTERING.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button type="button" className="ad-btn ad-btn-outline" disabled title={`More Filters — ${REDEN}`} data-knop-uit="More Filters">More Filters</button>
          <input type="search" placeholder="Search..." aria-label="Search..." className="ad-input !w-64" disabled title={REDEN} />
        </div>
        <table className="ad-table" data-invoices-table>
          <thead><tr>{KOLOMMEN.map((k) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            <tr data-invoices-empty><td colSpan={KOLOMMEN.length} className="ad-help">No invoices yet — facturen komen uit de betaalkoppeling ({REDEN}). Uscreen 07-09: 3.134 facturen, alleen als referentie.</td></tr>
          </tbody>
        </table>
        <div className="flex items-center justify-between p-4 text-[14px]" data-pagination>
          <span className="ad-help" data-invoices-total>0 invoices • Total: €0.00</span>
          <span className="flex items-center gap-3">
            <button type="button" className="ad-btn ad-btn-outline" disabled>Previous</button>
            <span className="ad-help">Page 1 of 1</span>
            <button type="button" className="ad-btn ad-btn-outline" disabled>Next</button>
          </span>
        </div>
      </div>
    </div>
  );
}
