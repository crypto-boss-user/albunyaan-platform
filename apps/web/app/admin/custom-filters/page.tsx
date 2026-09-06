import { listFiltersForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import ConfirmDelete from '../../../components/admin/ConfirmDelete';
import { addFilterValueAction, deleteFilterAction, removeFilterValueAction } from './actions';
import CreateFilterForm from './CreateFilterForm';

export const dynamic = 'force-dynamic';

/**
 * Content › Custom filters in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): filters met hun opties (Type 4, Subject 10 als DB-data,
 * founder (c)), Add filter ("Create a filter": Filter name *, Filter options), per filter opties toevoegen/verwijderen, More options → Delete.
 * Volgorde van de filters = raw.volgorde (2 filters; slepen komt terug zodra er meer dan twee zijn — gemeld).
 */
export default async function AdminCustomFiltersPage() {
  await requireAdmin();
  const filters = await listFiltersForAdmin();
  return (
    <div className="mx-auto max-w-[1120px]" data-filters-page>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7">Custom filters</h1>
          <p className="ad-help">Filters · {filters.length} filters, {filters.reduce((n, f) => n + f.values.length, 0)} options</p>
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-4">
          {filters.map((f) => (
            <section key={f.id} className="ad-card p-5" data-filter={f.slug}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">{f.name}</h2>
                <ConfirmDelete label="Delete filter" text={`Delete the filter "${f.name}" and all its options? Videos keep playing; only the filter assignment disappears.`} action={deleteFilterAction} hidden={{ filter_id: f.id }} />
              </div>
              <ul className="mb-3 flex flex-wrap gap-2" data-filter-values>
                {f.values.map((v) => (
                  <li key={v.id} className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[13px]" style={{ background: 'var(--ad-secondary)' }}>
                    {v.value}
                    <form action={removeFilterValueAction}>
                      <input type="hidden" name="value_id" value={v.id} />
                      <button type="submit" className="leading-none" aria-label={`Remove option ${v.value}`} title="Remove">×</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addFilterValueAction} className="flex items-center gap-2">
                <input type="hidden" name="filter_id" value={f.id} />
                <input name="value" placeholder="Add option…" aria-label={`Add option to ${f.name}`} className="ad-input !w-64" required />
                <button type="submit" className="ad-btn ad-btn-outline">Add option</button>
              </form>
            </section>
          ))}
          {filters.length === 0 && <p className="ad-help">No filters yet.</p>}
        </div>
        <section className="ad-card p-5" data-card="Create a filter">
          <h2 className="mb-1 text-[16px] font-semibold">Create a filter</h2>
          <p className="ad-help mb-3">Filter options: what members pick from when filtering your content.</p>
          <CreateFilterForm />
        </section>
      </div>
    </div>
  );
}
